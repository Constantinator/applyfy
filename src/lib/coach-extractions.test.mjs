// Extractions pour le banc d'essai du coach (scripts/eval) : contexte du score et du coach sans
// lecture, échange du coach hors de l'action, appels au modèle sur un client injecté. Mêmes
// résultats que dans l'application. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Imports sans extension entre fichiers .ts, et JSON importé sans attribut (comme dans l'app).
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

delete process.env.CLAUDE_MODEL_COACH;
delete process.env.COACH_MODE_BOOLEAN;

const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { buildCoachContext, missingOfferKeywords } = await import("./coach-context.ts");
const { runCoachTurn } = await import("./coach-turn.ts");
const { coachBuilderCv, coachOpening } = await import("./coach-llm.ts");
const { ClaudeRefusalError } = await import("./claude-structured.ts");
const { coachContentKey } = await import("./coach-prompt.ts");
const { quotaBlockedText } = await import("./coach-outcome.ts");
const { PROBLEM_NO_FIGURE } = await import("./coach-proposals.ts");
const { CvDataSchema, chatContent, targetJobOf } = await import("./cv-builder-types.ts");
const { scoreCv } = await import("./cv-score.ts");
const { COMMON_ACTION_VERBS, cvScoringSector, getSectorContext } = await import("./cv-sector-context.ts");

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// CV synthétique (aucune donnée réelle).
const cv = CvDataSchema.parse({
  personal: { firstName: "Alex", lastName: "Exemple", jobTitle: "Commercial terrain" },
  summary: "Commercial terrain, 3 ans de prospection auprès des PME.",
  experiences: [
    {
      id: "e1",
      position: "Commercial",
      company: "Société Fictive",
      startDate: "2021",
      endDate: "2024",
      bullets: ["Prospection de nouveaux clients PME", "Négocier des contrats annuels avec 30 clients"],
    },
  ],
  skills: [{ id: "s1", name: "Négociation", level: "" }],
});
const MARKET = ["prospection", "CRM", "négociation"];
const offer = { position: "  Développeur backend  ", company: "Entreprise Fictive", description: "API, Node.js", sector: "tech" };

// --- Contexte du score sans lecture (cv-scoring-context.ts) ---

test("contexte du score : même calcul que loadScoringContext, mots-clés du marché transmis tels quels", () => {
  const free = scoringContextFrom(cv, null, MARKET);
  const sector = cvScoringSector(JSON.stringify(chatContent(cv)), targetJobOf(cv), null);
  const c = getSectorContext(sector);
  assert.deepEqual(free, {
    sector,
    sectorName: c.name,
    atsKeywords: c.ats_keywords,
    actionVerbs: COMMON_ACTION_VERBS,
    avoid: c.avoid,
    marketKeywords: MARKET,
    offer: null,
  });
  // CV lié : le secteur de l'offre fixe le score ; intitulé et entreprise rognés et bornés.
  const linked = scoringContextFrom(cv, { ...offer, company: "x".repeat(200) }, []);
  assert.equal(linked.sector, "tech");
  assert.deepEqual(linked.offer, { position: "Développeur backend", company: "x".repeat(120) });
});

// --- Contexte du coach sans lecture (coach-context.ts) ---

test("contexte du coach : mode libre, score et empreinte identiques au calcul de l'action", () => {
  const scoring = scoringContextFrom(cv, null, MARKET);
  const context = buildCoachContext(cv, scoring, null);
  assert.equal(context.scoring, scoring);
  assert.equal(context.sector, scoring.sector);
  assert.equal(context.marketKeywords, scoring.marketKeywords, "les mots-clés du marché du score vont au coach");
  assert.deepEqual(context.offerKeywords, []);
  assert.equal(context.offer, null);
  assert.equal(context.titleMismatch, false);
  assert.equal(context.score.value, scoreCv(cv, scoring).score);
  assert.equal(context.contentKey, coachContentKey(context.cvJson, [], scoring.sector, null));
  assert.equal(context.cvJson, JSON.stringify(chatContent(cv)));
});

test("contexte du coach : CV lié, mots-clés de l'offre absents du CV et titre d'un autre métier", () => {
  const scoring = scoringContextFrom(cv, offer, []);
  const detail = {
    application: {
      cv_suggestions: {
        keywords: [
          { keyword: "Node.js", group: "technique", variants: [], weight: 3 },
          { keyword: "prospection", group: "technique", variants: [], weight: 1 },
          { keyword: "Docker", group: "technique", variants: [], weight: 2 },
        ],
        ignored: ["Docker"],
      },
    },
  };
  const context = buildCoachContext(cv, scoring, detail);
  assert.deepEqual(context.offerKeywords, ["Node.js"], "présent ou ignoré : retiré");
  assert.deepEqual(context.offer, { position: "Développeur backend", company: "Entreprise Fictive" });
  assert.equal(context.titleMismatch, true);
  // Ancien format, illisible, ou trop de mots-clés : sans échec, 25 au plus.
  assert.deepEqual(missingOfferKeywords({ application: { cv_suggestions: { ce_qui_manque: ["A", "B"] } } }, cv, "tech"), ["A", "B"]);
  assert.deepEqual(missingOfferKeywords({ application: { cv_suggestions: "illisible" } }, cv, "tech"), []);
  const many = Array.from({ length: 40 }, (_, i) => `M${i}`);
  assert.equal(missingOfferKeywords({ application: { cv_suggestions: { ce_qui_manque: many } } }, cv, "tech").length, 25);
});

