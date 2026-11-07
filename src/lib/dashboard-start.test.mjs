// « Pour bien démarrer » du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { buildStartSteps, canInstallExtension, isNewAccount, startProgress, withExtensionStep } = await import(
  "./dashboard-start.ts"
);

const app = (fields = {}) => ({
  id: "a1",
  company: "Acme",
  position: "Analyste",
  location: null,
  offer_url: null,
  contact_name: null,
  contact_email: null,
  status: "brouillon",
  applied_at: null,
  last_contact_at: null,
  created_at: "2026-11-01T10:00:00Z",
  is_example: false,
  ...fields,
});
const byId = (steps) => Object.fromEntries(steps.map((step) => [step.id, step]));

test("compte nouveau : moins de 30 jours, jamais si la date est inconnue", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  assert.equal(isNewAccount("2026-10-08T12:00:01Z", now), true);
  assert.equal(isNewAccount("2026-10-07T12:00:00Z", now), false);
  assert.equal(isNewAccount(null, now), false);
  assert.equal(isNewAccount("n'importe quoi", now), false);
});

test("la candidature exemple ne valide aucune étape", () => {
  const steps = byId(buildStartSteps(null, [app({ is_example: true, status: "en_attente", applied_at: "2026-11-01" })]));
  assert.equal(steps.candidature.done, false);
  assert.equal(steps.envoi.done, false);
  assert.equal(steps.envoi.href, "/candidatures/nouvelle");
});

test("score : validé à partir de READY_SCORE, lien vers le coach du CV", () => {
  assert.equal(byId(buildStartSteps({ id: "c1", score: 79 }, [])).score.done, false);
  assert.equal(byId(buildStartSteps({ id: "c1", score: 79 }, [])).score.href, "/cv-builder/c1?onglet=chat");
  assert.equal(byId(buildStartSteps({ id: "c1", score: 80 }, [])).score.done, true);
  assert.equal(byId(buildStartSteps(null, [])).score.href, "/cv-builder");
});

test("envoi : un brouillon ne compte pas et son lien mène à sa fiche", () => {
  const steps = byId(buildStartSteps(null, [app({ id: "d1" })]));
  assert.equal(steps.candidature.done, true);
  assert.equal(steps.envoi.done, false);
  assert.equal(steps.envoi.href, "/candidatures/d1");
  assert.equal(byId(buildStartSteps(null, [app({ status: "envoyee" })])).envoi.done, true);
});

test("extension : omise si impossible à installer, validée si installée", () => {
  const steps = buildStartSteps(null, []);
  assert.equal(withExtensionStep(steps, "unavailable").length, 4);
  assert.equal(withExtensionStep(steps, "missing").at(-1).done, false);
  assert.equal(withExtensionStep(steps, "missing").at(-1).href, "/extension");
  assert.equal(withExtensionStep(steps, "installed").at(-1).done, true);
});

test("navigateurs où l'extension peut s'installer", () => {
  const windowsChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0 Safari/537.36";
  const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/142.0 Mobile Safari/537.36";
  const safari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  const firefox = "Mozilla/5.0 (Windows NT 10.0; rv:145.0) Gecko/20100101 Firefox/145.0";
  assert.equal(canInstallExtension(windowsChrome), true);
  assert.equal(canInstallExtension(android), false);
  assert.equal(canInstallExtension(safari), false);
  assert.equal(canInstallExtension(firefox), false);
});

test("progression : complète quand toutes les étapes sont faites", () => {
  const done = { id: "a", label: "", href: "/", done: true };
  const todo = { ...done, id: "b", done: false };
  assert.deepEqual(startProgress([done, todo]), { done: 1, total: 2, percent: 50, complete: false });
  assert.equal(startProgress([done]).complete, true);
});
