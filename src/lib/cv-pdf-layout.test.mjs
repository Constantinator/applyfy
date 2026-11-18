// Mise en page du PDF d'un CV (lot PDF, P1 à P5) : les 6 modèles sont rendus pour de vrai avec
// @react-pdf/renderer, puis relus avec pdfjs-dist. Vérifie le nombre de pages, les coupures de page
// (aucun titre de section seul en bas de page, jamais une puce seule en haut ou en bas de page) et
// l'ordre du texte extrait par un ATS. Contenus fictifs (cv-pdf-layout.fixtures.mjs).
// Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

await import("../../scripts/eval/register.mjs");

// Les modèles sont des fichiers .tsx (JSX, alias « @/ ») : transpilés à la volée pour ce test.
const SRC = new URL("../", import.meta.url);
const withExtension = (url) => [".ts", ".tsx", ""].map((ext) => new URL(url.href + ext)).find((u) => existsSync(u));
registerHooks({
  resolve(spec, ctx, next) {
    const base = spec.startsWith("@/") ? new URL(spec.slice(2), SRC) : spec.startsWith(".") && ctx.parentURL?.endsWith(".tsx") ? new URL(spec, ctx.parentURL) : null;
    const found = base && !/\.[a-z]+$/i.test(spec) ? withExtension(base) : null;
    return found ? { url: found.href, shortCircuit: true } : next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith(".tsx")) return next(url, ctx);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});

const { createElement } = await import("react");
const { renderToBuffer } = await import("@react-pdf/renderer");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { CvDocument, registerCvFonts } = await import("../components/cv-builder/cv-document.tsx");
const { CV_SECTION_TITLES, CV_TEMPLATE_IDS, CvDataSchema, frenchNoBreak, noBreakParts, withoutEmptyLines } = await import("./cv-builder-types.ts");
const fixtures = await import("./cv-pdf-layout.fixtures.mjs");

registerCvFonts(fileURLToPath(new URL("../../public", import.meta.url)).replaceAll("\\", "/"));

const PAGE_WIDTH = 595.28;
/** Colonne latérale du modèle Sidebar : 30 % de la page. */
const SIDE_COLUMN = PAGE_WIDTH * 0.3;

/** Texte comparable : sans blancs (espaces insécables compris), en majuscules. */
const norm = (text) => text.replace(/[\s ]+/g, "").toUpperCase();
const TITLES = new Set(Object.entries(CV_SECTION_TITLES.fr).filter(([key]) => key !== "present" && key !== "colon").map(([, title]) => norm(title)));
const isBullet = (line) => /^[•▪]/.test(line.text.trim());

/**
 * PDF rendu puis relu. Par page : `lines`, les lignes de texte de haut en bas (x du début de ligne) ;
 * `stream`, les lignes dans l'ordre du fichier, celui que lit un ATS.
 */
async function render(templateId, data, language = "fr") {
  const cv = withoutEmptyLines(CvDataSchema.parse(data));
  const buffer = await renderToBuffer(createElement(CvDocument, { data: cv, templateId, title: "CV de test", language }));
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim()).map((item) => ({ text: item.str, x: item.transform[4], y: item.transform[5] }));
      // Ordre du fichier : une nouvelle ligne quand la hauteur change.
      const stream = [];
      for (const item of items) {
        const last = stream.at(-1);
        if (last && Math.abs(last.y - item.y) < 2) last.text += item.text;
        else stream.push({ ...item });
      }
      // De haut en bas, par colonne (le Sidebar en a deux) : même ligne à 2 points près.
      const columns = templateId === "sidebar" ? [items.filter((i) => i.x < SIDE_COLUMN), items.filter((i) => i.x >= SIDE_COLUMN)] : [items];
      const lines = columns.map((column) => {
        const rows = [];
        for (const item of [...column].sort((a, b) => b.y - a.y || a.x - b.x)) {
          const last = rows.at(-1);
          if (last && Math.abs(last.y - item.y) < 2) last.text += ` ${item.text}`;
          else rows.push({ ...item });
        }
        return rows;
      });
      pages.push({ stream, columns: lines });
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

