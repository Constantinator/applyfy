// Ce que Lumeo sait de l'offre et de l'appli. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { DEFAULT_PLAN_SOURCE, LUMEO_APP_GUIDE, lumeoPlanKind, lumeoPlansBlock, lumeoUserPlanBlock } = await import("./lumeo-knowledge.ts");
const { FREE_FEATURES, PLAN_LIMITS_NOTE, PLAN_PRICES, PREMIUM_FEATURES, QUARTERLY_FEATURES, RESET_NOTE } = await import("./plan-features.ts");
const {
  AI_DAILY_LIMIT,
  AI_MONTHLY_LIMITS,
  AI_RATE_LIMIT_PER_MINUTE,
  AI_USAGE_KINDS,
  CVB_COACH_DAILY_LIMIT,
  PREMIUM_PRICE_MONTHLY,
  PREMIUM_PRICE_QUARTERLY,
} = await import("./ai-usage-limits.ts");
const { CV_BUILDER_MAX, CV_IMPORT_MAX_LABEL, CV_TEMPLATES } = await import("./cv-builder-types.ts");
const { BETA_PREMIUM_UNTIL_LABEL } = await import("./beta-rules.ts");
const { LUMEO_SYSTEM } = await import("./lumeo-system.ts");
const { buildLumeoContext } = await import("./lumeo-panel.ts");

const source = readFileSync(new URL("./lumeo-knowledge.ts", import.meta.url), "utf8");
const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Utilisation du mois : `used` par type, quotas du plan gratuit (ou aucun pour Premium). */
function counts(used = {}, premium = false) {
  return Object.fromEntries(AI_USAGE_KINDS.map((k) => [k, { used: used[k] ?? 0, limit: premium ? null : AI_MONTHLY_LIMITS[k] }]));
}

// --- offre (source : plan-features) -------------------------------------------

test("offre : construite depuis plan-features (listes, prix, limites, beta)", () => {
  const block = lumeoPlansBlock();
  for (const line of [...FREE_FEATURES, ...PREMIUM_FEATURES, ...QUARTERLY_FEATURES]) assert.ok(block.includes(`- ${line}`), line);
  assert.ok(block.includes(PLAN_LIMITS_NOTE));
  assert.ok(block.includes(RESET_NOTE));
  assert.ok(block.includes(`${PREMIUM_PRICE_MONTHLY} € par mois`));
  assert.ok(block.includes(`${PREMIUM_PRICE_QUARTERLY} € tous les`));
  assert.ok(block.includes(`${PLAN_PRICES.quarterlyPerMonth} € par mois`));
  assert.ok(block.includes(BETA_PREMIUM_UNTIL_LABEL));
  for (const limit of [AI_DAILY_LIMIT, AI_RATE_LIMIT_PER_MINUTE, CV_BUILDER_MAX]) assert.ok(block.includes(String(limit)));
  assert.match(block, /\/premium/);
});

test("offre : un changement de prix ou de quota dans la source se retrouve dans le bloc", () => {
  const changed = {
    ...DEFAULT_PLAN_SOURCE,
    prices: { ...DEFAULT_PLAN_SOURCE.prices, monthly: 15, quarterly: 30, quarterlyPerMonth: 10 },
    free: ["Lumeo : 7 questions par jour", ...DEFAULT_PLAN_SOURCE.free.slice(1)],
  };
  const block = lumeoPlansBlock(changed);
  assert.ok(block.includes("15 € par mois"));
  assert.ok(block.includes("30 € tous les 3 mois (soit 10 € par mois)"));
  assert.ok(block.includes("- Lumeo : 7 questions par jour"));
  assert.ok(!block.includes(`${PREMIUM_PRICE_MONTHLY} € par mois, sans engagement`));
});

