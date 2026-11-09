// Bandeau de Lumeo sur le Tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const {
  LUMEO_PREPAINT_SCRIPT,
  LUMEO_STORAGE_PREFIX,
  isLumeoHidden,
  isShownOnce,
  localDay,
  lumeoBannerContent,
  lumeoMessageKey,
  pickLumeoMessage,
} = await import("./lumeo-dashboard.ts");

const NOW = new Date("2026-11-09T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString().slice(0, 10);

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
  applied_at: daysAgo(1),
  last_contact_at: null,
  created_at: "2026-11-01T10:00:00Z",
  is_example: false,
  ...fields,
});
const example = (fields = {}) => app({ is_example: true, company: "Exemple", applied_at: daysAgo(30), ...fields });

const pick = (input) =>
  pickLumeoMessage({ hasCv: true, applications: [], weekSent: 0, weeklyGoal: null, now: NOW, ...input });

test("1. compte sans CV : bienvenue, prioritaire sur tout le reste", () => {
  assert.deepEqual(pick({ hasCv: false }), { kind: "bienvenue" });
  const late = app({ applied_at: daysAgo(10) });
  assert.deepEqual(pick({ hasCv: false, applications: [late], weekSent: 2, weeklyGoal: 3 }), { kind: "bienvenue" });
});

test("1. lecture du CV en échec : pas de bienvenue", () => {
  assert.equal(pick({ hasCv: undefined }), null);
});

test("2. première candidature envoyée", () => {
  const first = app();
  assert.deepEqual(pick({ applications: [first] }), { kind: "premiere", applicationId: first.id });
  // Brouillon, réponse reçue ou deuxième candidature : pas de carte verte.
  assert.equal(pick({ applications: [app({ status: "brouillon" })] }), null);
  assert.equal(pick({ applications: [app({ status: "entretien" })] }), null);
  assert.equal(pick({ applications: [app(), app()] }), null);
});

test("2. la candidature exemple ne compte jamais", () => {
  // L'exemple seul n'est pas une première candidature…
  assert.equal(pick({ applications: [example()] }), null);
  // … et ne transforme pas une première candidature en deuxième.
  const first = app();
  assert.deepEqual(pick({ applications: [example(), first] }), { kind: "premiere", applicationId: first.id });
});

test("2. prioritaire sur l'objectif", () => {
  const first = app();
  assert.equal(pick({ applications: [first], weekSent: 1, weeklyGoal: 2 }).kind, "premiere");
});

test("3. objectif presque atteint : il reste une candidature", () => {
  const apps = [app(), app(), app()];
  assert.deepEqual(pick({ applications: apps, weekSent: 3, weeklyGoal: 4 }), { kind: "objectif", sent: 3, goal: 4 });
  // Sans objectif, objectif atteint, plus d'une à envoyer ou aucun envoi : rien.
  assert.equal(pick({ applications: apps, weekSent: 3, weeklyGoal: null }), null);
  assert.equal(pick({ applications: apps, weekSent: 4, weeklyGoal: 4 }), null);
  assert.equal(pick({ applications: apps, weekSent: 2, weeklyGoal: 4 }), null);
  assert.equal(pick({ applications: apps, weekSent: 0, weeklyGoal: 1 }), null);
  // Lecture de la semaine en échec : on passe.
  assert.equal(pick({ applications: apps, weekSent: null, weeklyGoal: 4 }), null);
});

test("3. prioritaire sur la relance", () => {
  const apps = [app({ applied_at: daysAgo(10) }), app()];
  assert.equal(pick({ applications: apps, weekSent: 1, weeklyGoal: 2 }).kind, "objectif");
});

test("4. relance : la plus ancienne, comme « À faire »", () => {
  const recent = app({ company: "Récente", applied_at: daysAgo(8) });
  const oldest = app({ company: "Ancienne", applied_at: daysAgo(12) });
  assert.deepEqual(pick({ applications: [recent, oldest, app()] }), {
    kind: "relance",
    applicationId: oldest.id,
    company: "Ancienne",
    days: 12,
  });
  // Dernier contact plus récent que l'envoi : délai depuis ce contact.
  const contacted = app({ company: "Contactée", status: "relancee", applied_at: daysAgo(20), last_contact_at: daysAgo(9) });
  assert.equal(pick({ applications: [contacted, app()] }).days, 9);
});

test("4. la candidature exemple n'est jamais à relancer", () => {
  assert.equal(pick({ applications: [example(), app(), app()] }), null);
});

