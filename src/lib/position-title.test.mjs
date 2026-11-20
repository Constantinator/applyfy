// Nettoyage du titre d'une offre importée (lot « titre du poste ») : règle tidyImportedTitle,
// branchement à l'import seulement (jamais sur un titre tapé à la main), titre d'origine gardé,
// création tolérante à l'absence de la colonne position_original (migration 0042).
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
const { POSITION_ORIGINAL_MAX, cleanPosition, tidyImportedTitle } = await import("./position-title.ts");
const { insertWithOptionalColumns, isMissingColumn } = await import("./optional-columns.ts");

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Les 4 exemples du lot, avec le lieu tel qu'il arrive à l'import.
const EXAMPLES = [
  [
    "Stage-Consultant en diagnostic stratégique & analyse financière -Toulouse (H/F)",
    { company: "Groupe Alpha", location: "Télétravail" },
    "Stage-Consultant en diagnostic stratégique & analyse financière",
  ],
  [
    "VERT MARINE - Maître-nageur sauveteur / Maître-nageuse sauveteuse (H/F) - 06 - Roquebrune-Cap-Martin",
    { company: "Vert Marine", location: "06 - Roquebrune-Cap-Martin" },
    "Maître-nageur sauveteur / Maître-nageuse sauveteuse",
  ],
  [
    "STAGE - ASSISTANT(E) FINANCEMENTS STRUCTURES - Autres - Paris 8, Île de France, France",
    { company: "Societe Generale", location: "Paris 8, France" },
    "Stage - Assistant(e) financements structures",
  ],
  [
    "chef pôle opérationnel police municipale H/F - EC9536 - 41 - Blois",
    { company: "Mairie de Blois", location: "41 - Blois" },
    "Chef pôle opérationnel police municipale",
  ],
];

