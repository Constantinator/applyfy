// Rattrapage des titres déjà enregistrés (lot 2 du nettoyage des titres) : périmètre, mode à
// blanc, --apply, --restore, idempotence, mots protégés. Base simulée en mémoire.
// Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { BATCH_SIZE, EXCLUDED_TITLES, planCleanup, planRestore, runTitleBackfill, writeInBatches } = await import(
  "./position-title-backfill.ts"
);

const row = (overrides) => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  position: "Analyste financier (H/F)",
  position_original: null,
  company: "Acme",
  location: "Paris",
  offer_url: "https://example.com/offre",
  is_example: false,
  ...overrides,
});

/** Base en mémoire : updateRow applique la garde comme le filtre Supabase du script. */
function memoryDb(rows) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const writes = [];
  const updateRow = async (id, values, guard) => {
    const current = table.get(id);
    if (!current) return false;
    const originalSet = current.position_original != null;
    if ((guard === "original-null" && originalSet) || (guard === "original-set" && !originalSet)) return false;
    writes.push({ id, values: { ...values } });
    Object.assign(current, values);
    return true;
  };
  return { table, writes, updateRow, rows: () => [...table.values()].map((r) => ({ ...r })) };
}

const yes = async () => true;
const no = async () => false;
const quiet = () => {};

test("périmètre : lien d'offre obligatoire, exemple exclu, original déjà gardé ignoré", () => {
  const rows = [
    row({ id: "ok" }),
    row({ id: "sans-lien", offer_url: null }),
    row({ id: "lien-vide", offer_url: "  " }),
    row({ id: "exemple", is_example: true }),
    row({ id: "deja", position_original: "Analyste financier (H/F) - Paris" }),
    row({ id: "propre", position: "Analyste financier" }),
  ];
  const { changes, unchanged, outOfScope } = planCleanup(rows);
  assert.deepEqual(changes, [{ id: "ok", before: "Analyste financier (H/F)", after: "Analyste financier" }]);
  assert.equal(unchanged, 1);
  assert.equal(outOfScope, 4);
});

test("mode à blanc : rapport sans aucune écriture ni confirmation", async () => {
  const db = memoryDb([row({ id: "uuid-1111" }), row({ id: "uuid-2222", position: "STAGE - ANALYSTE RISQUES (F/H)" })]);
  const lines = [];
  let asked = false;
  const result = await runTitleBackfill({
    mode: "dry-run",
    rows: db.rows(),
    updateRow: db.updateRow,
    confirm: async () => ((asked = true), true),
    log: (line) => lines.push(line),
  });
  assert.equal(result.written, 0);
  assert.equal(db.writes.length, 0);
  assert.equal(asked, false);
  const report = lines.join("\n");
  assert.match(report, /Analyste financier \(H\/F\)\n {4}→ Analyste financier/);
  assert.match(report, /2 titre\(s\) changeraient, 0 resteraient identiques, 0 exclu\(s\)/);
  assert.match(report, /aucune écriture/);
  assert.doesNotMatch(report, /uuid-/); // aucun identifiant dans le rapport
});

test("--apply : refus de « o » → rien écrit", async () => {
  const db = memoryDb([row({ id: "a" })]);
  const result = await runTitleBackfill({ mode: "apply", rows: db.rows(), updateRow: db.updateRow, confirm: no, log: quiet });
  assert.equal(result.written, 0);
  assert.equal(db.writes.length, 0);
});

test("--apply écrit position et position_original ensemble, sans écraser un original rempli", async () => {
  const db = memoryDb([row({ id: "a" }), row({ id: "b", position: "Stage - Consultant - Paris (H/F)" })]);
  const rows = db.rows();
  // Entre la lecture et l'écriture, « b » reçoit un titre d'origine (création par l'import) : non écrasé.
  db.table.get("b").position_original = "déjà gardé";
  const result = await runTitleBackfill({ mode: "apply", rows, updateRow: db.updateRow, confirm: yes, log: quiet });
  assert.equal(result.written, 1);
  assert.deepEqual(db.writes, [
    { id: "a", values: { position: "Analyste financier", position_original: "Analyste financier (H/F)" } },
  ]);
  assert.equal(db.table.get("b").position, "Stage - Consultant - Paris (H/F)");
  assert.equal(db.table.get("b").position_original, "déjà gardé");
});

test("idempotence : relancer --apply ne change plus rien", async () => {
  const db = memoryDb([
    row({ id: "a" }),
    row({ id: "b", position: "STAGE - ASSISTANT(E) FINANCEMENTS STRUCTURES - Autres - Paris 8, Ile de France, France", location: "Paris 8, France" }),
    row({ id: "c", position: "Développeur", offer_url: null }),
  ]);
  await runTitleBackfill({ mode: "apply", rows: db.rows(), updateRow: db.updateRow, confirm: yes, log: quiet });
  const after = JSON.stringify(db.rows());
  const second = await runTitleBackfill({ mode: "apply", rows: db.rows(), updateRow: db.updateRow, confirm: yes, log: quiet });
  assert.equal(second.written, 0);
  assert.equal(JSON.stringify(db.rows()), after);
  assert.equal(planCleanup(db.rows()).changes.length, 0);
  // Même sans l'original gardé, le titre nettoyé ne change plus.
  const cleaned = db.rows().map((r) => ({ ...r, position_original: null }));
  assert.equal(planCleanup(cleaned).changes.length, 0);
});