/**
 * Nombre de pages attendu. `before` : nombre de pages avant le lot PDF (main 5634f29), pour le CV moyen.
 * Lot rendu 2 : compétences à la suite, le CV moyen tient en 1 page en Minimaliste, Classique et Moderne.
 */
const EXPECTED = {
  minimaliste: { court: 1, moyen: 1, dense: 2, before: 2 },
  classique: { court: 1, moyen: 1, dense: 2, before: 2 },
  moderne: { court: 1, moyen: 1, dense: 2, before: 2 },
  // Avant le lot, le Sidebar dense était écrasé sur une seule page (textes superposés).
  sidebar: { court: 1, moyen: 1, dense: 2, before: 1 },
  tech: { court: 1, moyen: 1, dense: 2, before: 1 },
  finance: { court: 1, moyen: 1, dense: 2, before: 1 },
};

/** Ordre de lecture d'un ATS, propre à chaque modèle (inchangé par le lot). */
const t = CV_SECTION_TITLES.fr;
const ONE_COLUMN = ["name", t.profile, t.experiences, t.education, t.skills, t.languages];
const ORDER = {
  minimaliste: ONE_COLUMN,
  classique: ONE_COLUMN,
  moderne: ONE_COLUMN,
  tech: ONE_COLUMN,
  finance: ["name", t.summary, t.education, t.experiences, t.skillsLanguages],
  // Colonne latérale d'abord, puis la colonne principale.
  sidebar: [t.contact, t.education, t.skills, t.languages, "name", t.profile, t.experiences],
};

test("les 6 modèles sont couverts", () => {
  assert.deepEqual([...CV_TEMPLATE_IDS].sort(), Object.keys(EXPECTED).sort());
});

for (const templateId of CV_TEMPLATE_IDS) {
  for (const content of ["court", "moyen", "dense"]) {
    test(`PDF ${templateId} / ${content} : pages, titres jamais seuls en bas de page, ordre du texte`, async () => {
      const data = fixtures[content];
      const pages = await render(templateId, data);

      assert.equal(pages.length, EXPECTED[templateId][content], "nombre de pages");
      if (content === "moyen") assert.ok(pages.length <= EXPECTED[templateId].before, "le CV moyen ne prend pas plus de pages qu'avant le lot");

      pages.forEach((page, p) => {
        for (const lines of page.columns) {
          const last = lines.at(-1);
          if (last) assert.ok(!TITLES.has(norm(last.text)), `page ${p + 1} : le titre « ${last.text} » est le dernier élément de la page`);
        }
      });

      const stream = pages.flatMap((page) => page.stream.map((line) => norm(line.text)));
      const name = norm(`${data.personal.firstName}${data.personal.lastName}`);
      const positions = ORDER[templateId].map((marker) => stream.indexOf(marker === "name" ? name : norm(marker)));
      assert.ok(positions.every((position) => position >= 0), `repères trouvés dans le texte extrait : ${positions}`);
      assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "ordre du texte extrait");
    });
  }
}

/** Lignes de texte de tout le CV, de haut en bas (colonne par colonne). */
const allLines = (pages) => pages.flatMap((page) => page.columns.flat().map((line) => line.text.replace(/ /g, " ").trim()));

test("compétences à la suite : le CV moyen tient en 1 page (Minimaliste, Classique, Moderne)", async () => {
  for (const templateId of ["minimaliste", "classique", "moderne"]) {
    const pages = await render(templateId, fixtures.moyen);
    assert.equal(pages.length, 1, `${templateId} : CV moyen sur 1 page`);
    const lines = allLines(pages);
    assert.ok(lines.some((line) => /^Gestion de projet agile · Jira · Figma/.test(line)), `${templateId} : compétences sur une même ligne`);
  }
});