// Les 40 titres les plus bruyants relevés dans la base (titre, entreprise et lieu seulement).
const DATASET = [
  ["Analyste Coverage & Investment Banking France - Banque de financement et d'investissement - La Defense, Ile de France, France", {"company":"Societe Generale","location":"La Defense, France"}, "Analyste Coverage & Investment Banking France - Banque de financement et d'investissement"],
  ["STAGE - ASSISTANT(E) FINANCEMENTS STRUCTURES - Autres - Paris 8, Ile de France, France", {"company":"Societe Generale","location":"Paris 8, France"}, "Stage - Assistant(e) financements structures"],
  ["VERT MARINE - Maître-nageur sauveteur / Maître-nageuse sauveteuse (H/F)", {"company":"Vert Marine","location":"06 - Roquebrune-Cap-Martin"}, "Maître-nageur sauveteur / Maître-nageuse sauveteuse"],
  ["INTERNSHIP - Internship Financial Information Systems - March 2027 - (H/F)", {"company":"Danone","location":"PARIS"}, "Internship - Internship Financial Information Systems"],
  ["Sales Planning & Strategy Assistant - Stage (6 mois) Janvier 2027 (F/H/NB)", {"company":"Ubisoft","location":"Paris"}, "Sales Planning & Strategy Assistant - Stage Janvier 2027"],
  ["Consultant(e) Stagiaire en Transaction Services - Rennes - F/H", {"company":"EY","location":"Rennes (France)"}, "Consultant(e) Stagiaire en Transaction Services"],
  ["Stage Banquier Privé - Autres - Paris 7, Ile de France, France", {"company":"Societe Generale","location":"Paris 7, France"}, "Stage Banquier Privé"],
  ["Stage Auditeur Financier - Bordeaux - Janvier 2027 - F/H", {"company":"PwC France","location":"Bordeaux"}, "Stage Auditeur Financier"],
  ["Stage - Consultant en analyse financière - Paris (H/F)", {"company":"Groupe Alpha (secafi)","location":"Paris, 75013, FR (France)"}, "Stage - Consultant en analyse financière"],
  ["STAGE - ANALYSTE RISQUES (F/H) - SWEN CP", {"company":"Ofi Invest","location":"8th Arrondissement of Paris, Paris (France)"}, "Stage - Analyste risques - Swen CP"],
  ["Stage - 6 mois - Business Manager - F/H", {"company":"Natixis","location":"Paris (France)"}, "Stage - Business Manager"],
  ["Internship - Structured Products Sales Assistant- Paris Branch (only for french native speaker)", {"company":"Mediobanca","location":"Parigi, Francia"}, "Internship - Structured Products Sales Assistant- Paris Branch (only for french native speaker)"],
  ["Stage 2027 Chargé de pilotage financier et optimisation des ressources rares H/F", {"company":"Crédit Agricole Personal Finance & Mobility","location":"Montrouge, France"}, "Stage 2027 Chargé de pilotage financier et optimisation des ressources rares"],
  ["Stage-Consultant en diagnostic stratégique & analyse financière -Toulouse (H/F)", {"company":"Groupe Alpha","location":"Télétravail"}, "Stage-Consultant en diagnostic stratégique & analyse financière"],
  ["Stage ou alternance consultant informatique et financement de l'innovation F/H", {"company":"Deloitte France","location":"Télétravail"}, "Stage ou alternance consultant informatique et financement de l'innovation"],
  ["Stagiaire de fin d'études - Consultant Customer eXperience & CRM - F/H", {"company":"Onepoint","location":"Paris"}, "Stagiaire de fin d'études - Consultant Customer eXperience & CRM"],
  ["Développeur - vendeur / développeuse - vendeuse en photographies (H/F)", {"company":"Studio Cardon","location":"59 - DUNKERQUE"}, "Développeur - vendeur / développeuse - vendeuse en photographies"],
  ["Stage - Siège Social - Debt Capital Market (DCM) & Rating H/F", {"company":"Air Liquide","location":"Paris"}, "Stage - Siège Social - Debt Capital Market (DCM) & Rating"],
  ["Key Account Manager - Marché Logistique - Le Bourget (H/F)", {"company":"Dhl international express (france)","location":"93 - LE BOURGET"}, "Key Account Manager - Marché Logistique"],
  ["STAGE - Counterparty Risk Analyst - Front Office (H/F)", {"company":"BNP Paribas France","location":"93500 Pantin (France)"}, "Stage - Counterparty Risk Analyst - Front Office"],
  ["chef pôle opérationnel police municipale H/F - EC9536", {"company":"Mairie de Blois","location":"41 - Blois"}, "Chef pôle opérationnel police municipale"],
  ["Stage - Siège Social - Group Operations Control H/F", {"company":"Air Liquide","location":"Paris"}, "Stage - Siège Social - Group Operations Control"],
  ["Analyste financier junior - Bac+4/5 - Stage (H/F)", {"company":"Diac SA","location":"FR_REN_DIAC – Val de Fontenay, France"}, "Analyste financier junior - Bac+4/5 - Stage"],
  ["Stage - Advisory Desk Gestion de Fortune - H/F", {"company":"BNP Paribas","location":"Paris"}, "Stage - Advisory Desk Gestion de Fortune"],
  ["DEVELOPPEUR PHP SYMFONY EXPERIMENTE H/F", {"company":"Entreprise non communiquée","location":"34 - Montpellier"}, "Developpeur PHP symfony experimente"],
  ["STAGE - CLIENT BUSINESS ACTIVITY (H/F)", {"company":"Edmond de Rothschild","location":"Luxembourg (Luxembourg)"}, "Stage - Client business activity"],
  ["POLICIER ADJOINT H/F ZONE OUEST (H/F)", {"company":"Direction zonale de la police nationale","location":"35 - RENNES"}, "Policier adjoint zone ouest"],
  ["STAGE - Refinancement Long Terme F/H", {"company":"La Banque Postale","location":"Paris"}, "Stage - Refinancement Long Terme"],
  ["Stage - Consultant - H/F", {"company":"BNP Paribas","location":"Paris"}, "Stage - Consultant"],
  ["Stage Front Office DSE | Project & Export Finance Monde et Financements Export Amériques", {"company":"Société Générale","location":null}, "Stage Front Office DSE | Project & Export Finance Monde et Financements Export Amériques"],
  ["Stage ou Alternance – Assistant(e) en Gestion de Portefeuille / Gestion Sous Mandat", {"company":"Sunny Asset Management","location":"Paris"}, "Stage ou Alternance – Assistant(e) en Gestion de Portefeuille / Gestion Sous Mandat"],
  ["Stage en Coverage ICG Banks France-Belgique-Luxembourg - Janvier 2027 (f/m/d)", {"company":"HSBC Continental Europe","location":"Paris (France)"}, "Stage en Coverage ICG Banks France-Belgique-Luxembourg"],
  ["stage Analyste Financier & Investment Analyst – Investissement & Stratégie", {"company":"Eic - Experience Internship Canada","location":"Paris"}, "Stage Analyste Financier & Investment Analyst – Investissement & Stratégie"],
  ["Stage Coverage Analyst - secteur Institutionnel - Janvier 2027 (f/m/d)", {"company":"HSBC Continental Europe","location":"Paris"}, "Stage Coverage Analyst - secteur Institutionnel"],
  ["Technicien de Maintenance Multitechnique Posté - Aubervilliers (H/F)", {"company":"Emalec","location":"93 - Aubervilliers"}, "Technicien de Maintenance Multitechnique Posté"],
  ["Chargé Finance, Liquidité Groupe et Cash Management (F/H) - en stage", {"company":"Carrefour France","location":"91300 Massy (France)"}, "Chargé Finance, Liquidité Groupe et Cash Management - en stage"],
  ["Assistant temporaire police municipale ATPM  SAISON27 LOGE (H/F)", {"company":"Mairie des Gets","location":"74 - LES GETS"}, "Assistant temporaire police municipale ATPM SAISON27 LOGE"],
  ["Assistant Contrôle de Gestion Communication & Retail F/H - Stage", {"company":"Dior","location":"Paris (France)"}, "Assistant Contrôle de Gestion Communication & Retail - Stage"],
  ["Stage - Assistant(e) Key Account Manager Amazon - Janvier 2027", {"company":"Vestacy","location":"Massy"}, "Stage - Assistant(e) Key Account Manager Amazon"],
  ["Stage en Finance & Business Pilotage et suivi commercial H/F", {"company":"Amundi","location":"Paris (France)"}, "Stage en Finance & Business Pilotage et suivi commercial"],
];

