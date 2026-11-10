import "server-only";

import type { Application, ApplicationDetail } from "./types";
import { generateCoverLetter, type CandidateProfile } from "./claude";
import { coverLetterToHtml } from "./cover-letter";
import { sanitizeCvHtml } from "./cv-html";

/**
 * Rédaction d'une lettre de motivation (« Générer ma lettre » et action confirmée de Lumeo) :
 * lettre de Claude pour cette candidature, mise en HTML nettoyé. Le nom du compte fait foi
 * (en-tête, objet et signature), même si le CV en indique un autre. Null : pas de lettre.
 * Ni contrôle d'accès ni décompte ici : c'est à l'appelant (checkAiAccess / recordAiUsage).
 */
export async function writeCoverLetterHtml(
  candidate: CandidateProfile,
  app: Pick<Application, "position" | "company" | "location"> & Pick<ApplicationDetail, "offer_description" | "offer_summary">,
  signer: string | null,
): Promise<string | null> {
  const letter = await generateCoverLetter(
    candidate,
    {
      position: app.position,
      company: app.company,
      location: app.location,
      summary: app.offer_summary ?? null,
      description: app.offer_description,
    },
    signer,
  );
  if (!letter) return null;
  if (signer) letter.nom = signer;
  return sanitizeCvHtml(coverLetterToHtml(letter, app.position));
}
