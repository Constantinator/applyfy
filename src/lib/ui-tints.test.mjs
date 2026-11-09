// Couleurs par fonction (Tableau de bord) et pastilles de secteur (/candidatures, Trouver une offre).
// Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Imports relatifs sans extension entre fichiers .ts (comme dans l'app).
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { SECTORS, SECTOR_LABELS } = await import("./sectors.ts");
const { FUNCTION_TINTS } = await import("./ui-tints.ts");
const { SECTOR_TINT_VALUES, sectorTint } = await import("./sector-tints.ts");

const SRC = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, SRC), "utf8");
const css = source("app/globals.css");
const cssVar = (name) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i").exec(css)?.[1]?.toLowerCase();

const luminance = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("secteurs : une seule liste, identique à la base sectorielle, chacun avec un libellé et une teinte", () => {
  const kb = JSON.parse(source("lib/cv-knowledge-base.json"));
  assert.deepEqual([...SECTORS].sort(), Object.keys(kb.sectors).sort());
  assert.match(source("lib/cv-sector-context.ts"), /import \{ SECTORS, type Sector \} from "\.\/sectors";/);
  assert.doesNotMatch(source("lib/cv-sector-context.ts"), /export const SECTORS = \[/);
  for (const sector of SECTORS) {
    assert.ok(SECTOR_LABELS[sector], sector);
    assert.ok(SECTOR_TINT_VALUES[sector], sector);
    assert.equal(sectorTint(sector).known, true, sector);
    assert.equal(sectorTint(sector).label, SECTOR_LABELS[sector]);
    // Variables CSS identiques aux valeurs de ui-tints.ts.
    assert.equal(cssVar(`sector-${sector}`), SECTOR_TINT_VALUES[sector].bg, sector);
    assert.equal(cssVar(`sector-${sector}-ink`), SECTOR_TINT_VALUES[sector].ink, sector);
  }
  assert.deepEqual(Object.keys(SECTOR_TINT_VALUES).sort(), [...SECTORS, "other"].sort());
});

test("teintes de secteur : aucun doublon, contraste ≥ 4,5:1, ni rouge d'erreur ni orange de retard", () => {
  const values = Object.values(SECTOR_TINT_VALUES);
  assert.equal(new Set(values.map((v) => v.bg)).size, values.length, "fonds en double");
  assert.equal(new Set(values.map((v) => v.ink)).size, values.length, "textes en double");
  const functionBgs = ["cv", "letter", "offer", "interview", "success"].map((n) => cssVar(`tint-${n}`));
  for (const [name, { bg, ink }] of Object.entries(SECTOR_TINT_VALUES)) {
    assert.ok(contrast(bg, ink) >= 4.5, `${name} : ${contrast(bg, ink).toFixed(2)}`);
    assert.ok(!["#c2410c", "#dc2626", "#b91c1c", "#ef4444"].includes(ink), name);
    if (name !== "other") assert.ok(!functionBgs.includes(bg), `${name} : même fond qu'une fonction`);
  }
});

test("secteur vide, inconnu ou nouveau : pastille grise « Autre », jamais d'erreur", () => {
  for (const value of [null, undefined, "", "inconnu", "Finance", "aeronautique", 42]) {
    const tint = sectorTint(value);
    assert.equal(tint.label, "Autre");
    assert.equal(tint.known, false);
    assert.equal(tint.className, "bg-sector-other text-sector-other-ink");
  }
  assert.equal(SECTOR_TINT_VALUES.other.bg, "#f4f4f5");
  assert.equal(SECTOR_TINT_VALUES.other.ink, "#3f3f46");
});

test("teintes par fonction : 5 paires centralisées en variables CSS, contraste ≥ 4,5:1", () => {
  const pairs = {
    cv: ["#e8effd", "#1d4ed8"],
    letter: ["#f1ebfc", "#6d28d9"],
    offer: ["#f6efe4", "#8a5a12"],
    interview: ["#fce8ec", "#b4234a"],
    success: ["#e8f5ec", "#166534"],
  };
  for (const [name, [bg, ink]] of Object.entries(pairs)) {
    assert.equal(cssVar(`tint-${name}`), bg, name);
    assert.equal(cssVar(`tint-${name}-ink`), ink, name);
    assert.ok(contrast(bg, ink) >= 4.5, name);
    assert.match(FUNCTION_TINTS[name], new RegExp(`^bg-tint-${name} text-tint-${name}-ink `));
  }
});

/** Fichiers locaux importés (récursivement) par un fichier de src/. */
function importGraph(entry) {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const [, spec] of source(path).matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']/g)) {
      const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? new URL(spec, new URL(path, SRC)).href.slice(SRC.href.length) : null;
      if (!base) continue;
      const file = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(
        (p) => /\.(?:tsx?|json)$/.test(p) && existsSync(new URL(p, SRC)),
      );
      if (file && !file.endsWith(".json")) visit(decodeURIComponent(file));
    }
  };
  visit(entry);
  return [...seen];
}

