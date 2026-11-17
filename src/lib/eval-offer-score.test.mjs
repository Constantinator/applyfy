// Banc d'essai du coach (lot score, S6) : mots-clés de l'offre dans le score des CV liés, refus
// enregistrés par le serveur, mots-clés refusés entrés quand même dans le CV. Le banc n'est jamais
// lancé par les tests : le tableau du rapport est vérifié sur des résultats fabriqués.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { offerScoreTable } = await import("../../scripts/eval/report.ts");

const shot = (found, target, points, allRefused = false) => ({ found, target, counted: target, points, allRefused });
const result = (id, offerScore) => ({ record: { scenarioId: id, repeat: 0 }, metrics: { offerFlow: { offerScore } } });

test("tableau : début → fin, refus du serveur, refusé puis écrit ; tous retirés à 12/20", () => {
  const table = offerScoreTable([
    result("O03-ecart-trop-grand", { start: shot(0, 5, 0), end: shot(0, 4, 0), refused: ["Java"], refusedThenWritten: [] }),
    result("O02-finance-vers-tech", { start: shot(0, 5, 0), end: shot(0, 0, 12, true), refused: ["Node.js", "Docker"], refusedThenWritten: ["Docker"] }),
    result("L01-parcours-finance", null),
  ]);
  assert.match(table, /\| O03-ecart-trop-grand \(0\) \| 0\/5 \(0\/20\) \| 0\/4 \(0\/20\) \| Java \| — \|/);
  assert.match(table, /\| O02-finance-vers-tech \(0\) \| 0\/5 \(0\/20\) \| tous retirés \(12\/20\) \| Node\.js, Docker \| Docker \|/);
  assert.doesNotMatch(table, /L01/);
  assert.match(offerScoreTable([result("L01", null)]), /Aucun CV lié/);
});

test("le banc enregistre les refus comme l'action, avant le score de l'échange", () => {
  const source = readFileSync(new URL("../../scripts/eval/conversation.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("offerRefusals(detail, turns, request)") < source.indexOf("const built = contextFor(current, request, turns)"));
  assert.match(source, /let detail = offer \? structuredClone\(offer\.detail\) : null/);
});