test("--restore remet le titre d'origine et vide position_original, après « o »", async () => {
  const db = memoryDb([row({ id: "a" }), row({ id: "b", offer_url: null, position: "Comptable" })]);
  await runTitleBackfill({ mode: "apply", rows: db.rows(), updateRow: db.updateRow, confirm: yes, log: quiet });
  assert.equal(db.table.get("a").position, "Analyste financier");

  const refused = await runTitleBackfill({ mode: "restore", rows: db.rows(), updateRow: db.updateRow, confirm: no, log: quiet });
  assert.equal(refused.written, 0);
  assert.equal(db.table.get("a").position, "Analyste financier");

  const restored = await runTitleBackfill({ mode: "restore", rows: db.rows(), updateRow: db.updateRow, confirm: yes, log: quiet });
  assert.equal(restored.written, 1);
  assert.equal(db.table.get("a").position, "Analyste financier (H/F)");
  assert.equal(db.table.get("a").position_original, null);
  assert.equal(db.table.get("b").position, "Comptable");
  assert.deepEqual(planRestore(db.rows()), []);
});

test("écriture par lots de 50", async () => {
  assert.equal(BATCH_SIZE, 50);
  const items = Array.from({ length: 120 }, (_, i) => ({ id: String(i), before: "x", after: "y" }));
  let inFlight = 0;
  let maxInFlight = 0;
  const written = await writeInBatches(items, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    return true;
  });
  assert.equal(written, 120);
  assert.equal(maxInFlight, 50);
});

test("aucun mot protégé perdu : Stage, Alternance, Manager, Stagiaire, Junior, sigles", () => {
  const titles = [
    "Stage - Consultant en analyse financière - Paris (H/F)",
    "Stage ou alternance consultant informatique F/H",
    "Key Account Manager - Marché Logistique - Le Bourget (H/F)",
    "Stagiaire Analyste Financier – (H/F)",
    "Analyste financier junior - Bac+4/5 - Stage (H/F)",
    "Stage - Siège Social - Debt Capital Market (DCM) & Rating H/F",
    "Stage IT M&A – Tech & IT Due Diligence et PMI F/H",
    "DEVELOPPEUR PHP SENIOR H/F", // (le titre exact « … SYMFONY EXPERIMENTE H/F » est exclu)
  ];
  const { changes } = planCleanup(titles.map((position, i) => row({ id: String(i), position, location: "93 - LE BOURGET" })));
  assert.equal(changes.length, titles.length);
  const words = (text) => new Set(text.toLowerCase().match(/\p{L}+/gu));
  for (const { before, after } of changes) {
    for (const word of ["stage", "alternance", "manager", "stagiaire", "junior"]) {
      if (words(before).has(word)) assert.ok(words(after).has(word), `${word} : ${before}`);
    }
    for (const sigle of ["DCM", "IT", "M&A", "PMI", "PHP"]) {
      if (before.includes(sigle)) assert.ok(after.includes(sigle), `${sigle} : ${before}`);
    }
  }
});

test("script : à blanc par défaut, confirmation « o », gardes Supabase, aucun secret affiché", () => {
  const script = readFileSync(new URL("../../scripts/clean-position-titles.mjs", import.meta.url), "utf8");
  assert.match(script, /const mode = APPLY \? "apply" : RESTORE \? "restore" : "dry-run";/);
  assert.match(script, /answer === "o"/);
  assert.match(script, /query\.is\("position_original", null\)/);
  assert.match(script, /query\.not\("position_original", "is", null\)/);
  assert.doesNotMatch(script, /console\.(log|error)\([^)]*(env\(|SERVICE_ROLE_KEY\)|fileEnv)/);
  assert.doesNotMatch(script, /\.delete\(|\.upsert\(|\.insert\(/);
});

test("liste d'exclusion : les 2 titres exacts ne sont jamais écrits, une variante l'est", async () => {
  assert.deepEqual([...EXCLUDED_TITLES], ["DEVELOPPEUR PHP SYMFONY EXPERIMENTE H/F", "STAGE - ANALYSTE RISQUES (F/H) - SWEN CP"]);
  const db = memoryDb([
    row({ id: "php", position: "DEVELOPPEUR PHP SYMFONY EXPERIMENTE H/F", location: "34 - Montpellier" }),
    row({ id: "swen", position: "STAGE - ANALYSTE RISQUES (F/H) - SWEN CP" }),
    row({ id: "variante", position: "STAGE - ANALYSTE RISQUES (F/H)" }),
    row({ id: "autre", position: "Contrôleur bancaire H/F" }),
  ]);
  const lines = [];
  const result = await runTitleBackfill({
    mode: "apply",
    rows: db.rows(),
    updateRow: db.updateRow,
    confirm: yes,
    log: (line) => lines.push(line),
  });
  assert.equal(result.written, 2);
  assert.deepEqual(db.writes.map((w) => w.id).sort(), ["autre", "variante"]);
  for (const id of ["php", "swen"]) {
    const kept = db.table.get(id);
    assert.equal(kept.position_original, null);
    assert.ok(EXCLUDED_TITLES.has(kept.position));
  }
  assert.match(lines.join("\n"), /2 titre\(s\) changeraient, 0 resteraient identiques, 2 exclu\(s\) par la liste/);
});