test("5. rien à dire : aucun bandeau", () => {
  assert.equal(pick({ applications: [app(), app({ status: "entretien" })], weekSent: 2, weeklyGoal: 5 }), null);
  assert.equal(pick({}), null);
});

test("« Plus tard » : masqué jusqu'à demain, par message", () => {
  const relance = { kind: "relance", applicationId: "x", company: "Acme", days: 8 };
  assert.equal(isLumeoHidden(relance, null, "2026-11-09"), false);
  assert.equal(isLumeoHidden(relance, "2026-11-09", "2026-11-09"), true);
  assert.equal(isLumeoHidden(relance, "2026-11-09", "2026-11-10"), false);
  // Une clé par message : une autre relance n'est pas masquée.
  assert.equal(lumeoMessageKey(relance), "relance-x");
  assert.notEqual(lumeoMessageKey(relance), lumeoMessageKey({ ...relance, applicationId: "y" }));
  assert.equal(lumeoMessageKey({ kind: "bienvenue" }), "bienvenue");
  assert.equal(isLumeoHidden({ kind: "bienvenue" }, "2026-11-09", "2026-11-09"), true);
  assert.equal(isLumeoHidden({ kind: "bienvenue" }, "2026-11-08", "2026-11-09"), false);
});

test("carte verte : une seule fois, puis plus jamais", () => {
  const premiere = { kind: "premiere", applicationId: "x" };
  assert.equal(isShownOnce(premiere), true);
  assert.equal(isShownOnce({ kind: "bienvenue" }), false);
  assert.equal(isLumeoHidden(premiere, null, "2026-11-09"), false);
  assert.equal(isLumeoHidden(premiere, "2026-11-09", "2026-11-09"), true);
  assert.equal(isLumeoHidden(premiere, "2026-11-09", "2027-01-01"), true);
});

test("textes : tutoiement, accords et liens", () => {
  const relance = lumeoBannerContent({ kind: "relance", applicationId: "x", company: "Acme", days: 8 });
  assert.equal(relance.title, "Acme n'a pas répondu depuis 8 jours : tu peux la relancer.");
  assert.equal(relance.primary.href, "/candidatures/x#relance");
  assert.equal(relance.primary.label, "Voir la relance");
  assert.equal(lumeoBannerContent({ kind: "objectif", sent: 1, goal: 2 }).title, "1 candidature cette semaine, il t'en manque une pour ton objectif.");
  assert.equal(lumeoBannerContent({ kind: "objectif", sent: 4, goal: 5 }).title, "4 candidatures cette semaine, il t'en manque une pour ton objectif.");
  const bienvenue = lumeoBannerContent({ kind: "bienvenue" });
  assert.equal(bienvenue.expression, "salue");
  assert.deepEqual([bienvenue.primary.href, bienvenue.secondary.href], ["/cv-builder", "/cv-builder/importer"]);
  const premiere = lumeoBannerContent({ kind: "premiere", applicationId: "x" });
  assert.deepEqual([premiere.expression, premiere.tone, premiere.secondary], ["felicite", "success", null]);
  // Aucun bouton n'envoie à la place de l'utilisateur.
  for (const content of [relance, bienvenue, premiere]) assert.doesNotMatch(content.primary.label, /envoyer|préparer/i);
});

test("jour local au format AAAA-MM-JJ", () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

/** Lance le script d'avant affichage avec un localStorage donné ; renvoie le CSS injecté. */
function runPrepaint(entries) {
  const keys = Object.keys(entries);
  const styles = [];
  const context = {
    localStorage: { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => entries[k] ?? null },
    document: { createElement: () => ({}), head: { appendChild: (el) => styles.push(el.textContent) } },
    Date: class extends Date {
      constructor() {
        super(2026, 10, 9, 10, 0);
      }
    },
  };
  vm.runInNewContext(LUMEO_PREPAINT_SCRIPT, context);
  return styles.join("");
}

test("script d'avant affichage : mêmes règles que isLumeoHidden", () => {
  const p = LUMEO_STORAGE_PREFIX;
  const css = runPrepaint({
    [`${p}relance-a1`]: "2026-11-09",
    [`${p}relance-a2`]: "2026-11-08",
    [`${p}premiere`]: "2026-10-01",
    [`${p}bad"]{x}`]: "2026-11-09",
    theme: "light",
  });
  assert.match(css, /\[data-lumeo-key="relance-a1"\]\{display:none\}/);
  assert.match(css, /\[data-lumeo-key="premiere"\]\{display:none\}/);
  assert.doesNotMatch(css, /relance-a2/);
  assert.doesNotMatch(css, /bad/);
  assert.equal(runPrepaint({}), "");
});
