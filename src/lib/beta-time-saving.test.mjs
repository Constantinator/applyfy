// Temps gagné par candidature (bêta). Lancé par `npm test` (Node 22.18 ou plus).
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
const {
  TIME_SAVING_MAX_MINUTES,
  TIME_SAVING_MIN_MINUTES,
  TIME_SAVING_PUBLIC_MIN_RESPONSES,
  floorPercent,
  gainPercent,
  parseTimeSaving,
  timeSavingEligibility,
  timeSavingFlags,
  timeSavingStats,
} = await import("./beta-time-saving.ts");
const { BETA_TIME_TEXTS } = await import("./lumeo-texts.ts");
const { isMissingTable } = await import("./optional-columns.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("validation : minutes entières de 1 à 600, « avant » à 0 refusé", () => {
  assert.deepEqual(parseTimeSaving({ before: "60", after: "24" }), { before: 60, after: 24 });
  assert.deepEqual(parseTimeSaving({ before: 1, after: 600 }), { before: 1, after: 600 });
  assert.deepEqual(parseTimeSaving({ before: " 45 ", after: "45" }), { before: 45, after: 45 });
  assert.equal(parseTimeSaving({ before: "0", after: "10" }), "Le temps avant Applyfy doit être d'au moins 1 minute.");
  assert.equal(parseTimeSaving({ before: "10", after: "0" }), "Le temps avec Applyfy doit être d'au moins 1 minute.");
  for (const bad of ["", "12.5", "-3", "abc", "1e2", null, undefined, 12.5]) {
    assert.equal(parseTimeSaving({ before: bad, after: "10" }), "Indique un nombre entier de minutes.", String(bad));
    assert.equal(parseTimeSaving({ before: "10", after: bad }), "Indique un nombre entier de minutes.", String(bad));
  }
  assert.equal(parseTimeSaving({ before: "601", after: "10" }), "600 minutes maximum (10 h).");
  assert.equal(parseTimeSaving({ before: "60", after: "601" }), "600 minutes maximum (10 h).");
  assert.equal(parseTimeSaving(null), "Indique un nombre entier de minutes.");
});

test("gain = 1 - après / avant, arrondi à l'entier inférieur", () => {
  assert.equal(gainPercent({ before: 60, after: 24 }), 60);
  assert.equal(floorPercent(gainPercent({ before: 60, after: 20 })), 66);
  assert.equal(floorPercent(gainPercent({ before: 60, after: 60 })), 0);
  assert.equal(floorPercent(gainPercent({ before: 30, after: 40 })), -34);
  // Pas d'erreur de virgule flottante juste sous un entier.
  assert.equal(floorPercent(29.999999999999996), 30);
  assert.equal(floorPercent(70.5), 70);
});

test("statistiques : moyenne et médiane de toutes les réponses, aucune exclusion", () => {
  assert.deepEqual(timeSavingStats([]), { count: 0, meanPercent: null, medianPercent: null, publicReady: false });
  // Gains : 50, 0, -100 → moyenne -16,7 (inférieur : -17), médiane 0.
  const stats = timeSavingStats([
    { before: 60, after: 30 },
    { before: 30, after: 30 },
    { before: 20, after: 40 },
  ]);
  assert.deepEqual(stats, { count: 3, meanPercent: -17, medianPercent: 0, publicReady: false });
  // Nombre pair : médiane = moyenne des deux valeurs centrales (50 et 75 → 62,5 → 62).
  const even = timeSavingStats([
    { before: 100, after: 50 },
    { before: 100, after: 25 },
    { before: 100, after: 90 },
    { before: 100, after: 10 },
  ]);
  assert.equal(even.medianPercent, 62);
  assert.equal(even.meanPercent, 56); // (50 + 75 + 10 + 90) / 4 = 56,25
});

test(`chiffre public : seulement à partir de ${TIME_SAVING_PUBLIC_MIN_RESPONSES} réponses`, () => {
  assert.equal(TIME_SAVING_PUBLIC_MIN_RESPONSES, 10);
  const answers = (n) => Array.from({ length: n }, () => ({ before: 60, after: 30 }));
  assert.equal(timeSavingStats(answers(9)).publicReady, false);
  assert.equal(timeSavingStats(answers(10)).publicReady, true);
});

