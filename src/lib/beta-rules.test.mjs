// Rapport beta attendu (tableau de bord). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

const { BETA_PREMIUM_UNTIL, isBetaOfferOpen, pendingBetaReport } = await import("./beta-rules.ts");

const JOINED = "2026-11-01T10:00:00Z";
const beta = (fields = {}) => ({ status: "active", joinedAt: JOINED, reports: [], ...fields });

test("offre beta : proposée jusqu'au dernier jour inclus, plus après", () => {
  assert.equal(isBetaOfferOpen(new Date(`${BETA_PREMIUM_UNTIL}T23:00:00Z`)), true);
  assert.equal(isBetaOfferOpen(new Date(new Date(`${BETA_PREMIUM_UNTIL}T23:00:00Z`).getTime() + 3_600_000)), false);
});

test("rapport ouvert et non envoyé : attendu, avec sa date limite à l'heure de Paris", () => {
  const pending = pendingBetaReport(beta(), new Date("2026-11-03T10:00:00Z"));
  assert.equal(pending?.number, 1);
  assert.equal(pending?.dueLabel, "8 novembre");
});

test("date limite tard le soir en UTC : jour de Paris", () => {
  const pending = pendingBetaReport(beta({ joinedAt: "2026-11-01T23:30:00Z" }), new Date("2026-11-03T10:00:00Z"));
  assert.equal(pending?.dueLabel, "9 novembre");
});

test("rapport déjà envoyé : passe au suivant seulement quand il est ouvert", () => {
  const reports = [{ number: 1 }];
  assert.equal(pendingBetaReport(beta({ reports }), new Date("2026-11-03T10:00:00Z")), null);
  assert.equal(pendingBetaReport(beta({ reports }), new Date("2026-11-09T10:00:00Z"))?.number, 2);
});

test("rapport en retard : plus attendu (il ne peut plus être envoyé)", () => {
  assert.equal(pendingBetaReport(beta({ reports: [{ number: 1 }] }), new Date("2026-12-20T10:00:00Z")), null);
});

test("beta testeur suspendu ou absent : rien", () => {
  assert.equal(pendingBetaReport(beta({ status: "suspended" }), new Date("2026-11-03T10:00:00Z")), null);
  assert.equal(pendingBetaReport(null, new Date("2026-11-03T10:00:00Z")), null);
});