// --- Échange du coach hors de l'action (coach-turn.ts) ---

const scoring = scoringContextFrom(cv, null, []);
const VERB = scoring.actionVerbs[0];
const reply = (patch = {}) => ({
  mode: "parcours",
  message: "Combien de rendez-vous par semaine ?",
  changeSummary: "C'est fait : j'ai ajouté une puce.",
  skippedPoints: [],
  update: null,
  invalid: false,
  raw: null,
  ...patch,
});
const withBullet = (after, patch = {}) =>
  reply({
    update: { section: "experience", data: { id: "e1", bullets: [{ index: -1, after }], bullets_to_remove: [] } },
    raw: { section: "experience", data: "{}" },
    ...patch,
  });
const turnInput = (first, retry, patch = {}) => ({
  current: cv,
  context: { scoring, offerKeywords: [] },
  turns: [{ role: "assistant", content: "Combien de clients ?" }],
  request: "J'en ai signé 12 par mois.",
  reply: first,
  limitReached: false,
  retry,
  ...patch,
});
const noRetry = async () => assert.fail("pas de second essai attendu");
/** Journaux de l'échange (console.warn / console.error) coupés pendant le test. */
const quiet = (fn) => async () => {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.warn = warn;
    console.error = error;
  }
};

test(
  "échange : puce valide appliquée directement, sans second essai",
  quiet(async () => {
    const turn = await runCoachTurn(turnInput(withBullet(`${VERB} 12 contrats par mois`), noRetry));
    assert.equal(turn.kind, "done");
    assert.equal(turn.applied, 1);
    assert.equal(turn.retried, false);
    assert.deepEqual(turn.problems, []);
    assert.ok(turn.updated.experiences[0].bullets.includes(`${VERB} 12 contrats par mois`));
    assert.equal(turn.scoreBefore, scoreCv(cv, scoring).score);
    assert.equal(turn.scoreAfter, scoreCv(turn.updated, scoring).score);
  }),
);

test(
  "échange : puce refusée, second essai avec la cause exacte, puis appliquée",
  quiet(async () => {
    const calls = [];
    const turn = await runCoachTurn(
      turnInput(withBullet(`${VERB} des contrats avec les PME`), async (retry) => {
        calls.push(retry);
        return withBullet(`${VERB} 12 contrats par mois`);
      }),
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].mode, "parcours");
    assert.deepEqual(calls[0].problems[0].problems, [PROBLEM_NO_FIGURE]);
    assert.equal(turn.retried, true);
    assert.equal(turn.firstProblems.length, 1);
    assert.deepEqual(turn.problems, []);
    assert.equal(turn.applied, 1);
  }),
);

test(
  "échange : second essai impossible, texte refusé jamais écrit dans le CV",
  quiet(async () => {
    const turn = await runCoachTurn(turnInput(withBullet(`${VERB} des contrats avec les PME`), async () => null));
    assert.equal(turn.kind, "done");
    assert.equal(turn.retried, false);
    assert.equal(turn.applied, 0);
    assert.equal(turn.updated, cv);
    assert.equal(turn.problems.length, 1);
    assert.ok(turn.text.length > 0);
  }),
);

test(
  "échange : adaptations du mois épuisées, rien d'écrit, pas de second essai",
  quiet(async () => {
    const first = withBullet(`${VERB} des contrats avec les PME`);
    const turn = await runCoachTurn(turnInput(first, noRetry, { limitReached: true }));
    assert.equal(turn.kind, "quotaBlocked");
    assert.equal(turn.text, quotaBlockedText({ mode: "parcours", section: "experience", message: first.message }));
  }),
);

test(
  "échange : question seule, aucune modification",
  quiet(async () => {
    const turn = await runCoachTurn(turnInput(reply(), noRetry));
    assert.equal(turn.kind, "done");
    assert.equal(turn.applied, 0);
    assert.equal(turn.section, null);
    assert.ok(turn.text.includes("Combien de rendez-vous par semaine ?"));
  }),
);

// --- Appels au modèle sur un client injecté (coach-llm.ts, claude-structured.ts) ---

/** Client factice : enregistre les requêtes, renvoie la sortie donnée (aucun appel réseau). */
function fakeClient(output, stopReason = "end_turn") {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        parse: async (params) => {
          requests.push(params);
          return { stop_reason: stopReason, stop_details: null, model: params.model, parsed_output: output };
        },
      },
    },
  };
}