// Titres déjà propres : rendus à l'identique.
const CLEAN = [
  "Analyste financier",
  "Product Manager",
  "Chargé de développement produits financement",
  "Stage - Bras droit CEO",
  "Business & Operations – Founders' Associate",
  "Group Product Manager, Generative AI, Google Cloud",
  "Stage ou Alternance – Assistant(e) en Gestion de Portefeuille / Gestion Sous Mandat",
  "Stage - Analyste financement et modélisation (janvier 2027)",
  "Key Account Management - 2027 Start",
  "Sales Development Representative Intern (FR/EN)",
  "Associate Product Marketing Manager BS/MS Intern, 2027",
  "Conducteur de Travaux GO / TCE Confirmé",
  "Internship - Junior Financial Analyst (Janvier 2027)",
  "Stage IT M&A – Tech & IT Due Diligence et PMI",
  "Développeur Full-Stack React / Node.js",
  "Alternance - Chargé de recrutement RH",
  "Manager de rayon",
  "Juriste droit des affaires",
  "Data Analyst Junior",
  "Maître-nageur sauveteur",
  "iOS Developer",
  "Bank & Fintech Partnerships - Internship - Barcelona",
];

const PROTECTED_WORDS = ["stage", "alternance", "manager", "stagiaire", "junior", "internship"];
const ALL = [...EXAMPLES, ...DATASET];
const words = (text) => new Set(text.toLowerCase().match(/\p{L}+/gu) ?? []);

test("les 4 exemples du lot sont nettoyés", () => {
  for (const [title, context, expected] of EXAMPLES) assert.equal(tidyImportedTitle(title, context), expected, title);
});

test("les 40 titres du jeu de données donnent le titre attendu", () => {
  assert.equal(DATASET.length, 40);
  for (const [title, context, expected] of DATASET) assert.equal(tidyImportedTitle(title, context), expected, title);
});

test("un titre sans bruit reste identique, avec ou sans contexte", () => {
  assert.ok(CLEAN.length >= 20);
  for (const title of CLEAN) {
    assert.equal(tidyImportedTitle(title), title, title);
    assert.equal(tidyImportedTitle(title, { company: "Acme", location: "Paris" }), title, title);
  }
});

