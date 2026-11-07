// Carte « Ton plan gratuit » du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { buildFreePlanLines, countFreePlanUsage, isFreeAccount } = await import("./free-plan.ts");
const { AI_MONTHLY_LIMITS, CVB_COACH_DAILY_LIMIT } = await import("./ai-usage-limits.ts");

const NOW = new Date("2026-11-06T12:00:00Z");
const row = (kind, createdAt = "2026-11-06T09:00:00Z") => ({ kind, created_at: createdAt });

test("gratuit : ni Premium, ni beta actif, ni admin", () => {
  const base = { premium: false, betaActive: false, admin: false };
  assert.equal(isFreeAccount(base), true);
  assert.equal(isFreeAccount({ ...base, premium: true }), false);
  assert.equal(isFreeAccount({ ...base, betaActive: true }), false);
  assert.equal(isFreeAccount({ ...base, admin: true }), false);
});

test("seuls les trois compteurs du plan sont lus", () => {
  const rows = [row("cvb_chat"), row("cvb_chat"), row("cvb_import"), row("cvb_coach"), row("lettre"), row("resume_offre")];
  assert.deepEqual(countFreePlanUsage(rows, NOW), { adaptations: 2, coachToday: 1, imports: 1 });
  assert.deepEqual(countFreePlanUsage([], NOW), { adaptations: 0, coachToday: 0, imports: 0 });
});

test("adaptations et imports : tout le mois ; coach : le jour en cours seulement", () => {
  const earlier = "2026-11-02T10:00:00Z";
  const rows = [row("cvb_chat", earlier), row("cvb_import", earlier), row("cvb_coach", earlier), row("cvb_coach")];
  assert.deepEqual(countFreePlanUsage(rows, NOW), { adaptations: 1, coachToday: 1, imports: 1 });
});

test("coach : le jour change à minuit, heure de Paris", () => {
  const justAfterMidnight = new Date("2026-11-05T23:30:00Z"); // 00h30 le 6 à Paris
  const rows = [row("cvb_coach", "2026-11-05T22:30:00Z"), row("cvb_coach", "2026-11-05T23:10:00Z")];
  // 23h30 le 5 à Paris, puis 00h10 le 6.
  assert.equal(countFreePlanUsage(rows, justAfterMidnight).coachToday, 1);
});

test("les limites viennent de la source des quotas", () => {
  const lines = buildFreePlanLines({ adaptations: 0, coachToday: 0, imports: 0 });
  assert.deepEqual(lines.map((l) => l.limit), [AI_MONTHLY_LIMITS.cvb_chat, CVB_COACH_DAILY_LIMIT, AI_MONTHLY_LIMITS.cvb_import]);
});

test("valeurs et limite atteinte", () => {
  const [adaptations, coach, imports] = buildFreePlanLines({ adaptations: 1, coachToday: CVB_COACH_DAILY_LIMIT, imports: 0 });
  assert.deepEqual([adaptations.used, adaptations.percent, adaptations.reached], [1, 50, false]);
  assert.deepEqual([coach.used, coach.percent, coach.reached], [CVB_COACH_DAILY_LIMIT, 100, true]);
  assert.deepEqual([imports.used, imports.percent, imports.reached], [0, 0, false]);
});

test("dépassement : affichage et barre plafonnés à la limite", () => {
  const [adaptations] = buildFreePlanLines({ adaptations: AI_MONTHLY_LIMITS.cvb_chat + 3, coachToday: 0, imports: 0 });
  assert.deepEqual(
    [adaptations.used, adaptations.percent, adaptations.reached],
    [AI_MONTHLY_LIMITS.cvb_chat, 100, true],
  );
});
