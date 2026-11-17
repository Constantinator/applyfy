// PDF d'un CV traduit (lot traduction, C6) : les polices du CV (public/fonts/cv, utilisées par
// @react-pdf) contiennent tous les caractères d'un CV en français ou en anglais, une fois les
// espaces fines remplacées (normalizeSpaces). Table « cmap » lue directement dans les fichiers.
// Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CV_FONTS, normalizeSpaces } = await import("./cv-builder-types.ts");

const FONTS = new URL("../../public/fonts/cv/", import.meta.url);

/** Points de code présents dans une police TrueType (sous-tables cmap de format 4 et 12). */
function codepoints(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tables = view.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < tables; i++) {
    const record = 12 + i * 16;
    if (String.fromCharCode(...buffer.subarray(record, record + 4)) === "cmap") cmap = view.getUint32(record + 8);
  }
  assert.ok(cmap >= 0, "table cmap absente");
  const set = new Set();
  const count = view.getUint16(cmap + 2);
  for (let i = 0; i < count; i++) {
    const offset = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
    const format = view.getUint16(offset);
    if (format === 4) {
      const segments = view.getUint16(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const end = view.getUint16(ends + s * 2);
        const start = view.getUint16(starts + s * 2);
        const delta = view.getInt16(deltas + s * 2);
        const rangeOffset = view.getUint16(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph = rangeOffset
            ? view.getUint16(ranges + s * 2 + rangeOffset + (c - start) * 2)
            : (c + delta) & 0xffff;
          if (glyph) set.add(c);
        }
      }
    } else if (format === 12) {
      const groups = view.getUint32(offset + 12);
      for (let g = 0; g < groups; g++) {
        const base = offset + 16 + g * 12;
        const start = view.getUint32(base);
        const end = view.getUint32(base + 4);
        for (let c = start; c <= end; c++) set.add(c);
      }
    }
  }
  return set;
}

const files = readdirSync(FONTS).filter((f) => f.endsWith(".ttf")).sort();
const coverage = new Map(files.map((f) => [f, codepoints(readFileSync(new URL(f, FONTS)))]));

/** Caractères d'un CV en français ou en anglais (textes traduits compris). */
const CV_CHARACTERS = [
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  "àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ",
  ".,;:!?'\"()[]/-+&@#%*_",
  "’‘“”«»€£$–—…•",
  " ",
].join("");

test("les polices proposées par le CV Builder sont présentes (4 fichiers chacune) ; toutes les polices du dossier sont vérifiées", () => {
  assert.equal(CV_FONTS.length, 11);
  // 15 familles dans le dossier (dont celles des autres éditeurs) : toutes vérifiées ci-dessous.
  assert.equal(files.length, 60);
  for (const font of CV_FONTS) {
    for (const suffix of ["400", "700", "400-italic", "700-italic"]) assert.ok(files.includes(`${font.id}-${suffix}.ttf`), `${font.id}-${suffix}`);
  }
});

test("chaque police contient tous les caractères d'un CV français ou anglais", () => {
  for (const [file, set] of coverage) {
    const missing = [...CV_CHARACTERS].filter((c) => !set.has(c.codePointAt(0)));
    assert.deepEqual(missing, [], file);
  }
});

test("espaces fines : absentes de plusieurs polices, d'où leur remplacement avant le PDF", () => {
  const withoutNarrow = [...new Set(files.filter((f) => !coverage.get(f).has(0x202f)).map((f) => f.replace(/-\d+(-italic)?\.ttf$/, "")))];
  assert.ok(withoutNarrow.length >= 1, "au moins une police sans U+202F");
  const text = normalizeSpaces("Hausse de 15 % : 1 200 clients");
  for (const [file, set] of coverage) {
    const missing = [...text].filter((c) => !set.has(c.codePointAt(0)));
    assert.deepEqual(missing, [], file);
  }
});

test("PDF : le texte passe par normalizeSpaces avant le rendu", () => {
  const source = readFileSync(new URL("../components/cv-builder/cv-document.tsx", import.meta.url), "utf8");
  assert.match(source, /const text = normalizeSpaces\(raw\);/);
});
