import "server-only";

import { unstable_rethrow } from "next/navigation";

import { checkAiRateLimit } from "./ai-usage";
import { saveCvSuggestions, type ApplicationDetailResult } from "./applications";
import { claudeErrorMessage, extractOfferKeywords, isClaudeConfigured, type OfferContext } from "./claude";
import { weighKeywords } from "./cv-keyword-match";
import { readCvSuggestions } from "./cv-types";
import { fullName, type AccountName } from "./person-name";

// CV du CV Builder créé pour une candidature : nom du CV et mots-clés de l'offre.

export function offerContext({ application: app }: ApplicationDetailResult): OfferContext {
  return {
    position: app.position,
    company: app.company,
    location: app.location,
    summary: app.offer_summary ?? null,
    description: app.offer_description,
  };
}

/** Nom du CV : « CV Prénom Nom - Entreprise », « CV - Entreprise » ou « CV Prénom Nom ». */
export function applicationCvTitle(name: AccountName | null, company: string) {
  const person = name ? fullName(name) : "";
  const employer = company.trim();
  if (person && employer) return `CV ${person} - ${employer}`;
  if (employer) return `CV - ${employer}`;
  return person ? `CV ${person}` : "CV";
}

/**
 * CV d'une candidature : contenu avec le poste de la candidature pour poste visé (à défaut, celui
 * du CV) et nom « CV Prénom Nom - Entreprise ». Partagé par le CV Builder et l'adaptation de Lumeo.
 */
export function applicationCvDraft<T extends { targetJob: string; personal: { jobTitle: string } }>(
  data: T,
  application: { company: string; position: string },
  name: AccountName | null,
): { data: T; title: string } {
  const targetJob = application.position.trim().slice(0, 120) || data.targetJob;
  const jobTitle = data.personal.jobTitle.trim() || targetJob;
  return {
    data: { ...data, targetJob, personal: { ...data.personal, jobTitle } },
    title: applicationCvTitle(name, application.company),
  };
}

/**
 * Mots-clés de l'offre, générés une seule fois par candidature : onglet « Mots-clés » du CV Builder
 * et coach. Hors quota et sans échec : sans eux, le CV est quand même créé. Sans texte d'offre,
 * rien à comparer : pas d'appel à l'IA.
 */
export async function ensureOfferKeywords(detail: ApplicationDetailResult): Promise<void> {
  const app = detail.application;
  if (!isClaudeConfigured() || readCvSuggestions(app.cv_suggestions)?.kind === "keywords") return;
  if (!app.offer_description?.trim() && !app.offer_summary?.trim()) return;
  try {
    const rate = await checkAiRateLimit();
    if (!rate.ok) return;
    const extracted = await extractOfferKeywords(offerContext(detail));
    if (!extracted) return;
    const keywords = weighKeywords(extracted.mots_cles, {
      usefulText: extracted.offre_utile,
      position: app.position,
      company: app.company,
    });
    if (!keywords.length) return;
    await saveCvSuggestions(app.id, { kind: "keywords", keywords, ignored: [], conseils: [], titre_cv: "", cvText: null });
  } catch (error) {
    unstable_rethrow(error);
    claudeErrorMessage(error, "CV de la candidature : mots-clés de l'offre"); // journalisation
  }
}
