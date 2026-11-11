// Non-régression des CV libres (sans offre liée) : tout ce qui part au modèle (prompt système,
// message, schéma de réponse, modèle) et tout ce que le serveur en tire (contexte, texte affiché,
// CV modifié, points abandonnés) reste identique à l'octet près. Les empreintes sont enregistrées
// dans coach-libre.golden.json, avant tout changement du coach pour les CV liés à une offre.
// Lancé par `npm test` (Node 22.18 ou plus). Réenregistrer (seulement pour un changement voulu des
// CV libres) : COACH_GOLDEN_UPDATE=1 node --test src/lib/coach-libre.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";

// Le même chargeur que le banc d'essai : imports sans extension entre fichiers .ts, JSON sans attribut.
await import("../../scripts/eval/register.mjs");
const { buildCoachContext } = await import("./coach-context.ts");
const { listeningState } = await import("./coach-intent.ts");
const { coachBuilderCv, coachOpening } = await import("./coach-llm.ts");
const { runCoachTurn } = await import("./coach-turn.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");

const GOLDEN = new URL("./coach-libre.golden.json", import.meta.url);
const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);

// Modèle par défaut (aucune surcharge locale) et tirages au hasard rejouables.
for (const key of Object.keys(process.env)) if (key.startsWith("CLAUDE_MODEL_")) delete process.env[key];
let seed = 1;
Math.random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const marketKeywords = JSON.parse(readFileSync(new URL("market-keywords.json", FIXTURES), "utf8"));
const profiles = ["dev", "holdout"].flatMap((set) =>
  readdirSync(new URL(`profiles/${set}/`, FIXTURES))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(new URL(`profiles/${set}/${f}`, FIXTURES), "utf8"))),
);

/** Client factice : enregistre chaque requête et renvoie la réponse donnée. */
function fakeClient(output) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        parse: async (params) => {
          requests.push(JSON.parse(JSON.stringify(params)));
          return { stop_reason: "end_turn", parsed_output: typeof output === "function" ? output(requests.length) : output, model: params.model };
        },
      },
    },
  };
}

const flat = (patch) => ({ mode: "parcours", change_summary: "", message: "", skipped_points: [], section: "aucune", data: "", ...patch });

/** Situations jouées pour chaque profil : historique, message, points abandonnés, réponse du modèle. */
function situations(cv) {
  const exp = cv.experiences[0];
  const opening = "Je vais t'aider à corriger ton CV point par point. Combien de clients suivais-tu ?";
  return {
    parcours: {
      history: [{ role: "assistant", content: opening }],
      request: "Aide-moi à améliorer mon CV.",
      skipped: [],
      reply: flat({ message: "Combien de dossiers traitais-tu par mois ?" }),
    },
    reponse: {
      history: [{ role: "assistant", content: opening }],
      request: "Je suivais 40 clients et j'ai formé 3 stagiaires.",
      skipped: ["Stage : nombre d'heures de tutorat"],
      reply: exp
        ? flat({
            section: "experience",
            change_summary: "C'est fait : j'ai ajouté tes 40 clients.",
            message: "Combien de stagiaires as-tu formés ?",
            data: JSON.stringify({ id: exp.id, bullets: [{ index: 0, after: "Suivi d'un portefeuille de 40 clients" }, { index: -1, after: "Formation des stagiaires" }] }),
          })
        : flat({ message: "Quel poste vises-tu ?" }),
    },
    refus: {
      history: [
        { role: "assistant", content: opening },
        { role: "user", content: "non" },
        { role: "assistant", content: "Pas de souci. Combien de projets as-tu menés ?" },
      ],
      request: "je sais pas",
      skipped: [],
      reply: flat({ message: "Pas de souci. Combien de réunions animais-tu ? Je continue avec ta formation ?" }),
    },
    stop: {
      history: [{ role: "assistant", content: opening }],
      request: "plus de questions stp",
      skipped: [],
      reply: flat({ message: "Combien de clients suivais-tu ?" }),
    },
    raccourcir: {
      history: [{ role: "assistant", content: opening }],
      request: "Raccourcis mon accroche.",
      skipped: [],
      reply: flat({ mode: "demande", section: "summary", change_summary: "C'est fait : accroche raccourcie.", message: "Combien de clients ?", data: "Profil rigoureux" }),
    },
    pret: {
      history: [{ role: "assistant", content: opening }],
      request: "Est-ce que mon CV est prêt ?",
      skipped: [],
      reply: flat({ message: "Il reste tes chiffres. Combien de clients ?" }),
    },
    anglais: {
      history: [{ role: "assistant", content: opening }],
      request: "Can you help me improve my CV please?",
      skipped: [],
      reply: flat({ message: "How many clients did you manage?" }),
    },
  };
}

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);

async function snapshot() {
  const out = {};
  for (const profile of profiles) {
    seed = 1;
    const cv = CvDataSchema.parse(profile.cv);
    const scoring = scoringContextFrom(cv, null, marketKeywords[profile.sector] ?? []);
    const start = buildCoachContext(cv, scoring, null, null);
    seed = 1;
    const openingClient = fakeClient({ message: " Bonjour, on commence par ton expérience ? " });
    const opening = await coachOpening(openingClient, start);
    out[`${profile.id}/contexte`] = hash(start);
    out[`${profile.id}/ouverture`] = hash({ requests: openingClient.requests, opening });

    for (const [name, s] of Object.entries(situations(cv))) {
      seed = 1;
      const context = { ...buildCoachContext(cv, scoring, null, s.request), skipped: s.skipped, listening: listeningState(s.history, s.request) };
      const client = fakeClient(s.reply);
      const reply = await coachBuilderCv(client, context, s.history, s.request);
      const result = await runCoachTurn({
        current: cv,
        context,
        turns: s.history,
        request: s.request,
        reply,
        limitReached: false,
        retry: (retry) => coachBuilderCv(client, context, s.history, s.request, retry),
      });
      out[`${profile.id}/${name}`] = hash({ context, requests: client.requests, reply, result });
    }
  }
  return out;
}

test("CV libres : prompt, requêtes et réponses identiques à l'enregistrement", async () => {
  const warn = console.warn;
  const error = console.error;
  console.warn = console.error = () => {};
  let current;
  try {
    current = await snapshot();
  } finally {
    console.warn = warn;
    console.error = error;
  }
  if (process.env.COACH_GOLDEN_UPDATE === "1") {
    writeFileSync(GOLDEN, `${JSON.stringify(current, null, 1)}\n`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.ok(Object.keys(golden).length >= profiles.length * 9);
  assert.deepEqual(current, golden);
});
