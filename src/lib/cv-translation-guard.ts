import type { CvData } from "./cv-builder-types";

// Gardes de la traduction sur place (lot « traduction sur place »). Pur, sans lecture : partagé par
// le serveur (cv-builder.ts, actions/cv-builder.ts) et l'éditeur.
//
// - data.translationId : identifiant de la dernière traduction du CV, changé à chaque traduction.
//   Une écriture de `data` n'est acceptée que si son translationId est celui de la base : une
//   sauvegarde partie avant une traduction (contenu de l'ancienne langue) ne peut plus l'écraser.
// - Empreinte du contenu : relue juste avant l'écriture de la traduction. Les écritures techniques
//   (premier message du coach, analyse de l'import, lien à une candidature) changent updated_at sans
//   changer le contenu : elles ne font donc pas échouer la traduction.

/** Nouvel identifiant de traduction. */
export function newTranslationId(): string {
  return crypto.randomUUID();
}

/** Identifiant de traduction du CV ; null pour un CV jamais traduit. */
export function translationIdOf(data: Pick<CvData, "translationId">): string | null {
  return data.translationId ?? null;
}

/**
 * Filtre de la base sur `data->>translationId` pour une écriture faite à partir de `expected` :
 * « is null » pour un CV jamais traduit, « eq » sinon.
 */
export function translationFilter(expected: string | null): { column: "data->>translationId"; op: "is" | "eq"; value: string | null } {
  return expected === null
    ? { column: "data->>translationId", op: "is", value: null }
    : { column: "data->>translationId", op: "eq", value: expected };
}

/** Même règle que le filtre, pour le mode démo (sans base) et les tests. */
export function sameTranslation(stored: Pick<CvData, "translationId">, incoming: Pick<CvData, "translationId">): boolean {
  return translationIdOf(stored) === translationIdOf(incoming);
}

/**
 * Empreinte du contenu du CV : tout ce que la personne écrit ou règle, sans la photo (inchangée
 * pendant la traduction : fenêtre modale), le cache du premier message du coach, l'analyse de
 * l'import ni l'identifiant de traduction.
 */
export function contentFingerprint(data: CvData): string {
  const content: Partial<CvData> = { ...data, personal: { ...data.personal, photo: null } };
  delete content.coach;
  delete content.analysis;
  delete content.translationId;
  return JSON.stringify(content);
}

/**
 * CV écrit après la traduction : le contenu traduit, et de la ligne relue juste avant l'écriture
 * tout ce qui n'est pas traduit (photo, réglages de style, cache du coach, analyse), avec le nouvel
 * identifiant de traduction.
 */
export function mergeTranslation(fresh: CvData, translated: CvData, translationId: string): CvData {
  return {
    ...translated,
    personal: { ...translated.personal, photo: fresh.personal.photo },
    style: fresh.style,
    coach: fresh.coach,
    analysis: fresh.analysis,
    translationId,
  };
}
