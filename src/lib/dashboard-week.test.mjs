// Carte « Ma semaine » du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { buildPeriodStats, goalPercent, monthBounds, parisDay, parseWeeklyGoal, weekBounds, weekMessage } = await import(
  "./dashboard-week.ts"
);
const { INTERVIEW_EVENT_SUFFIX, statusChangeContent } = await import("./types.ts");

const NOW = new Date("2026-11-06T12:00:00Z"); // vendredi

let nextId = 0;
const app = (fields = {}) => ({
  id: `a${nextId++}`,
  company: "Acme",
  position: "Analyste",
  location: null,
  offer_url: null,
  contact_name: null,
  contact_email: null,
  status: "envoyee",
  applied_at: "2026-11-04",
  last_contact_at: null,
  created_at: "2026-11-01T10:00:00Z",
  is_example: false,
  ...fields,
});
const response = (applicationId, createdAt, content = "Envoyée → Refusée") => ({
  application_id: applicationId,
  content,
  created_at: createdAt,
});

test("semaine du lundi au dimanche", () => {
  assert.deepEqual(weekBounds(NOW), { from: "2026-11-02", to: "2026-11-08" });
  // Un lundi et un dimanche restent dans leur semaine.
  assert.deepEqual(weekBounds(new Date("2026-11-02T12:00:00Z")), { from: "2026-11-02", to: "2026-11-08" });
  assert.deepEqual(weekBounds(new Date("2026-11-08T12:00:00Z")), { from: "2026-11-02", to: "2026-11-08" });
});

test("limite dimanche/lundi à l'heure de Paris, pas en UTC", () => {
  // Dimanche 23h30 UTC = lundi 00h30 à Paris (heure d'hiver).
  assert.equal(weekBounds(new Date("2026-11-08T23:30:00Z")).from, "2026-11-09");
  // Dimanche 22h30 UTC = dimanche 23h30 à Paris.
  assert.equal(weekBounds(new Date("2026-11-08T22:30:00Z")).from, "2026-11-02");
  // Heure d'été : dimanche 22h30 UTC = lundi 00h30 à Paris.
  assert.equal(weekBounds(new Date("2026-07-05T22:30:00Z")).from, "2026-07-06");
});

test("semaine et jour du changement d'heure", () => {
  // Passage à l'heure d'hiver le dimanche 25 octobre 2026.
  assert.deepEqual(weekBounds(new Date("2026-10-25T12:00:00Z")), { from: "2026-10-19", to: "2026-10-25" });
  assert.equal(parisDay(new Date("2026-10-25T22:59:00Z")), "2026-10-25");
  assert.equal(parisDay(new Date("2026-10-25T23:00:00Z")), "2026-10-26");
  // Passage à l'heure d'été le dimanche 28 mars 2027.
  assert.deepEqual(weekBounds(new Date("2027-03-28T12:00:00Z")), { from: "2027-03-22", to: "2027-03-28" });
});

