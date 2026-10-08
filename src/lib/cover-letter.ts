// Lettre de motivation : contenu structuré (généré par Claude) → HTML de l'éditeur.
// Même format que le CV amélioré (balises sans attributs, nettoyées par sanitizeCvHtml) :
// <h1> nom, <p> coordonnées / destinataire / date, <h2> objet, <p> paragraphes.

import { inline } from "./cv-html";

export type CoverLetter = {
  nom: string;
  coordonnees: string;
  ville: string;
  destinataire: string;
  formule_appel: string;
  accroche: string;
  pourquoi_entreprise: string;
  pourquoi_moi: string;
  conclusion: string;
  formule_politesse: string;
};

const letterDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Objet imposé : « Candidature au poste de [Poste] — [Prénom Nom] ». */
export function coverLetterSubject(position: string, name: string) {
  return `Candidature au poste de ${position.trim()} — ${name.trim()}`;
}

export function coverLetterToHtml(letter: CoverLetter, position: string, date: Date = new Date()): string {
  const place = letter.ville.trim() ? `${inline(letter.ville)}, le ` : "Le ";
  const parts = [`<h1>${inline(letter.nom)}</h1>`];
  if (letter.coordonnees.trim()) parts.push(`<p>${inline(letter.coordonnees)}</p>`);
  if (letter.destinataire.trim()) parts.push(`<p>${inline(letter.destinataire)}</p>`);
  parts.push(`<p>${place}${letterDate.format(date)}</p>`);
  // Objet : sans surlignage (imposé, pas une personnalisation).
  parts.push(`<h2>Objet : ${inline(coverLetterSubject(position, letter.nom.replace(/[⟦⟧]/g, "")))}</h2>`);
  for (const paragraph of [
    letter.formule_appel,
    letter.accroche,
    letter.pourquoi_entreprise,
    letter.pourquoi_moi,
    letter.conclusion,
    letter.formule_politesse,
  ]) {
    if (paragraph.trim()) parts.push(`<p>${inline(paragraph)}</p>`);
  }
  parts.push(`<p><strong>${inline(letter.nom)}</strong></p>`);
  return parts.join("\n");
}

/**
 * Lettre vierge pour l'éditeur (aucune lettre encore enregistrée) : en-tête, objet et
 * formules, à compléter à la main ou en demandant au chat de rédiger la lettre.
 */
export function emptyCoverLetterHtml(
  position: string,
  company: string,
  name: string | null,
  date: Date = new Date(),
): string {
  const signer = name?.trim() || "Prénom Nom";
  return [
    `<h1>${inline(signer)}</h1>`,
    "<p>Email · Téléphone · Ville</p>",
    `<p>${inline(company)}</p>`,
    `<p>Le ${letterDate.format(date)}</p>`,
    `<h2>Objet : ${inline(coverLetterSubject(position, signer))}</h2>`,
    "<p>Madame, Monsieur,</p>",
    "<p>Écris ta lettre ici, ou demande au chat de la rédiger pour toi à partir de l'offre et de ton CV.</p>",
    "<p>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>",
    `<p><strong>${inline(signer)}</strong></p>`,
  ].join("\n");
}
