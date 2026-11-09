// Secteur d'une offre ou d'une candidature (detectOfferSector) : pastilles de /candidatures et de
// Trouver une offre. Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Imports sans extension entre fichiers .ts, et JSON importé sans attribut (comme dans l'app).
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

const { detectOfferSector } = await import("./cv-sector-context.ts");

test("finance de marché reconnue, même pour un stage (le stage ne l'emporte pas sur le métier)", () => {
  const cases = {
    "Stage Coverage Analyst - secteur Institutionnel": "finance",
    "Stage - Siège Social - Debt Capital Markets": "finance",
    "Stage - Advisory Desk Gestion de Fortune": "finance",
    "STAGE - Refinancement Long Terme F/H": "finance",
    "Stage Analyste Crédit (F/H)": "finance",
    "Stage Front Office DSE | Project & Export Finance": "finance",
    "Corporate Finance Analyst": "finance",
    "Equity Capital Markets Intern": "finance",
    "Bank & Fintech Partnerships - Internship": "finance",
  };
  for (const [title, sector] of Object.entries(cases)) assert.equal(detectOfferSector(title), sector, title);
});

test("« equity » mène à la finance, jamais au luxe (Crédit Agricole CIB)", () => {
  const luxuryText = "Maison de luxe, boutique, joaillerie, parfum, cosmétique, brand equity, retail, fashion.";
  assert.equal(detectOfferSector("Assistant Chef de Projet Equity H/F", luxuryText), "finance");
  assert.equal(detectOfferSector("Assistant Chef de Projet Equity H/F"), "finance");
});

test("« stage » / « alternance » seul : étudiant, uniquement sans métier reconnu", () => {
  assert.equal(detectOfferSector("Stage - Bras droit CEO"), "etudiant");
  assert.equal(detectOfferSector("Stage - 6 mois - Business Manager - F/H"), "etudiant");
  assert.equal(detectOfferSector("Alternance - Assistant(e) de direction"), "etudiant");
  assert.equal(detectOfferSector("Stage Développeur Python"), "tech");
  assert.equal(detectOfferSector("Alternance Chargé(e) de recrutement"), "rh");
});

test("égalité ou cas ambigu : null (pastille « Autre ») plutôt qu'un secteur deviné", () => {
  // Deloitte : conseil (consultant) à égalité avec tech (informatique).
  assert.equal(detectOfferSector("Stage ou alternance consultant informatique"), null);
  // Papernest : marketing (growth) à égalité avec conseil (stratégie), quelle que soit l'orthographe.
  assert.equal(detectOfferSector("Revenue Growth Stretegy Intern"), "marketing");
  assert.equal(detectOfferSector("Revenue Growth Strategy Intern"), null);
  assert.equal(detectOfferSector("Revenue Growth Strategist Intern"), null);
  // Pas de départage « consultant l'emporte sur le domaine ».
  assert.equal(detectOfferSector("Finance & Strategy Intern"), null);
  assert.equal(detectOfferSector("Stage - Consultant en analyse financière"), null);
  assert.equal(detectOfferSector("Consultant(e) Stagiaire en Transaction Services"), null);
});

test("départages d'égalité : Software Engineer / developer → tech, Sales / SDR / Account Executive → commercial", () => {
  assert.equal(detectOfferSector("Staff Software Engineer, Display and Video Ads"), "tech");
  assert.equal(detectOfferSector("Video Developer"), "tech");
  assert.equal(detectOfferSector("Sales Strategy & Operations Intern"), "commercial");
  assert.equal(detectOfferSector("Senior Sales - Centres Hospitaliers"), "commercial");
  assert.equal(detectOfferSector("Sales Development Representative - Comptabilité"), "commercial");
  assert.equal(detectOfferSector("Account Executive - Fintech Strategy"), "commercial");
  // Les deux départages à la fois : toujours ambigu.
  assert.equal(detectOfferSector("Sales Developer"), null);
  // Sans égalité, le départage ne change rien (le marketing l'emporte ici avec 2 mots-clés).
  assert.equal(detectOfferSector("Developer Marketing & Communication Manager"), "marketing");
});

test("métier hors base sectorielle : null, jamais de faux secteur", () => {
  for (const title of ["Conducteur de travaux Grands Projets H/F", "Policier adjoint H/F", "Technicien de maintenance"]) {
    assert.equal(detectOfferSector(title), null, title);
  }
  assert.equal(detectOfferSector(""), null);
  assert.equal(detectOfferSector("Key Account Manager Beauté H/F"), "commercial");
});
