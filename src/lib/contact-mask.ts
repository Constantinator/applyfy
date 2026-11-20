// Masquage des coordonnées (adresses e-mail, numéros de téléphone français) dans le texte d'une
// offre avant de la garder en base : offres collées par les utilisateurs (user-job-offers.ts) et
// offres collectées sur les pages carrières (job-collect.ts). Sans import propre à Next.js : aussi
// chargé par scripts/scrape-jobs.ts.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+33\s?|0)[1-9]([\s.-]?\d{2}){4}/g;

/** « Écrire à jean@acme.fr ou au 06 12 34 56 78 » → « Écrire à [email] ou au [téléphone] ». */
export function maskContacts(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[téléphone]");
}
