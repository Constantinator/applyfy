// PDF d'un CV traduit (lot traduction, C6) : les polices du CV (public/fonts/cv, utilisées par
// @react-pdf) contiennent tous les caractères d'un CV en français ou en anglais, une fois les
// espaces fines remplacées (normalizeSpaces). Table « cmap » lue directement dans les fichiers.
// Lancé par `npm test`.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CV_FONTS, CV_SETTING_FONTS, CV_TEMPLATE_DEFAULTS, normalizeSpaces } = await import("./cv-builder-types.ts");
const { CV_FONT_WIDTHS } = await import("./cv-font-widths.ts");

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

const SUFFIXES = ["400", "700", "400-italic", "700-italic"];

test("les polices du CV Builder sont présentes (4 fichiers chacune) ; toutes les polices du dossier sont déclarées et vérifiées", () => {
  for (const font of CV_FONTS) {
    for (const suffix of SUFFIXES) assert.ok(files.includes(`${font.id}-${suffix}.ttf`), `${font.id}-${suffix}`);
  }
  // Aucun fichier en trop ni en moins : le dossier contient exactement les polices déclarées.
  assert.equal(files.length, CV_FONTS.length * SUFFIXES.length);
  assert.equal(new Set(CV_FONTS.map((f) => f.id)).size, CV_FONTS.length);
});

test("réglages des nouveaux modèles : 6 polices libres, chacune en regular, bold, italic et bold italic", () => {
  assert.deepEqual(CV_SETTING_FONTS.map((f) => f.id).sort(), ["arimo", "caladea", "carlito", "eb-garamond", "gelasio", "tinos"]);
  const declared = new Set(CV_FONTS.map((f) => f.id));
  for (const font of CV_SETTING_FONTS) {
    assert.ok(declared.has(font.id), `${font.id} déclarée pour l'aperçu et le PDF`);
    for (const suffix of SUFFIXES) assert.ok(files.includes(`${font.id}-${suffix}.ttf`), `${font.id}-${suffix}`);
  }
  // La police par défaut d'un modèle réglable est l'une des 6.
  for (const [id, defaults] of Object.entries(CV_TEMPLATE_DEFAULTS)) {
    if (defaults.font) assert.ok(CV_SETTING_FONTS.some((f) => f.id === defaults.font), id);
  }
});

