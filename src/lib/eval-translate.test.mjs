// Banc d'essai de la traduction (scripts/eval/translate.ts, lot traduction) : mêmes garde-fous que
// le banc du coach, vérifiés dans la source (le script n'est jamais lancé par les tests).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../scripts/eval/translate.ts", import.meta.url), "utf8");

test("banc de traduction : seule la clé du banc, plafond obligatoire, confirmation avant tout appel, appels comptés", () => {
  assert.match(source, /process\.env\.EVAL_ANTHROPIC_API_KEY/);
  assert.doesNotMatch(source, /process\.env\.ANTHROPIC_API_KEY|dotenv|\.env\.local/);
  assert.match(source, /if \(!options\.dry && !\(cap > 0\)\) throw new Error\("EVAL_MAX_COST_EUR/);
  const confirmAt = source.indexOf('await confirm("Lancer ce run payant ? (o/N) ")');
  const sdkAt = source.indexOf('await import("@anthropic-ai/sdk")');
  assert.ok(confirmAt > 0 && sdkAt > confirmAt, "confirmation avant la création du client réel");
  assert.equal((source.match(/meteredClient\(/g) ?? []).length, 2, "faux et vrai client comptés");
  assert.match(source, /runTranslation\(/);
  assert.match(source, /instanceof BudgetExceeded/);
});

test("banc de traduction : mêmes réglages d'appel que l'application", () => {
  const app = readFileSync(new URL("./claude.ts", import.meta.url), "utf8");
  assert.match(app, /effort: "medium",\s+maxTokens: 16000/);
  assert.match(source, /effort: "medium" as const, maxTokens: 16000/);
});