test("compétences : groupes sur leur ligne, niveau écrit dans la langue du CV, données intactes", async () => {
  const data = {
    ...fixtures.moyen,
    skills: [
      { id: "a", name: "Jira", level: "avance" },
      { id: "b", name: "Figma" },
      { id: "c", name: "Outils : Notion, Miro" },
      { id: "d", name: "SQL", level: "debutant" },
    ],
  };
  const fr = allLines(await render("minimaliste", data));
  assert.ok(fr.includes("Jira (avancé) · Figma"), fr.join(" | "));
  assert.ok(fr.includes("Outils : Notion, Miro"));
  assert.ok(fr.includes("SQL (débutant)"));
  const en = allLines(await render("minimaliste", data, "en"));
  assert.ok(en.includes("Jira (advanced) · Figma"), en.join(" | "));
  assert.ok(en.includes("SQL (beginner)"));
  // Moderne avec des niveaux : grille à deux colonnes, niveau écrit à côté de la barre.
  const moderne = allLines(await render("moderne", data, "en"));
  assert.ok(moderne.some((line) => /\bJira\b/.test(line) && /\bAdvanced\b/.test(line) && !line.includes("·")), moderne.join(" | "));
  assert.equal(data.skills[0].level, "avance", "niveau enregistré inchangé");
});

test("titres : aucun texte extrait en lettres séparées par des espaces (« F O R M A T I O N »)", async () => {
  // Trois lettres isolées de suite, séparées par des espaces : signe d'un espacement des lettres que
  // l'extraction d'un ATS transforme en espaces.
  const spaced = /(?:^|\s)\p{L}(?: \p{L}){2,}(?:\s|$)/u;
  const titles = Object.entries(CV_SECTION_TITLES.fr).filter(([key]) => key !== "present" && key !== "colon").map(([, title]) => title.toUpperCase());
  for (const templateId of CV_TEMPLATE_IDS) {
    for (const content of ["moyen", "dense"]) {
      const pages = await render(templateId, fixtures[content]);
      const lines = pages.flatMap((page) => page.stream.map((line) => line.text.replace(/ /g, " ").trim()));
      for (const line of lines) assert.doesNotMatch(line, spaced, `${templateId} / ${content} : « ${line} »`);
      // Les titres de section se retrouvent tels quels (espaces entre les mots seulement).
      const found = lines.filter((line) => titles.includes(line.toUpperCase()));
      assert.ok(found.length >= 4, `${templateId} / ${content} : titres extraits ${JSON.stringify(found)}`);
      // Nom (Finance : capitales légèrement espacées) : prénom et nom sont deux textes, l'extraction ne garde
      // pas toujours l'espace entre eux ; les lettres, elles, ne sont jamais séparées (vérifié ci-dessus).
      const name = norm(`${fixtures[content].personal.firstName}${fixtures[content].personal.lastName}`);
      assert.ok(lines.some((line) => norm(line) === name), `${templateId} / ${content} : nom extrait`);
    }
  }
});