test("coach : appels sur le client donné, mêmes paramètres qu'avant, mots-clés du marché du contexte", async () => {
  const context = buildCoachContext(cv, scoringContextFrom(cv, null, ["motcle-marche-fictif"]), null);
  const client = fakeClient({ mode: "demande", message: " Fait. ", change_summary: "", skipped_points: [], section: "aucune", data: "" });
  const answer = await coachBuilderCv(client, context, [], "Raccourcis mon accroche");
  assert.deepEqual(answer, { mode: "demande", message: "Fait.", changeSummary: "", skippedPoints: [], update: null, invalid: false, raw: null });
  const [params] = client.requests;
  assert.equal(params.model, "claude-sonnet-5-5");
  assert.equal(params.max_tokens, 16000);
  assert.equal(params.output_config.effort, "low");
  assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(params.fallbacks, "default");
  assert.ok(params.system.includes("motcle-marche-fictif"));

  const opening = fakeClient({ message: " Bonjour " });
  assert.equal(await coachOpening(opening, context), "Bonjour");
  assert.equal(opening.requests[0].max_tokens, 4000);
});

test("coach : un refus du modèle lève ClaudeRefusalError", async () => {
  const context = buildCoachContext(cv, scoringContextFrom(cv, null, []), null);
  const { error } = console;
  console.error = () => {};
  try {
    await assert.rejects(coachBuilderCv(fakeClient(null, "refusal"), context, [], "x"), ClaudeRefusalError);
  } finally {
    console.error = error;
  }
});

// --- Isolation côté navigateur : consignes et logique du coach jamais dans un composant client ---

const SRC = fileURLToPath(new URL("../", import.meta.url));
/** Modules du coach (consignes, appels au modèle, vérification) : serveur seulement. */
const COACH_SERVER_MODULES = ["lib/coach-prompt.ts", "lib/coach-llm.ts", "lib/coach-context.ts", "lib/coach-turn.ts"];

/** Fichier de src/ visé par un import (alias @/ ou chemin relatif), null pour un paquet. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = SRC + spec.slice(2);
  else if (spec.startsWith(".")) base = fileURLToPath(new URL(spec, pathToFileURL(fromFile)));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Imports de valeurs d'un fichier (les imports de types seuls disparaissent à la compilation). */
function valueImports(text) {
  const specs = [];
  const pattern = /(?:^|\n)\s*(?:import|export)\s+(?!type[\s{])(?:[^;"']*?\sfrom\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of text.matchAll(pattern)) specs.push(m[1] ?? m[2]);
  return specs;
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("isolation : aucun composant client n'importe, même indirectement, les modules du coach", () => {
  const norm = (path) => path.replaceAll("\\", "/");
  const forbidden = new Set(COACH_SERVER_MODULES.map((m) => norm(SRC + m)));
  const clients = sourceFiles(SRC).filter((file) => /^\s*["']use client["']/.test(readFileSync(file, "utf8")));
  assert.ok(clients.length > 10, "composants clients trouvés");
  for (const client of clients) {
    // Parcours des imports depuis le composant ; une action serveur (« use server ») est une frontière.
    const seen = new Set([norm(client)]);
    const queue = [[client, [norm(client).slice(norm(SRC).length)]]];
    while (queue.length) {
      const [file, path] = queue.shift();
      for (const spec of valueImports(readFileSync(file, "utf8"))) {
        const target = resolveImport(spec, file);
        if (!target || seen.has(norm(target))) continue;
        seen.add(norm(target));
        const chain = [...path, norm(target).slice(norm(SRC).length)];
        assert.ok(!forbidden.has(norm(target)), `module du coach importé côté client : ${chain.join(" → ")}`);
        if (/^\s*["']use server["']/.test(readFileSync(target, "utf8"))) continue;
        queue.push([target, chain]);
      }
    }
  }
});

test("isolation : le détecteur d'imports voit les imports de valeurs, pas les imports de types", () => {
  const text = `import type { A } from "./a";\nimport { b, type C } from "@/lib/b";\nimport {\n  d,\n} from "../d";\nimport "./side";\nexport { e } from "./e";\nexport type { F } from "./f";\nconst g = await import("./g");`;
  assert.deepEqual(valueImports(text), ["@/lib/b", "../d", "./side", "./e", "./g"]);
});

// --- Isolation : aucune clé, aucune base, rien de Next dans les modules extraits ---

test("isolation : seul claude.ts (server-only) lit la clé et crée le client ; l'action garde quotas et décompte", () => {
  for (const path of ["./claude-models.ts", "./claude-structured.ts", "./coach-llm.ts", "./coach-turn.ts", "./coach-context.ts", "./cv-scoring-context.ts"]) {
    const text = source(path);
    assert.doesNotMatch(text, /ANTHROPIC_API_KEY|new Anthropic\(|supabase|from "next\/|server-only|getApplicationDetail|job-scraper/, path);
  }
  const claude = source("./claude.ts");
  assert.match(claude, /^import "server-only";/);
  assert.equal(claude.split("new Anthropic(").length - 1, 1);
  const action = source("../app/actions/cv-builder.ts");
  const refine = action.slice(action.indexOf("export async function refineBuilderCvAction"));
  assert.match(refine, /await coachGate\(\)/);
  assert.match(refine, /await runCoachTurn\(/);
  assert.equal(refine.split("recordAiUsage(").length - 1, 3);
  assert.doesNotMatch(refine, /checkProposal\(|applyCoachChange\(/);
});