test("aucun nombre écrit en dur dans lumeo-knowledge.ts : tout vient des constantes", () => {
  // Seules exceptions : les zéros des calculs de reste (jamais négatif), pas des quotas.
  const code = withoutComments(source).replace(/Math\.max\(0, /g, "").replace(/\?\? 0/g, "");
  assert.doesNotMatch(code, /\d/);
});

test("ni « illimité » ni « sans limite » dans ce que sait Lumeo", () => {
  const all = [
    lumeoPlansBlock(),
    LUMEO_APP_GUIDE,
    lumeoUserPlanBlock({ kind: "premium", counts: counts({}, true), usedToday: 3, coachToday: 3 }),
    lumeoUserPlanBlock({ kind: "beta", counts: counts({}, true), usedToday: 3, coachToday: 3 }),
    lumeoUserPlanBlock({ kind: "gratuit", counts: counts(), usedToday: 3, coachToday: 3 }),
  ].join("\n");
  assert.doesNotMatch(all, /illimit|sans limite/i);
});

// --- plan et quotas restants ------------------------------------------------------

test("plan : beta active d'abord, puis Premium, sinon gratuit", () => {
  assert.equal(lumeoPlanKind({ premium: true, betaActive: true }), "beta");
  assert.equal(lumeoPlanKind({ premium: true, betaActive: false }), "premium");
  assert.equal(lumeoPlanKind({ premium: false, betaActive: false }), "gratuit");
});

test("quotas restants : compte gratuit", () => {
  const block = lumeoUserPlanBlock({ kind: "gratuit", counts: counts({ cvb_chat: 1, cvb_import: 1, lettre: 0 }), usedToday: 4, coachToday: 3 });
  assert.match(block, /Plan : Gratuit/);
  assert.ok(block.includes(`Questions à Lumeo aujourd'hui : ${CVB_COACH_DAILY_LIMIT - 3} restante(s) sur ${CVB_COACH_DAILY_LIMIT}`));
  assert.ok(block.includes(`Actions IA aujourd'hui (tous types) : ${AI_DAILY_LIMIT - 4} restante(s) sur ${AI_DAILY_LIMIT}`));
  assert.ok(block.includes(`chat : adaptations du CV : ${AI_MONTHLY_LIMITS.cvb_chat - 1} restant(s) sur ${AI_MONTHLY_LIMITS.cvb_chat}`));
  assert.ok(block.includes(`imports de CV : 0 restant(s) sur ${AI_MONTHLY_LIMITS.cvb_import}`));
  assert.ok(block.includes(`Lettres de motivation : ${AI_MONTHLY_LIMITS.lettre} restant(s) sur ${AI_MONTHLY_LIMITS.lettre}`));
  // Le coach n'a pas de quota mensuel affiché (seulement celui du jour).
  assert.doesNotMatch(block, /échanges sans modification/);
});

test("quotas du mois : seulement ceux de l'offre, jamais d'ancienne fonction sans interface", () => {
  const block = lumeoUserPlanBlock({ kind: "gratuit", counts: counts(), usedToday: 1, coachToday: 1 });
  assert.equal((block.match(/^- /gm) ?? []).length, 6);
  assert.doesNotMatch(block, /CV ouvert|analyses? de CV|Affiner avec l'IA » — CV|points d'expérience|résumés de profil/i);
  assert.match(block, /imports de CV/);
  assert.match(block, /Lettres de motivation/);
  assert.match(block, /Résumés d'offre/);
});

test("quotas restants : jamais négatifs", () => {
  const block = lumeoUserPlanBlock({ kind: "gratuit", counts: counts({ cvb_chat: 9 }), usedToday: 80, coachToday: 9 });
  assert.ok(block.includes(`0 restante(s) sur ${CVB_COACH_DAILY_LIMIT}`));
  assert.ok(block.includes(`0 restante(s) sur ${AI_DAILY_LIMIT}`));
  assert.doesNotMatch(block, /-\d/);
});

test("quotas restants : Premium et beta (pas de quota mensuel, plafond commun du jour)", () => {
  const premium = lumeoUserPlanBlock({ kind: "premium", counts: counts({}, true), usedToday: 10, coachToday: 8 });
  assert.match(premium, /Plan : Premium/);
  assert.match(premium, /pas de quota mensuel/);
  assert.ok(premium.includes(`${AI_DAILY_LIMIT - 10} restante(s) sur ${AI_DAILY_LIMIT}`));
  assert.doesNotMatch(premium, /restante\(s\) sur ${CVB_COACH_DAILY_LIMIT} après/);
  const beta = lumeoUserPlanBlock({ kind: "beta", counts: counts({}, true), usedToday: 0, coachToday: 0 });
  assert.match(beta, /Beta testeur/);
  assert.ok(beta.includes(BETA_PREMIUM_UNTIL_LABEL));
});

test("plan de l'utilisateur : aucune donnée personnelle, seulement le plan et des nombres", () => {
  const block = lumeoUserPlanBlock({ kind: "gratuit", counts: counts(), usedToday: 1, coachToday: 1 });
  assert.doesNotMatch(block, /@|Stripe|cus_|sub_|prénom/i);
});

// --- fiche des fonctions ---------------------------------------------------------

test("fiche de l'appli : les 8 fonctions, chiffres lus aux constantes", () => {
  for (const name of ["CV Builder", "Import de CV", "Adaptation à une offre", "Lettre de motivation", "Résumé d'offre", "Relances et rappels", "Objectif de la semaine", "Extension Chrome"]) {
    assert.ok(LUMEO_APP_GUIDE.includes(`- ${name}`), name);
  }
  assert.ok(LUMEO_APP_GUIDE.includes(`${CV_TEMPLATES.length} modèles`));
  assert.ok(LUMEO_APP_GUIDE.includes(`${CV_IMPORT_MAX_LABEL} maximum`));
  assert.ok(LUMEO_APP_GUIDE.length < 3000, "fiche courte");
});

// --- branchement et prompt ---------------------------------------------------------

test("contexte : blocs offre, plan et fonctions quand la connaissance est fournie", () => {
  const knowledge = { plans: lumeoPlansBlock(), userPlan: "Plan : Gratuit.", guide: LUMEO_APP_GUIDE };
  const base = { location: { page: "dashboard", applicationId: null }, firstName: null, cv: null, applications: [], offer: null, now: new Date() };
  const context = buildLumeoContext({ ...base, knowledge });
  for (const tag of ["offre_applyfy", "ton_plan", "fonctions_applyfy"]) assert.equal(context.split(`<${tag}>`).length - 1, 1, tag);
  assert.doesNotMatch(buildLumeoContext(base), /offre_applyfy/);
});

test("prompt système : ne citer que ce qui figure dans les blocs, informer sans insister", () => {
  assert.match(LUMEO_SYSTEM, /<offre_applyfy>, <ton_plan> et <fonctions_applyfy>/);
  assert.match(LUMEO_SYSTEM, /je ne sais pas, regarde la page \[Premium\]\(\/premium\)/);
  assert.match(LUMEO_SYSTEM, /sans insister/);
  assert.match(LUMEO_SYSTEM, /si le plan gratuit suffit/);
});
