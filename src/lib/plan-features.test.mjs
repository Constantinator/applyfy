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
const { FREE_FEATURES, LANDING_FREE_ANSWER, LANDING_FREE_FEATURES, LANDING_PREMIUM_FEATURES, PLAN_LIMITS_NOTE, PREMIUM_FEATURES, RESET_NOTE } =
  await import("./plan-features.ts");
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

test("les quotas gratuits viennent de la source des quotas", () => {
  const free = FREE_FEATURES.join("\n");
  assert.ok(free.includes(`${AI_MONTHLY_LIMITS.cvb_chat} adaptations de CV par mois`));
  assert.ok(free.includes(`${CVB_COACH_DAILY_LIMIT} questions au coach par jour`));
  assert.ok(free.includes(`${AI_MONTHLY_LIMITS.cvb_import} import de CV par mois`));
  assert.ok(free.includes(`${AI_MONTHLY_LIMITS.lettre} lettre de motivation par mois`));
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

test("Premium annonce la levée de la limite du coach", () => {
  assert.ok(PREMIUM_FEATURES.join("\n").includes(`Plus de limite de ${CVB_COACH_DAILY_LIMIT} questions par jour au coach`));
});

test("landing : mêmes quotas gratuits, dans les tarifs et la FAQ", () => {
  for (const text of [LANDING_FREE_FEATURES.join("\n"), LANDING_FREE_ANSWER]) {
    assert.ok(text.includes(`${AI_MONTHLY_LIMITS.cvb_chat} adaptations de CV par mois`));
    assert.ok(text.includes(`${CVB_COACH_DAILY_LIMIT} questions au coach par jour`));
    assert.ok(text.includes(`${AI_MONTHLY_LIMITS.cvb_import} import de CV par mois`));
    assert.doesNotMatch(text, /analyses? de CV|action IA par type/i);
  }
});

test("landing : Premium dit ce qui reste limité pour tous", () => {
  assert.ok(LANDING_PREMIUM_FEATURES.join("\n").includes(`${AI_DAILY_LIMIT} actions IA par jour`));
});

test("messages de limite : nombres lus aux constantes, limite commune rappelée", () => {
  for (const message of [LIMIT_REACHED_MESSAGE, CVB_COACH_DAILY_MESSAGE, CVB_CHAT_LIMIT_MESSAGE]) {
    assert.ok(message.includes(`${AI_DAILY_LIMIT} actions IA par jour`));
    assert.ok(message.includes(PREMIUM_PRICE_FROM_LABEL));
  }
  assert.ok(CVB_COACH_DAILY_MESSAGE.includes(`${CVB_COACH_DAILY_LIMIT} questions au coach`));
  assert.match(CVB_COACH_DAILY_MESSAGE, /minuit/);
  assert.ok(CVB_CHAT_LIMIT_MESSAGE.includes(`${AI_MONTHLY_LIMITS.cvb_chat} adaptations de CV`));
  assert.doesNotMatch(LIMIT_REACHED_LABEL, /essai/i);
});

test("remises à zéro : le coach par jour, le reste par mois", () => {
  assert.match(RESET_NOTE, /coach.*chaque jour.*minuit/);
  assert.match(RESET_NOTE, /1er de chaque mois/);
});