test("idempotence : nettoyer deux fois donne le même titre", () => {
  for (const [title, context] of ALL) {
    const once = tidyImportedTitle(title, context);
    assert.equal(tidyImportedTitle(once, context), once, title);
  }
});

test("jamais retirés : Stage, Alternance, Manager, Stagiaire, Junior, sigles", () => {
  for (const [title, context] of ALL) {
    const result = tidyImportedTitle(title, context);
    for (const word of PROTECTED_WORDS) {
      if (words(title).has(word)) assert.ok(words(result).has(word), `${word} : ${title}`);
    }
    // Sigles d'un titre en casse normale (DCM, CRM, ICG, DSE, ATPM…) : gardés tels quels.
    const shouting = title.replace(/[^\p{Lu}]/gu, "").length > title.replace(/[^\p{L}]/gu, "").length / 2;
    if (shouting) continue;
    // (hors nom de l'entreprise répété en tête, retiré à dessein)
    const company = (context.company ?? "").toUpperCase();
    const sigles = (title.match(/(?<![\p{L}/])\p{Lu}{2,4}(?![\p{L}/\d])/gu) ?? []).filter(
      (s) => !["STAGE", "NB"].includes(s) && !company.includes(s),
    );
    for (const sigle of sigles) assert.ok(result.includes(sigle), `${sigle} : ${title}`);
  }
  // Titres en capitales : les sigles restent en capitales, le reste passe en casse normale.
  for (const [title, expected] of [
    ["DEVELOPPEUR PHP SYMFONY EXPERIMENTE H/F", "Developpeur PHP symfony experimente"],
    ["STAGE M&A F/H", "Stage M&A"],
    ["ALTERNANCE - CHARGE DE RECRUTEMENT RH (H/F)", "Alternance - Charge de recrutement RH"],
    ["Junior Manager - Lyon (H/F)", "Junior Manager"],
    ["Stagiaire - Lyon", "Stagiaire"],
  ]) {
    assert.equal(tidyImportedTitle(title, { location: "Lyon" }), expected, title);
  }
});

test("titre tout en bruit : le titre d'origine est rendu", () => {
  for (const title of ["H/F", "(F/H)", "06 - Nice", "(H/F) - 75", " - ", "Janvier 2027 - F/H"]) {
    assert.equal(tidyImportedTitle(title, { location: "06 - Nice" }), title.replace(/\s+/g, " ").trim(), title);
  }
});

test("garde-fous : segments ambigus et lieux non reconnus gardés", () => {
  // Ville au milieu du titre, ou ville étrangère : gardées.
  assert.equal(tidyImportedTitle("Responsable Lyon Est - Agence (H/F)", { location: "Lyon" }), "Responsable Lyon Est - Agence");
  assert.equal(tidyImportedTitle("Commercial - Barcelona", { location: "Télétravail" }), "Commercial - Barcelona");
  // Lieu retiré seulement en fin de titre, jamais le premier segment.
  assert.equal(tidyImportedTitle("Paris - Analyste", { location: "Paris" }), "Paris - Analyste");
  // Entreprise retirée seulement en tête, et jamais si c'est tout le titre.
  assert.equal(tidyImportedTitle("Analyste - Acme", { company: "Acme" }), "Analyste - Acme");
  assert.equal(tidyImportedTitle("Acme", { company: "Acme" }), "Acme");
  // Date gardée si elle ne forme pas un segment à elle seule (décision Q2).
  assert.equal(tidyImportedTitle("Analyste Crédit H/F - Stage Janvier 2027"), "Analyste Crédit - Stage Janvier 2027");
  // Référence : seulement un code reconnaissable, en fin de titre.
  assert.equal(tidyImportedTitle("Comptable - Réf. 12345"), "Comptable");
  assert.equal(tidyImportedTitle("Comptable - SAP"), "Comptable - SAP");
});

test("cleanPosition (messages de relance) n'a pas changé", () => {
  assert.equal(cleanPosition("Analyste financier (H/F)"), "Analyste financier");
  assert.equal(cleanPosition("Stage - Chargé de marketing - 6 mois"), "Stage - Chargé de marketing");
});

