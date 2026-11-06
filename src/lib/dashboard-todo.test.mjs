// « À faire aujourd'hui » du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { buildTodo, followUpDelay, remainingTodo, todayLabel, todoCountLabel } = await import("./dashboard-todo.ts");
const { needsFollowUp } = await import("./follow-up.ts");

const NOW = new Date("2026-11-05T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString().slice(0, 10);
const app = (overrides) => ({
  id: "a",
  company: "Acme",
  position: "Analyste",
  location: null,
  offer_url: null,
  contact_name: null,
  contact_email: null,
  status: "envoyee",
  applied_at: daysAgo(9),
  last_contact_at: null,
  created_at: `${daysAgo(9)}T08:00:00Z`,
  ...overrides,
});

test("une relance suit exactement la règle de la stat et du filtre", () => {
  const apps = [
    app({ id: "6j", applied_at: daysAgo(6) }),
    app({ id: "7j", applied_at: daysAgo(7) }),
    app({ id: "attente", status: "en_attente", applied_at: daysAgo(20) }),
    app({ id: "relancee", status: "relancee", last_contact_at: daysAgo(8) }),
    app({ id: "relancee-recente", status: "relancee", last_contact_at: daysAgo(2) }),
    app({ id: "entretien", status: "entretien" }),
    app({ id: "refusee", status: "refusee" }),
  ];
  const todo = buildTodo(apps, NOW);
  assert.deepEqual(new Set(todo.map((item) => item.id)), new Set(apps.filter((a) => needsFollowUp(a, NOW)).map((a) => a.id)));
});

test("relances puis brouillons, les plus anciens d'abord", () => {
  const todo = buildTodo(
    [
      app({ id: "b-recent", status: "brouillon", applied_at: null, created_at: `${daysAgo(1)}T08:00:00Z` }),
      app({ id: "r-recente", applied_at: daysAgo(8) }),
      app({ id: "b-ancien", status: "brouillon", applied_at: null, created_at: `${daysAgo(5)}T08:00:00Z` }),
      app({ id: "r-ancienne", applied_at: daysAgo(30) }),
    ],
    NOW,
  );
  assert.deepEqual(todo.map((item) => item.id), ["r-ancienne", "r-recente", "b-ancien", "b-recent"]);
});

test("la candidature exemple n'est jamais une action, même seule", () => {
  const example = app({ id: "exemple", is_example: true, applied_at: daysAgo(30) });
  assert.deepEqual(buildTodo([example], NOW), []);
  assert.deepEqual(buildTodo([example, app({ id: "vraie" })], NOW).map((item) => item.id), ["vraie"]);
});

test("sous-titre : envoi, ou dernier contact s'il a suivi l'envoi", () => {
  assert.equal(followUpDelay(app({ applied_at: daysAgo(9) }), NOW), "envoyée il y a 9 jours");
  assert.equal(followUpDelay(app({ applied_at: daysAgo(1) }), NOW), "envoyée il y a 1 jour");
  // Contact le jour de l'envoi (dates au format différent) : ce n'est pas un contact ultérieur.
  assert.equal(
    followUpDelay(app({ applied_at: daysAgo(9), last_contact_at: `${daysAgo(9)}T15:30:00Z` }), NOW),
    "envoyée il y a 9 jours",
  );
  assert.equal(followUpDelay(app({ applied_at: daysAgo(20), last_contact_at: daysAgo(8) }), NOW), "dernier contact il y a 8 jours");
  assert.equal(followUpDelay(app({ applied_at: null, last_contact_at: daysAgo(8) }), NOW), "dernier contact il y a 8 jours");
  assert.equal(followUpDelay(app({ status: "brouillon", applied_at: null }), NOW), null);
});

test("reste à afficher, par type", () => {
  const items = [
    ...["r1", "r2", "r3"].map((id) => ({ kind: "relance", id })),
    ...["b1", "b2", "b3"].map((id) => ({ kind: "brouillon", id })),
  ];
  assert.deepEqual(remainingTodo(items, 4), { relances: 0, drafts: 2 });
  assert.deepEqual(remainingTodo(items, 3), { relances: 0, drafts: 3 });
  assert.deepEqual(remainingTodo(items, 2), { relances: 1, drafts: 3 });
  assert.deepEqual(remainingTodo(items.slice(0, 2), 4), { relances: 0, drafts: 0 });
});

test("singulier et pluriel", () => {
  assert.equal(todoCountLabel(1), "1 chose à faire aujourd'hui");
  assert.equal(todoCountLabel(3), "3 choses à faire aujourd'hui");
});

test("date du jour en français, à l'heure de Paris", () => {
  assert.equal(todayLabel(new Date("2026-11-05T12:00:00Z")), "Jeudi 5 novembre");
  // 23 h 30 à UTC : déjà le lendemain à Paris.
  assert.equal(todayLabel(new Date("2026-11-05T23:30:00Z")), "Vendredi 6 novembre");
});
