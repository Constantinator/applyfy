// Aides communes aux tests du coach : chargeur, CV et offres des fixtures du banc d'essai,
// contexte construit comme l'action, client factice. Pas un fichier de test (pas de .test).
import { readFileSync } from "node:fs";

await import("../../scripts/eval/register.mjs");
for (const key of Object.keys(process.env)) if (key.startsWith("CLAUDE_MODEL_")) delete process.env[key];

const { buildCoachContext } = await import("./coach-context.ts");
const { listeningState } = await import("./coach-intent.ts");
const { coachBuilderCv } = await import("./coach-llm.ts");
const { runCoachTurn } = await import("./coach-turn.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");

const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);

/** CV d'un profil des fixtures (jeu dev ou tenu à l'écart). */
export function profile(id) {
  for (const set of ["dev", "holdout"]) {
    try {
      return CvDataSchema.parse(JSON.parse(readFileSync(new URL(`profiles/${set}/${id}.json`, FIXTURES), "utf8")).cv);
    } catch {
      // essai dans l'autre jeu
    }
  }
  throw new Error(`profil ${id} introuvable`);
}

const offers = JSON.parse(readFileSync(new URL("offers.json", FIXTURES), "utf8")).offers;
export const scenarios = JSON.parse(readFileSync(new URL("scenarios.json", FIXTURES), "utf8")).scenarios;

/** Candidature synthétique (forme lue par l'action), mots-clés au format enregistré. */
export function detailOf(id) {
  const o = offers.find((x) => x.id === id);
  return {
    application: {
      id: `app-${o.id}`,
      position: o.position,
      company: o.company,
      sector: o.sector,
      offer_description: o.offer_description,
      offer_summary: null,
      cv_suggestions: {
        kind: "keywords",
        keywords: o.keywords.map((keyword, i) => ({ keyword, group: "technique", variants: [], weight: o.keywords.length - i })),
        ignored: [],
        conseils: [],
        titre_cv: "",
      },
    },
  };
}

const scoringOffer = (detail) => ({
  position: detail.application.position,
  company: detail.application.company,
  description: detail.application.offer_description,
  sector: detail.application.sector,
});

/** Contexte du coach comme l'action : CV lié (detail) ou libre (null). */
export function contextFor(cv, detail, { history = [], request = null, skipped = [] } = {}) {
  const scoring = scoringContextFrom(cv, detail ? scoringOffer(detail) : null, []);
  const base = buildCoachContext(cv, scoring, detail, request, history);
  const listening =
    request !== null ? listeningState(history, request, base.offerSteps ? { keywords: base.offerKeywords ?? [] } : undefined) : undefined;
  return { ...base, skipped, ...(listening ? { listening } : {}) };
}

/** Client factice : enregistre les requêtes et renvoie la réponse donnée. */
export function fakeClient(output) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        parse: async (params) => {
          requests.push(params);
          return { stop_reason: "end_turn", parsed_output: output, model: params.model };
        },
      },
    },
  };
}

export const flat = (patch) => ({ mode: "parcours", change_summary: "", message: "", skipped_points: [], section: "aucune", data: "", ...patch });

/** Journal du coach coupé pendant l'appel. */
export async function quiet(fn) {
  const { warn, error } = console;
  console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

/** Un échange complet : réponse du modèle (factice), puis runCoachTurn. */
export async function turn(cv, context, history, request, reply) {
  const first = await coachBuilderCv(fakeClient(reply), context, history, request);
  return quiet(() => runCoachTurn({ current: cv, context, turns: history, request, reply: first, limitReached: false, retry: async () => first }));
}