test("création tolérante : colonne position_original absente → réessai sans elle, une ligne de journal", async () => {
  const calls = [];
  const logs = [];
  const original = console.error;
  console.error = (line) => logs.push(line);
  try {
    const result = await insertWithOptionalColumns(
      { sector: "finance", position_original: "Analyste (H/F)" },
      async (optional) => {
        calls.push(Object.keys(optional).sort());
        return "position_original" in optional
          ? {
              data: null,
              error: { code: "PGRST204", message: "Could not find the 'position_original' column of 'applications' in the schema cache" },
            }
          : { data: { id: "a1" }, error: null };
      },
      { sector: "0038", position_original: "0042" },
      "createApplication",
    );
    assert.deepEqual(result, { data: { id: "a1" }, error: null });
    assert.deepEqual(calls, [["position_original", "sector"], ["sector"]]);
    assert.deepEqual(logs, ["[createApplication] colonne position_original absente (migration 0042)"]);
  } finally {
    console.error = original;
  }
});

test("création tolérante : plusieurs colonnes absentes ; toute autre erreur rendue telle quelle", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const missing = new Set(["sector", "position_original"]);
    const both = await insertWithOptionalColumns(
      { sector: "finance", position_original: "X", offer_description_partial: true },
      async (optional) => {
        const column = Object.keys(optional).find((c) => missing.has(c));
        return column
          ? { data: null, error: { code: "42703", message: `column "${column}" of relation "applications" does not exist` } }
          : { data: { id: "b" }, error: null };
      },
      {},
      "t",
    );
    assert.deepEqual(both.data, { id: "b" });

    let attempts = 0;
    const other = await insertWithOptionalColumns(
      { position_original: "X" },
      async () => {
        attempts++;
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      },
      {},
      "t",
    );
    assert.equal(attempts, 1);
    assert.equal(other.error.code, "23505");
  } finally {
    console.error = original;
  }
  assert.equal(isMissingColumn({ code: "PGRST204", message: "Could not find the 'sector' column" }, "position_original"), false);
});

test("branchement : nettoyage à l'import seulement, jamais sur un titre tapé à la main", () => {
  const offerActions = strip(read("../app/actions/offer.ts"));
  assert.equal((offerActions.match(/offer: tidyOffer\(await importOffer/g) ?? []).length, 3);

  const jobOffers = strip(read("../app/actions/job-offers.ts"));
  assert.match(jobOffers, /tidyImportedTitle\(offer\.title/);
  assert.match(jobOffers, /position_original: position !== offer\.title/);

  // Le formulaire et l'action de création ne nettoient jamais le titre saisi.
  const form = strip(read("../components/application/new-application-form.tsx"));
  const create = strip(read("../app/actions/applications.ts"));
  assert.doesNotMatch(form, /tidyImportedTitle|cleanPosition/);
  assert.doesNotMatch(create, /tidyImportedTitle|cleanPosition/);
  assert.match(create, /position: values\.position,/);

  // Titre d'origine envoyé seulement si le titre proposé est enregistré sans retouche.
  assert.match(form, /importedTitle && position === importedTitle\.proposed && \(\s*<input type="hidden" name="position_original"/);
  assert.match(create, /positionOriginal !== values\.position && positionOriginal\.length <= POSITION_ORIGINAL_MAX/);
  assert.equal(POSITION_ORIGINAL_MAX, 300);

  // createApplication passe par l'insertion tolérante, migration 0042 nommée.
  const store = strip(read("./applications.ts"));
  assert.match(store, /insertWithOptionalColumns<\{ id: string \}>\(/);
  assert.match(store, /position_original: "0042"/);
});

test("migration 0042 : colonne nullable seule, annulation en commentaire", () => {
  const sql = read("../../supabase/migrations/0042_position_original.sql");
  const statements = sql.replace(/--.*$/gm, "").trim();
  assert.match(statements, /^alter table applications add column if not exists position_original text;/);
  assert.doesNotMatch(statements, /not null|default|update |drop /i);
  assert.match(sql, /--\s+alter table applications drop column if exists position_original;/);
});