test("Tableau de bord : jamais de pastille ni de teinte de secteur (graphe d'imports complet)", () => {
  const files = importGraph("app/(app)/dashboard/page.tsx");
  assert.ok(files.some((f) => f.endsWith("components/dashboard/todo-card.tsx")), "graphe lu");
  assert.ok(files.includes("lib/ui-tints.ts"), "teintes de fonction importées");
  assert.ok(!files.includes("components/sector-pill.tsx"));
  assert.ok(!files.includes("lib/sector-tints.ts"));
  for (const file of files) assert.doesNotMatch(source(file), /\bsectorTint\b|\bSectorPill\b|bg-sector-/, file);
});

test("pastilles de secteur : /candidatures (liste et fiche) et Trouver une offre, null → « Autre »", () => {
  assert.match(source("components/dashboard/applications-list.tsx"), /<SectorPill sector=\{app\.sector\} \/>/);
  assert.match(source("app/(app)/candidatures/[id]/page.tsx"), /<SectorPill sector=\{app\.sector\}/);
  assert.match(source("app/(app)/offres/page.tsx"), /<SectorPill sector=\{detectOfferSector\(offer\.title, offer\.description\)\} \/>/);
  // Pas de faux secteur : sans correspondance, null (et non « etudiant »).
  const detect = /export function detectOfferSector[\s\S]*?\n\}/.exec(source("lib/cv-sector-context.ts"))?.[0] ?? "";
  assert.match(detect, /return byKeywords\.score >= 3 \? byKeywords\.sector : null;/);
  // Migration 0038 : colonne nullable, sans contrainte.
  const sql = source("../supabase/migrations/0038_application_sector.sql");
  assert.match(sql, /alter table applications add column if not exists sector text;/);
  assert.doesNotMatch(sql, /check\s*\(|not null/i);
});

test("tuiles du Tableau de bord : teintes par fonction, sans hexadécimal ; jauge, badges et retard inchangés", () => {
  assert.match(source("components/dashboard/cv-card.tsx"), /rounded-xl \$\{FUNCTION_TINTS\.cv\}/);
  assert.match(source("components/dashboard/cv-card.tsx"), /cv\.score >= READY_SCORE && <span className=\{`mt-2 \$\{SUCCESS_PILL\}`\}>Prêt à envoyer<\/span>/);
  assert.match(source("components/dashboard/my-week-card.tsx"), /goal !== null && sentThisWeek >= goal && <span className=\{SUCCESS_PILL\}>Objectif tenu<\/span>/);
  const todo = source("components/dashboard/todo-card.tsx");
  assert.match(todo, /iconBox\(relance \? "letter" : "offer"\)/);
  assert.match(todo, /iconBox\("success"\)/);
  const stats = source("components/dashboard/stats-cards.tsx");
  assert.match(stats, /blue: \{ icon: IconBriefcase, badge: FUNCTION_TINTS\.offer \}/);
  assert.match(stats, /waiting: \{ icon: IconClock, badge: NEUTRAL \}/);
  assert.match(stats, /violet: \{ icon: IconChat, badge: FUNCTION_TINTS\.interview \}/);
  assert.match(stats, /amber: \{ icon: IconBell, badge: "bg-pill dark:bg-amber-500\/15 text-late/);
  assert.match(source("components/dashboard/empty-dashboard.tsx"), /rounded-card \$\{FUNCTION_TINTS\.offer\}/);
  // Aucune valeur de teinte écrite en dur dans les composants.
  const hexes = [...Object.values(SECTOR_TINT_VALUES).flatMap((v) => [v.bg, v.ink]), "#e8effd", "#f1ebfc", "#f6efe4", "#fce8ec", "#e8f5ec"];
  for (const file of ["components/dashboard/cv-card.tsx", "components/dashboard/todo-card.tsx", "components/dashboard/stats-cards.tsx", "components/dashboard/my-week-card.tsx", "components/dashboard/empty-dashboard.tsx", "components/sector-pill.tsx", "components/dashboard/applications-list.tsx", "lib/ui-tints.ts"]) {
    const code = source(file).toLowerCase();
    assert.deepEqual(hexes.filter((h) => code.includes(h)), [], file);
  }
  // Inchangés : jauge (rouge, orange, vert) et orange de retard.
  const gauge = source("components/cv-builder/cv-score-card.tsx");
  for (const color of ["#dc2626", "#f97316", "#16a34a"]) assert.ok(gauge.includes(color), color);
  assert.equal(cssVar("late"), "#c2410c");
});
