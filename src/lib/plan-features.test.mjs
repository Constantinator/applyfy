// Promesses de prix : listes d'avantages et textes publics. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { FREE_FEATURES, LANDING_FREE_ANSWER, PLAN_LIMITS_NOTE, PREMIUM_FEATURES, QUARTERLY_FEATURES, RESET_NOTE } = await import("./plan-features.ts");
const {
  AI_DAILY_LIMIT,
  AI_MONTHLY_LIMITS,
  AI_RATE_LIMIT_PER_MINUTE,
  CVB_CHAT_LIMIT_MESSAGE,
  CVB_COACH_DAILY_LIMIT,
  CVB_COACH_DAILY_MESSAGE,
  LIMIT_REACHED_LABEL,
  LIMIT_REACHED_MESSAGE,
  PREMIUM_PRICE_FROM_LABEL,
} = await import("./ai-usage-limits.ts");
const { CV_BUILDER_MAX } = await import("./cv-builder-types.ts");
const { buildFreePlanLines } = await import("./free-plan.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Source sans commentaires (les « // » des URL sont gardés). */
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

/** Fichiers dont les textes affichés promettent quelque chose sur le prix ou les limites. */
const PROMISE_FILES = [
  "lib/plan-features.ts",
  "app/(app)/premium/page.tsx",
  "app/(app)/profil/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "components/onboarding/welcome-premium-modal.tsx",
  "components/beta/beta-join-dialog.tsx",
  "app/page.tsx",
  "lib/ai-usage-limits.ts",
  "components/application/refine-chat.tsx",
  "components/usage/usage-limit-banner.tsx",
  "components/cv-builder/cv-import-flow.tsx",
  "app/(legal)/cgu/page.tsx",
  "lib/lumeo-knowledge.ts",
];

test("aucune promesse « illimité » ou « sans limite » hors commentaires", () => {
  const found = PROMISE_FILES.filter((path) => /illimit|sans limite/i.test(withoutComments(read(path))));
  assert.deepEqual(found, []);
});

test("le filtre des commentaires ne cache pas un vrai texte", () => {
  assert.match(withoutComments('const a = "Accès illimité"; // note'), /illimit/);
  assert.doesNotMatch(withoutComments("// accès illimité\n/* illimité */\nconst a = 1;"), /illimit/);
  assert.match(withoutComments('const url = "https://a.fr/illimite";'), /illimit/);
});

test("les listes ne contiennent aucun nombre écrit en dur", () => {
  // « 1er de chaque mois » est une date et « n > 1 » la règle du pluriel, pas des quotas.
  assert.doesNotMatch(withoutComments(read("lib/plan-features.ts")).replace(/1er|n > 1/g, ""), /\d/);
});

test("listes courtes, groupées par fonctionnalité : 5 lignes gratuites ; Premium : le gratuit, puis 3 lignes", () => {
  assert.equal(FREE_FEATURES.length, 5);
  assert.equal(PREMIUM_FEATURES.length, 4);
  assert.equal(PREMIUM_FEATURES[0], "Tout le plan gratuit");
});

test("carte 3 mois : la landing lit sa liste dans la source unique", () => {
  assert.match(read("app/page.tsx"), /\{QUARTERLY_FEATURES\}/);
  assert.ok(QUARTERLY_FEATURES.length > 0);
});

test("les quotas gratuits viennent de la source des quotas", () => {
  assert.deepEqual(FREE_FEATURES.slice(0, 3), [
    `Lumeo : ${CVB_COACH_DAILY_LIMIT} questions par jour`,
    `Adaptation de CV : ${AI_MONTHLY_LIMITS.cvb_chat} par mois`,
    `Import de CV : ${AI_MONTHLY_LIMITS.cvb_import} par mois`,
  ]);
});

test("« par outil » reste vrai : les quatre compteurs de lettre et de résumé ont la même valeur", () => {
  const { lettre, affinage_lettre, resume_offre, resume_recherche } = AI_MONTHLY_LIMITS;
  assert.equal(new Set([lettre, affinage_lettre, resume_offre, resume_recherche]).size, 1);
  assert.equal(FREE_FEATURES[3], `Lettres de motivation et résumés d'offre : ${lettre} par mois par outil`);
});

test("limites communes : 50 actions, 10 requêtes, 20 CV, lues aux constantes", () => {
  for (const limit of [AI_DAILY_LIMIT, AI_RATE_LIMIT_PER_MINUTE, CV_BUILDER_MAX]) {
    assert.ok(PLAN_LIMITS_NOTE.includes(String(limit)));
  }
});

test("plus de limite inventée ni de fonctionnalité sans interface", () => {
  const all = [...FREE_FEATURES, ...PREMIUM_FEATURES].join("\n");
  assert.doesNotMatch(all, /CV ouvert|analyses? de CV|éditeur/i);
});

test("Premium annonce la levée de la limite de Lumeo", () => {
  assert.equal(PREMIUM_FEATURES[1], `Lumeo : plus de limite de ${CVB_COACH_DAILY_LIMIT} questions par jour`);
});

test("vocabulaire : « Lumeo » dans la carte du plan, le message du jour, /premium et la bienvenue Premium", () => {
  const labels = buildFreePlanLines({ adaptations: 0, coachToday: 0, imports: 0 }).map((line) => line.label);
  assert.ok(labels.includes("Questions à Lumeo aujourd'hui"));
  assert.ok(CVB_COACH_DAILY_MESSAGE.includes(`tes ${CVB_COACH_DAILY_LIMIT} questions à Lumeo`));
  assert.match(read("app/(app)/dashboard/page.tsx"), /la limite de Lumeo sont levés/);
  assert.match(read("app/(app)/premium/page.tsx"), /la limite de Lumeo, /);
  assert.match(read("components/onboarding/welcome-premium-modal.tsx"), /la limite de Lumeo\./);
  for (const path of ["app/(app)/dashboard/page.tsx", "app/(app)/premium/page.tsx", "components/onboarding/welcome-premium-modal.tsx"]) {
    assert.doesNotMatch(read(path), /Chat IA/, path);
  }
  assert.doesNotMatch(labels.join("\n") + CVB_COACH_DAILY_MESSAGE, /coach/);
});

test("source unique : /premium et la landing affichent les mêmes listes et les mêmes notes", () => {
  for (const path of ["app/(app)/premium/page.tsx", "app/page.tsx"]) {
    const source = read(path);
    for (const name of ["FREE_FEATURES", "PREMIUM_FEATURES", "PLAN_LIMITS_NOTE", "RESET_NOTE"]) {
      assert.match(source, new RegExp(`\\{${name}\\}`), `${name} absent de ${path}`);
    }
  }
});

test("FAQ de la landing : mêmes quotas, sans fonctionnalité disparue", () => {
  assert.ok(LANDING_FREE_ANSWER.includes(`${CVB_COACH_DAILY_LIMIT} questions par jour à Lumeo`));
  assert.ok(LANDING_FREE_ANSWER.includes(`${AI_MONTHLY_LIMITS.cvb_chat} adaptations et ${AI_MONTHLY_LIMITS.cvb_import} import de CV par mois`));
  assert.doesNotMatch(LANDING_FREE_ANSWER, /analyses? de CV|action IA par type/i);
});

test("messages de limite : nombres lus aux constantes, limite commune rappelée", () => {
  for (const message of [LIMIT_REACHED_MESSAGE, CVB_COACH_DAILY_MESSAGE, CVB_CHAT_LIMIT_MESSAGE]) {
    assert.ok(message.includes(`${AI_DAILY_LIMIT} actions IA par jour`));
    assert.ok(message.includes(PREMIUM_PRICE_FROM_LABEL));
  }
  assert.match(CVB_COACH_DAILY_MESSAGE, /minuit/);
  assert.ok(CVB_CHAT_LIMIT_MESSAGE.includes(`${AI_MONTHLY_LIMITS.cvb_chat} adaptations de CV`));
  assert.doesNotMatch(LIMIT_REACHED_LABEL, /essai/i);
});

test("remises à zéro : Lumeo par jour, le reste par mois", () => {
  assert.match(RESET_NOTE, /Lumeo.*chaque jour.*minuit/);
  assert.match(RESET_NOTE, /1er de chaque mois/);
});