test("signalements : gain négatif, nul, très élevé, temps « avant » très long", () => {
  assert.deepEqual(timeSavingFlags({ before: 30, after: 40 }), ["negatif"]);
  assert.deepEqual(timeSavingFlags({ before: 30, after: 30 }), ["nul"]);
  assert.deepEqual(timeSavingFlags({ before: 100, after: 10 }), ["tres_eleve"]);
  assert.deepEqual(timeSavingFlags({ before: 100, after: 11 }), []);
  assert.deepEqual(timeSavingFlags({ before: 300, after: 20 }), ["tres_eleve", "avant_long"]);
  assert.deepEqual(timeSavingFlags({ before: 60, after: 30 }), []);
});

test("peut répondre : actif ou suspendu, avec au moins une vraie candidature", () => {
  assert.equal(timeSavingEligibility("active", 1), "ok");
  assert.equal(timeSavingEligibility("suspended", 3), "ok");
  assert.equal(timeSavingEligibility("active", 0), "sans_candidature");
  assert.equal(timeSavingEligibility("suspended", 0), "sans_candidature");
  assert.equal(timeSavingEligibility("removed", 5), "retire");
});

test("table absente : 42P01 (Postgres) ou PGRST205 (PostgREST)", () => {
  assert.equal(isMissingTable({ code: "42P01", message: 'relation "beta_time_savings" does not exist' }), true);
  assert.equal(isMissingTable({ code: "PGRST205", message: "Could not find the table" }), true);
  assert.equal(isMissingTable({ code: "42501", message: "permission denied" }), false);
  assert.equal(isMissingTable(null), false);
});

test("migration 0044 : mêmes bornes et mêmes conditions que le code", () => {
  const sql = read("../supabase/migrations/0044_beta_time_saving.sql");
  const bounds = `between ${TIME_SAVING_MIN_MINUTES} and ${TIME_SAVING_MAX_MINUTES}`;
  assert.match(sql, new RegExp(`minutes_before smallint not null check \\(minutes_before ${bounds}\\)`));
  assert.match(sql, new RegExp(`minutes_after smallint not null check \\(minutes_after ${bounds}\\)`));
  assert.match(sql, new RegExp(`p_before not ${bounds} or p_after not ${bounds}`));
  assert.match(sql, /v_status not in \('active', 'suspended'\)/);
  assert.match(sql, /is_example = false/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on function save_beta_time_saving\(integer, integer\) from public, anon;/);
  assert.match(sql, /Retour arrière/);
  // Les « drop » ne figurent qu'en commentaire (retour arrière), jamais exécutés.
  assert.doesNotMatch(sql, /^\s*drop (table|function)/m);
});

test("textes : tutoiement, sans emoji, ni « illimité » ni « sans limite »", () => {
  const texts = [
    ...Object.values(BETA_TIME_TEXTS).filter((value) => typeof value === "string"),
    BETA_TIME_TEXTS.gain(60),
  ].join("\n");
  assert.equal(BETA_TIME_TEXTS.needApplication, "Ajoute d'abord une candidature pour répondre.");
  assert.equal(BETA_TIME_TEXTS.gain(60), "Tu gagnes environ 60 % de temps par candidature.");
  assert.doesNotMatch(texts, /\bvous\b|\bvotre\b/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
  const files = [
    "lib/lumeo-texts.ts",
    "lib/beta-time-saving.ts",
    "components/beta/beta-time-saving-form.tsx",
    "app/(app)/beta/page.tsx",
    "app/(app)/admin/beta/page.tsx",
  ];
  for (const path of files) assert.doesNotMatch(read(path), /illimit|sans limite/i, path);
});

test("aucun chiffre de gain écrit à la main : le pourcentage vient toujours du calcul", () => {
  for (const path of ["components/beta/beta-time-saving-form.tsx", "lib/lumeo-texts.ts"]) {
    assert.doesNotMatch(read(path), /\d+\s?% de temps/, path);
  }
});