test("Finance : puces « • » à la taille du texte, niveaux de langue sans parenthèses imbriquées", async () => {
  const pages = await render("finance", fixtures.moyen);
  const lines = allLines(pages);
  assert.ok(lines.some((line) => line.startsWith("• Piloté la refonte")), lines.join(" | "));
  assert.ok(!lines.some((line) => line.includes("▪")));
  const languages = lines.find((line) => line.startsWith("Langues"));
  assert.match(languages, /Anglais — Courant \(TOEIC 915\)/);
  assert.doesNotMatch(languages, /\([^)]*\(/, "parenthèses imbriquées");
});

test("Sidebar : URL longue coupée après « / », « . » ou « - » sans tiret ajouté, niveau écrit à côté de la barre", async () => {
  const linkedin = "https://www.linkedin.com/in/jean-baptiste-de-la-fontaine-exemple-123456789/";
  const data = {
    ...fixtures.dense,
    personal: { ...fixtures.dense.personal, linkedin },
    skills: [
      { id: "a", name: "Python", level: "avance" },
      { id: "b", name: "Outils : Jira, Productboard, Figma, Amplitude, Looker, Notion", level: "intermediaire" },
    ],
  };
  const [first] = await render("sidebar", data);
  const side = first.columns[0];
  // Lignes de l'URL : bout à bout, l'URL affichée (sans https:// ni www.), coupée seulement après / . -
  const start = side.findIndex((line) => line.text.startsWith("linkedin.com/"));
  assert.ok(start >= 0, side.map((l) => l.text).join(" | "));
  let shown = "";
  let i = start;
  while (!shown.endsWith("123456789")) {
    const text = side[i].text.trim();
    if (i > start) assert.match(shown, /[/.-]$/, `coupure après « / », « . » ou « - » : « ${shown} »`);
    shown += text;
    i += 1;
  }
  assert.ok(i - start >= 2, "URL sur plusieurs lignes");
  assert.equal(shown, "linkedin.com/in/jean-baptiste-de-la-fontaine-exemple-123456789");
  // Niveau écrit, jamais de tiret ajouté entre une compétence et son niveau (« Notion- » / « · Intermédiaire »).
  const text = side.map((line) => line.text.replace(/ /g, " ").trim());
  assert.ok(text.some((line) => line === "Python · Avancé"), text.join(" | "));
  assert.ok(text.some((line) => line.endsWith("Intermédiaire")), text.join(" | "));
  for (let n = 1; n < text.length; n++) assert.ok(!(text[n - 1].endsWith("-") && text[n].startsWith("·")), `« ${text[n - 1]} » / « ${text[n]} »`);
  const en = (await render("sidebar", data, "en"))[0].columns[0].map((line) => line.text.replace(/ /g, " ").trim());
  assert.ok(en.includes("Python · Advanced"), en.join(" | "));
});

test("expérience longue : coupée entre deux puces, jamais une puce seule en haut ou en bas de page", async () => {
  // 6 expériences de 9 à 12 puces d'une ligne : plusieurs sont coupées par un saut de page.
  const data = {
    personal: { firstName: "Inès", lastName: "Caron", jobTitle: "Cheffe de projet" },
    experiences: Array.from({ length: 6 }, (_, e) => ({
      id: `e${e}`,
      position: `Poste fictif ${e + 1}`,
      company: `Entreprise fictive ${e + 1}`,
      startDate: `0${e + 1}/2020`,
      endDate: `0${e + 1}/2021`,
      // Longueurs variées : les sauts de page ne tombent pas tous entre deux expériences.
      bullets: Array.from({ length: 12 - (e % 4) }, (_, b) => `Réalisation fictive numéro ${b + 1} du poste ${e + 1}`),
    })),
  };
  for (const templateId of ["minimaliste", "tech", "sidebar", "finance"]) {
    const pages = await render(templateId, data);
    assert.ok(pages.length >= 2, `${templateId} : plusieurs pages`);
    let cut = 0;
    pages.forEach((page, p) => {
      const lines = page.columns.at(-1);
      const leading = lines.findIndex((line) => !isBullet(line));
      const top = leading === -1 ? lines.length : leading;
      const trailing = [...lines].reverse().findIndex((line) => !isBullet(line));
      const bottom = trailing === -1 ? lines.length : trailing;
      assert.notEqual(top, 1, `${templateId}, page ${p + 1} : une puce seule en haut de page`);
      assert.notEqual(bottom, 1, `${templateId}, page ${p + 1} : une puce seule en bas de page`);
      if (top >= 2) cut += 1;
    });
    assert.ok(cut >= 1, `${templateId} : au moins une expérience coupée entre deux puces`);
  }
});

test("typographie : espace insécable avant « : » et « % » en français seulement, texte enregistré intact", async () => {
  assert.equal(frenchNoBreak("Hausse de 15 % : oui", "fr"), "Hausse de 15 % : oui");
  assert.equal(frenchNoBreak("Up 15 % : yes", "en"), "Up 15 % : yes");
  assert.equal(frenchNoBreak("https://exemple.fr 15%", "fr"), "https://exemple.fr 15%");
  // Aperçu : mêmes caractères, découpés en morceaux libres (pairs) et insécables (impairs).
  const parts = noBreakParts("Outils : Jira, +20 % de ventes", "fr");
  assert.equal(parts.join(""), "Outils : Jira, +20 % de ventes");
  assert.deepEqual(parts.filter((_, i) => i % 2 === 1), ["Outils :", "+20 %"]);
  assert.deepEqual(noBreakParts("Tools : Jira", "en"), ["Tools : Jira"]);
  assert.equal(CV_SECTION_TITLES.fr.colon, " : ");
  assert.equal(CV_SECTION_TITLES.en.colon, ": ");

  // PDF (modèle Tech, où cette puce arrive en bout de ligne) : en français « 4,2 % » reste sur une ligne ;
  // en anglais rien n'est ajouté, et le « % » passe seul à la ligne. Le texte extrait rend une espace
  // ordinaire dans les deux cas (même glyphe) : c'est la coupure de ligne qui est vérifiée.
  const lines = async (language) => (await render("tech", fixtures.court, language)).flatMap((page) => page.stream.map((line) => line.text.trim()));
  const french = await lines("fr");
  assert.ok(french.some((line) => /4,2[  ]%$/.test(line)), "français : « 4,2 % » sur une seule ligne");
  assert.ok(!french.includes("%"));
  assert.ok((await lines("en")).includes("%"), "anglais : aucune espace insécable ajoutée");
  assert.equal(fixtures.court.experiences[0].bullets[0].includes(" "), false);
});

test("coordonnées : le séparateur « · » n'est jamais en début ni en fin de ligne", async () => {
  for (const templateId of ["minimaliste", "classique", "moderne", "tech", "finance"]) {
    const [first] = await render(templateId, fixtures.dense);
    const contacts = first.columns[0].filter((line) => line.text.includes("exemple"));
    assert.ok(contacts.length >= 2, `${templateId} : coordonnées sur plusieurs lignes`);
    for (const line of contacts.slice(0, 3)) assert.doesNotMatch(line.text.trim(), /^·|·$/, `${templateId} : « ${line.text} »`);
  }
});

test("react-pdf : fixed et wrap ne sont jamais transmis non définis", () => {
  const source = readFileSync(new URL("../components/cv-builder/cv-document.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(fixed|wrap|minPresenceAhead)=\{(fixed|wrap|minPresenceAhead)\}/);
  assert.match(source, /\{\.\.\.defined\(\{ fixed, wrap, minPresenceAhead \}\)\}/);
});

test("PDF : les espaces fines (absentes de plusieurs polices) sont remplacées dans le texte remis à react-pdf", async () => {
  // Le texte extrait ne suffit pas : pdfjs rend toute espace comme une espace simple. On lit donc l'arbre
  // remis à react-pdf (ses éléments sont de simples balises pour react-dom).
  const { renderToStaticMarkup } = await import("react-dom/server");
  const data = CvDataSchema.parse({ ...fixtures.court, summary: "Hausse de 15 % : 1 200 clients et 3 sites." });
  for (const templateId of CV_TEMPLATE_IDS) {
    const markup = renderToStaticMarkup(createElement(CvDocument, { data, templateId, title: "CV de test" }));
    assert.ok(markup.includes("Hausse de 15 % : 1 200 clients et 3 sites."), `${templateId} : espaces insécables à la place des espaces fines`);
    assert.ok(!/[  ]/.test(markup), `${templateId} : aucune espace fine`);
  }
});