test("accent par défaut des 6 premiers modèles : strictement inchangé", () => {
  // Valeurs de TEMPLATE_ACCENTS (cv-style-panel.tsx) avant la table CV_TEMPLATE_DEFAULTS, main 8827a21.
  const before = { minimaliste: "#111827", classique: "#111827", moderne: "#1E40AF", sidebar: "#1E293B", tech: "#059669", finance: "#000000" };
  for (const [id, accent] of Object.entries(before)) {
    assert.equal(CV_TEMPLATE_DEFAULTS[id].accent, accent, id);
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


test("chaque police est lisible par le moteur du PDF (fontkit), espace insécable comprise", async () => {
  // Arimo et Carlito : dans les fichiers de l'API Google Fonts (fonts.gstatic.com), l'espace insécable est
  // le dernier glyphe d'une table « glyf » placée en fin de fichier, et fontkit 2.0.4 lit au-delà du
  // fichier (PDF impossible dès la première espace insécable, donc pour tout CV en français). Le dépôt
  // contient les fichiers amont officiels, non modifiés, qui n'ont pas ce défaut (cf. LICENCES.md).
  const fontkit = await import("fontkit");
  for (const file of files) {
    const font = fontkit.create(readFileSync(new URL(file, FONTS)));
    for (const char of `${CV_CHARACTERS}\u00A0`) {
      assert.doesNotThrow(() => {
        const glyph = font.glyphForCodePoint(char.codePointAt(0));
        void glyph.advanceWidth;
        void glyph.bbox;
      }, `${file} : U+${char.codePointAt(0).toString(16).toUpperCase()}`);
    }
  }
});

test("Arimo et Carlito : fichiers amont officiels, non modifiés (empreintes de LICENCES.md)", () => {
  const licences = readFileSync(new URL("LICENCES.md", FONTS), "utf8");
  const expected = [...licences.matchAll(/^\| ((?:arimo|carlito)-[\w-]+\.ttf) \| [\w-]+\.ttf \| ([0-9a-f]{64}) \|/gm)];
  assert.equal(expected.length, 8);
  for (const [, file, sha] of expected) {
    assert.equal(createHash("sha256").update(readFileSync(new URL(file, FONTS))).digest("hex"), sha, file);
  }
});

test("6 polices des réglages : texte de la licence (OFL 1.1) et mention de copyright à côté des fichiers servis", () => {
  const licences = readFileSync(new URL("LICENCES.md", FONTS), "utf8");
  // Mention de copyright de chaque famille chez l'amont.
  const copyright = {
    tinos: "Copyright 2026 The Tinos Project Authors (https://github.com/googlefonts/tinos)",
    arimo: "Copyright 2026 The Arimo Project Authors (https://github.com/googlefonts/Arimo)",
    carlito: 'Copyright 2013 The Carlito Project Authors (https://github.com/googlefonts/carlito), with Reserved Font Name "Carlito"',
    caladea: "Copyright 2012 The Caladea Project Authors (https://github.com/huertatipografica/Caladea)",
    gelasio: "Copyright 2022 The Gelasio Project Authors (https://github.com/SorkinType/Gelasio)",
    "eb-garamond": "Copyright 2017 The EB Garamond Project Authors (https://github.com/octaviopardo/EBGaramond12)",
  };
  assert.deepEqual(Object.keys(copyright).sort(), CV_SETTING_FONTS.map((f) => f.id).sort());
  for (const [id, line] of Object.entries(copyright)) {
    const text = readFileSync(new URL(`OFL-${id}.txt`, FONTS), "utf8").replaceAll("\r\n", "\n");
    assert.equal(text.split("\n")[0].trim(), line, `${id} : mention de copyright`);
    assert.match(text, /This Font Software is licensed under the SIL Open Font License, Version 1\.1\./, id);
    assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1 - 26 February 2007/, id);
    assert.match(text, /PERMISSION & CONDITIONS/, id);
    assert.match(text, /THE FONT SOFTWARE IS PROVIDED "AS IS"/, id);
    // Tableau : la famille y est déclarée sous OFL, avec son fichier de licence.
    assert.match(licences, new RegExp(`^\\| ${id}-\\* \\|.*\\| OFL 1\\.1.*\\| OFL-${id}\\.txt \\|`, "m"), `${id} : ligne de LICENCES.md`);
  }
  // Carlito : seul nom réservé parmi les 6.
  for (const id of Object.keys(copyright)) {
    const reserved = /with Reserved Font Name/.test(readFileSync(new URL(`OFL-${id}.txt`, FONTS), "utf8").split("\n")[0]);
    assert.equal(reserved, id === "carlito", id);
  }
});

test("chasses des caractères (cv-font-widths) : identiques à celles des fichiers de police", async () => {
  // Table utilisée pour couper une adresse e-mail ou une URL à la largeur réelle d'une colonne.
  const fontkit = await import("fontkit");
  assert.deepEqual(Object.keys(CV_FONT_WIDTHS).sort(), CV_SETTING_FONTS.map((f) => f.id).sort());
  for (const [id, widths] of Object.entries(CV_FONT_WIDTHS)) {
    const font = fontkit.create(readFileSync(new URL(`${id}-400.ttf`, FONTS)));
    assert.equal(widths.length, 95, id);
    for (let code = 32; code <= 126; code++) {
      assert.equal(widths[code - 32], Math.round((font.glyphForCodePoint(code).advanceWidth / font.unitsPerEm) * 1000), `${id} : « ${String.fromCharCode(code)} »`);
    }
  }
});