test("mois, y compris février et la bascule à l'heure de Paris", () => {
  assert.deepEqual(monthBounds(NOW), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(monthBounds(new Date("2028-02-10T12:00:00Z")), { from: "2028-02-01", to: "2028-02-29" });
  assert.equal(monthBounds(new Date("2026-11-30T23:30:00Z")).from, "2026-12-01");
});

test("envoyées : période, brouillons et candidature exemple exclus", () => {
  const stats = buildPeriodStats(
    [
      app(), // cette semaine
      app({ applied_at: "2026-11-02" }), // lundi : cette semaine
      app({ applied_at: "2026-11-01" }), // dimanche : ce mois, pas cette semaine
      app({ applied_at: "2026-10-30" }), // mois précédent
      app({ status: "brouillon", applied_at: null }),
      app({ is_example: true, status: "en_attente" }),
    ],
    [],
    NOW,
  );
  assert.equal(stats.week.sent, 2);
  assert.equal(stats.month.sent, 3);
  assert.equal(stats.total.sent, 4);
});

test("réponses et entretiens : candidatures envoyées sur la période, réponse à n'importe quelle date", () => {
  const a = app({ status: "offre" });
  const b = app({ status: "refusee" });
  const events = [
    response(a.id, "2026-11-05T10:00:00Z", statusChangeContent("envoyee", "entretien")),
    response(a.id, "2026-11-06T10:00:00Z", statusChangeContent("entretien", "offre")),
    response(b.id, "2026-10-20T10:00:00Z"),
  ];
  const stats = buildPeriodStats([a, b], events, NOW);
  assert.deepEqual([stats.week.responses, stats.week.interviews], [2, 1]);
  assert.deepEqual([stats.month.responses, stats.month.interviews], [2, 1]);
  assert.deepEqual([stats.total.responses, stats.total.interviews], [2, 1]);
});

test("le repère des entretiens suit le texte écrit par l'événement", () => {
  assert.ok(statusChangeContent("envoyee", "entretien").endsWith(INTERVIEW_EVENT_SUFFIX));
  assert.ok(statusChangeContent("relancee", "entretien").endsWith(INTERVIEW_EVENT_SUFFIX));
  assert.ok(!statusChangeContent("entretien", "offre").endsWith(INTERVIEW_EVENT_SUFFIX));
});

test("réponse à une candidature envoyée avant la période : hors de la semaine, dans le total", () => {
  const a = app({ status: "refusee", applied_at: "2026-10-20" });
  const stats = buildPeriodStats([a], [response(a.id, "2026-11-05T10:00:00Z")], NOW);
  assert.equal(stats.week.responses, 0);
  assert.equal(stats.total.responses, 1);
});

test("exemple exclu des réponses, même au total", () => {
  const example = app({ is_example: true, status: "entretien" });
  const stats = buildPeriodStats([example], [response(example.id, "2026-11-05T10:00:00Z", "Envoyée → Entretien")], NOW);
  assert.deepEqual(stats.total, { sent: 0, responses: 0, interviews: 0, responseRate: null });
  assert.equal(stats.week.interviews, 0);
});

test("le statut actuel complète l'historique, sur chaque période", () => {
  const stats = buildPeriodStats([app({ status: "entretien" })], [], NOW);
  assert.deepEqual([stats.total.responses, stats.total.interviews], [1, 1]);
  assert.deepEqual([stats.week.responses, stats.week.interviews], [1, 1]);
});

test("taux de réponse : seulement à partir de 10 envois sur la période", () => {
  const nine = Array.from({ length: 9 }, () => app());
  assert.equal(buildPeriodStats(nine, [], NOW).week.responseRate, null);
  const ten = [...nine, app()];
  assert.equal(buildPeriodStats(ten, [], NOW).week.responseRate, 0);
});

test("taux de réponse : réponse à n'importe quelle date, jamais plus de 100 %", () => {
  const sentThisWeek = Array.from({ length: 10 }, () => app());
  const events = [
    // Réponse reçue plus tard que la période n'empêche rien : elle compte pour la candidature.
    response(sentThisWeek[0].id, "2026-12-01T10:00:00Z"),
    response(sentThisWeek[0].id, "2026-12-02T10:00:00Z"),
    response(sentThisWeek[1].id, "2026-11-05T10:00:00Z"),
  ];
  const old = app({ applied_at: "2026-01-10" });
  assert.equal(buildPeriodStats([...sentThisWeek, old], [...events, response(old.id, "2026-11-05T10:00:00Z")], NOW).week.responseRate, 20);
  const everyone = sentThisWeek.flatMap((a) => [response(a.id, "2026-11-05T10:00:00Z"), response(a.id, "2026-11-06T10:00:00Z")]);
  assert.equal(buildPeriodStats(sentThisWeek, everyone, NOW).week.responseRate, 100);
});

test("plusieurs réponses sur une même candidature comptent une seule fois", () => {
  const a = app({ status: "offre" });
  const events = [
    response(a.id, "2026-11-04T10:00:00Z", statusChangeContent("envoyee", "entretien")),
    response(a.id, "2026-11-05T10:00:00Z", statusChangeContent("entretien", "entretien")),
    response(a.id, "2026-11-06T10:00:00Z", statusChangeContent("entretien", "offre")),
  ];
  const stats = buildPeriodStats([a], events, NOW);
  for (const period of ["week", "month", "total"]) {
    assert.deepEqual([stats[period].sent, stats[period].responses, stats[period].interviews], [1, 1, 1]);
  }
});

test("réponses : même règle que le taux, les candidatures hors des envois ne comptent pas", () => {
  const sent = Array.from({ length: 14 }, () => app());
  // Passées de Brouillon à Refusée sans date d'envoi : réponse enregistrée, mais jamais envoyées.
  const neverSent = Array.from({ length: 8 }, () => app({ status: "refusee", applied_at: null }));
  const events = [sent[0], sent[1], ...neverSent].map((a) => response(a.id, "2026-11-05T10:00:00Z"));
  assert.deepEqual(buildPeriodStats([...sent, ...neverSent], events, NOW).total, {
    sent: 14,
    responses: 2,
    interviews: 0,
    responseRate: 14,
  });
});

test("entretiens : jamais plus que les réponses ni que les envois de la période", () => {
  const neverSent = app({ status: "entretien", applied_at: null });
  const oldSent = app({ status: "entretien", applied_at: "2026-09-10" });
  const events = [
    response(neverSent.id, "2026-11-05T10:00:00Z", statusChangeContent("brouillon", "entretien")),
    response(oldSent.id, "2026-11-05T10:00:00Z", statusChangeContent("envoyee", "entretien")),
  ];
  const stats = buildPeriodStats([neverSent, oldSent], events, NOW);
  assert.deepEqual([stats.week.sent, stats.week.responses, stats.week.interviews], [0, 0, 0]);
  assert.deepEqual([stats.total.sent, stats.total.responses, stats.total.interviews], [1, 1, 1]);
});

test("objectif : un entier de 1 à 50, vide pour le retirer", () => {
  assert.deepEqual(parseWeeklyGoal("1"), { ok: true, goal: 1 });
  assert.deepEqual(parseWeeklyGoal(" 50 "), { ok: true, goal: 50 });
  assert.deepEqual(parseWeeklyGoal(""), { ok: true, goal: null });
  assert.deepEqual(parseWeeklyGoal(null), { ok: true, goal: null });
  assert.deepEqual(parseWeeklyGoal(5), { ok: true, goal: 5 });
  for (const value of ["0", "51", "2.5", "-3", "dix", "1e1", "0x10", true, [5], 0, 51, 2.5]) {
    assert.equal(parseWeeklyGoal(value).ok, false, value);
  }
});

test("jauge plafonnée à 100 %", () => {
  assert.equal(goalPercent(0, 5), 0);
  assert.equal(goalPercent(2, 5), 40);
  assert.equal(goalPercent(9, 5), 100);
});

test("ton : jamais de reproche", () => {
  const messages = [weekMessage(0, null), weekMessage(0, 5), weekMessage(1, null), weekMessage(3, null), weekMessage(2, 5), weekMessage(5, 5)];
  assert.equal(weekMessage(5, 5), "Objectif atteint, bravo !");
  assert.equal(weekMessage(2, 5), "Encore 3 pour atteindre ton objectif, à ton rythme.");
  for (const message of messages) {
    assert.doesNotMatch(message, /retard|seulement|devrais|dois|insuffisant|pas assez/i);
  }
});
