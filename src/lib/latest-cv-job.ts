import "server-only";

import { getLatestBuilderCv } from "./cv-builder";
import { targetJobOf } from "./cv-builder-types";

/**
 * Métier visé du dernier CV (« Quel poste vises-tu ? », import, sinon intitulé du CV), ou null.
 * Sans échec : sans CV ou si la lecture échoue, null.
 */
export async function latestCvTargetJob(): Promise<string | null> {
  try {
    const cv = await getLatestBuilderCv();
    const job = cv ? (targetJobOf(cv.data) || cv.data.personal.jobTitle).trim() : "";
    return job.length >= 2 ? job : null;
  } catch (error) {
    console.error("[offres] métier du dernier CV", error);
    return null;
  }
}
