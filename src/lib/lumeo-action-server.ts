import "server-only";

import { revalidatePath } from "next/cache";

import { getAccountName } from "./account";
import { checkAiAccess, countAiUsageToday, recordAiUsage } from "./ai-usage";
import { CVB_COACH_DAILY_LIMIT } from "./ai-usage-limits";
import { requireUser } from "./auth";
import { applicationCvDraft, ensureOfferKeywords } from "./application-cv";
import { buildFollowUpMessage, getApplicationDetail } from "./applications";
import { adaptCvToOffer, improveLumeoRelance, summarizeOffer } from "./claude";
import { writeCoverLetterHtml } from "./cover-letter-writer";
import {
  createBuilderCv,
  deleteBuilderCv,
  getBuilderCv,
  getBuilderCvByApplication,
  getLatestBuilderCv,
  linkBuilderCvIfFree,
  listBuilderCvs,
  saveBuilderCv,
} from "./cv-builder";
import { CV_BUILDER_MAX, cvDataToText, type CvData } from "./cv-builder-types";
import { PROFILE_SUMMARY_MAX, PROFILE_SUMMARY_MIN } from "./cv-types";
import { claimLetter, claimSummary, releaseLetter, releaseSummary, saveClaimedLetter, saveClaimedSummary } from "./lumeo-action-store";
import {
  LUMEO_ACTION_QUOTA,
  checkLumeoAction,
  claimAdaptationCopy,
  writeLetterIfEmpty,
  lumeoProposalCard,
  type LumeoActionDeps,
  type LumeoActionDone,
  type LumeoActionFacts,
  type LumeoActionRequest,
  type LumeoProposal,
  type LumeoRefusal,
} from "./lumeo-actions";
import { lumeoMockEnabled, mockLumeoRelance } from "./lumeo-mock";
import { checkRelanceOutput, prepareRelanceCall, unmaskRelance } from "./lumeo-relance";
import { relanceTicketKey, verifyRelanceTicket } from "./lumeo-relance-ticket";
import { LUMEO_ACTION_TEXTS as T } from "./lumeo-texts";
import { OFFER_DESCRIPTION_MAX_LENGTH } from "./offer-limits";
import { formatOfferSummary } from "./offer-summary";
import { fullName } from "./person-name";
import { getLatestProfileCvText } from "./profile";

const hasBullets = (data: CvData) => data.experiences.some((e) => e.bullets.some((b) => b.trim()));

/** Préconditions relues en base, avec les droits de l'utilisateur connecté. */
export async function loadLumeoActionFacts(request: LumeoActionRequest): Promise<LumeoActionFacts> {
  const empty: LumeoActionFacts = { app: null, linkedCv: false, sourceCv: null, cvLimitReached: false, letterCv: false, signer: false };
  // Filtre sur l'utilisateur connecté : la candidature d'un autre n'existe pas pour lui.
  const detail = await getApplicationDetail(request.applicationId);
  if (!detail) return empty;
  const [linked, latest, cvs, profileText, name] = await Promise.all([
    getBuilderCvByApplication(request.applicationId),
    getLatestBuilderCv(),
    request.type === "adaptation_cv" ? listBuilderCvs() : Promise.resolve([]),
    request.type === "lettre" ? getLatestProfileCvText() : Promise.resolve(null),
    getAccountName().catch(() => null),
  ]);
  return {
    app: detail.application,
    linkedCv: Boolean(linked),
    sourceCv: latest ? { title: latest.title, hasBullets: hasBullets(latest.data) } : null,
    cvLimitReached: cvs.length >= CV_BUILDER_MAX,
    letterCv: Boolean(linked || latest || profileText),
    signer: Boolean(name),
  };
}

/**
 * Proposition de Lumeo prête à afficher (carte construite depuis la base), ou la raison pour
 * laquelle l'action n'est pas possible. `usedToday` : actions IA du jour, question en cours comprise.
 */
export async function lumeoProposal(
  request: LumeoActionRequest,
  quota: { premium: boolean; counts: Record<string, { used: number; limit: number | null }>; usedToday: number; coachToday?: number },
): Promise<{ ok: true; proposal: LumeoProposal } | LumeoRefusal> {
  const facts = await loadLumeoActionFacts(request);
  const check = checkLumeoAction(request.type, facts);
  if (!check.ok) return check;
  const count = quota.counts[LUMEO_ACTION_QUOTA[request.type]] ?? { used: 0, limit: null };
  const proposal = lumeoProposalCard(request, facts.app!, facts.sourceCv?.title ?? null, {
    premium: quota.premium,
    count,
    usedToday: quota.usedToday,
    coachToday: quota.coachToday ?? 0,
    coachLimit: CVB_COACH_DAILY_LIMIT,
  });
  return { ok: true, proposal };
}

/** Texte du CV pour la lettre : CV lié, sinon dernier CV du CV Builder, sinon dernier CV du profil. */
async function letterProfileText(applicationId: string): Promise<string | null> {
  const linked = await getBuilderCvByApplication(applicationId);
  if (linked) return cvDataToText(linked.data);
  const latest = await getLatestBuilderCv();
  if (latest) return cvDataToText(latest.data);
  return getLatestProfileCvText();
}

/** Dépendances réelles de executeLumeoAction : fonctions existantes, quotas et contrôles inchangés. */
export function lumeoActionDeps(): LumeoActionDeps {
  return {
    loadFacts: loadLumeoActionFacts,
    gate: async (kind, { coachDaily }) => {
      const gate = await checkAiAccess(kind);
      if (!gate.ok) return { ok: false, message: gate.message, limitReached: gate.limitReached };
      // Relance depuis la boîte : limite du jour des questions à Lumeo (levée pour Premium et beta).
      if (coachDaily && !gate.usage.premium && (await countAiUsageToday("cvb_coach")) >= CVB_COACH_DAILY_LIMIT) {
        return { ok: false, message: T.coachReached(CVB_COACH_DAILY_LIMIT), limitReached: false, coachLimit: true };
      }
      return { ok: true };
    },
    verifyTicket: async (request) => {
      if (request.type !== "relance") return false;
      const user = await requireUser();
      return verifyRelanceTicket(relanceTicketKey(), request.ticket, user.id, request.applicationId);
    },
    claim: async (request) => {
      // Relance : rien n'est écrit en base, aucune réservation nécessaire.
      if (request.type === "relance") return { type: request.type, applicationId: request.applicationId };
      if (request.type === "lettre") return (await claimLetter(request.applicationId)) ? { ...request } : null;
      if (request.type === "resume_offre") return (await claimSummary(request.applicationId)) ? { ...request } : null;
      // Adaptation : la copie liée à la candidature est la réservation (index unique).
      const source = await getLatestBuilderCv();
      const detail = await getApplicationDetail(request.applicationId);
      if (!source || !detail) return null;
      const draft = applicationCvDraft({ ...source.data, coach: null }, detail.application, await getAccountName().catch(() => null));
      // Copie toujours supprimée si la liaison échoue (CV déjà lié ou erreur inattendue).
      const copyId = await claimAdaptationCopy({
        createCopy: () => createBuilderCv(draft.data, draft.title, source.templateId),
        link: (id) => linkBuilderCvIfFree(id, request.applicationId),
        deleteCopy: (id) => deleteBuilderCv(id),
      });
      return copyId ? { ...request, token: copyId } : null;
    },
    run: async (request, facts, claim) => {
      const app = facts.app!;
      if (request.type === "relance") return runLumeoRelance(request.applicationId, request.source);
      const fiche = `/candidatures/${app.id}`;
      if (request.type === "lettre") {
        const [text, name] = await Promise.all([letterProfileText(app.id), getAccountName().catch(() => null)]);
        const summary = (text ?? "").trim().slice(0, PROFILE_SUMMARY_MAX);
        if (summary.length < PROFILE_SUMMARY_MIN) return { ok: false, message: T.noCv, link: { href: "/cv-builder", label: T.cvBuilder } };
        if (!name) return { ok: false, message: T.noName, link: { href: "/profil", label: T.profile } };
        const detail = await getApplicationDetail(app.id);
        if (!detail) return { ok: false, message: T.notFound };
        // Enregistrée seulement si aucune lettre n'existe au moment de l'écriture : jamais d'écrasement.
        const result = await writeLetterIfEmpty(app.id, {
          generate: () => writeCoverLetterHtml({ kind: "resume", summary }, detail.application, fullName(name)),
          saveIfEmpty: (html) => saveClaimedLetter(app.id, html),
        });
        revalidatePath(fiche);
        return result;
      }
      if (request.type === "resume_offre") {
        const summary = await summarizeOffer((app.offer_description ?? "").trim().slice(0, OFFER_DESCRIPTION_MAX_LENGTH));
        if (!summary) return { ok: false, message: T.failed };
        if (!(await saveClaimedSummary(app.id, formatOfferSummary(summary)))) return { ok: false, message: T.failed };
        revalidatePath(fiche);
        return { ok: true, message: T.done, link: { href: fiche, label: T.openFiche } };
      }
      // Adaptation : la copie réservée (claim.token) reçoit les puces adaptées.
      return claim.token ? runLumeoAdaptation(claim.token, app.id) : { ok: false, message: T.failed };
    },
    record: (kind) => recordAiUsage(kind),
    release: async (claim) => {
      if (claim.type === "relance") return; // rien à libérer
      if (claim.type === "lettre") await releaseLetter(claim.applicationId);
      else if (claim.type === "resume_offre") await releaseSummary(claim.applicationId);
      else if (claim.token) await deleteBuilderCv(claim.token);
    },
    log: (message) => console.error("[lumeo action]", message),
  };
}

/** Adaptation : puces de la copie réécrites pour l'offre, puis enregistrées dans la copie. */
export async function runLumeoAdaptation(copyId: string, applicationId: string) {
  const [copy, detail] = await Promise.all([getBuilderCv(copyId), getApplicationDetail(applicationId)]);
  if (!copy || !detail) return { ok: false as const, message: T.failed };
  const app = detail.application;
  const experiences = copy.data.experiences
    .map((e) => ({ id: e.id, heading: `${e.position} — ${e.company}`, bullets: e.bullets.filter((b) => b.trim()) }))
    .filter((e) => e.bullets.length);
  const offerText = [`Poste : ${app.position}`, `Entreprise : ${app.company}`, app.offer_description || app.offer_summary || ""].join("\n").slice(0, 30_000);
  const result = await adaptCvToOffer(experiences, offerText);
  if (!result) return { ok: false as const, message: T.failed };
  // Seules les expériences du CV, avec le même nombre de points, sont reprises (comme dans l'éditeur).
  const known = new Map(experiences.map((e) => [e.id, e.bullets.length]));
  const adapted = new Map(result.experiences.filter((e) => known.get(e.id) === e.bullets.length).map((e) => [e.id, e.bullets]));
  if (!adapted.size) return { ok: false as const, message: T.failed };
  const data = { ...copy.data, experiences: copy.data.experiences.map((e) => (adapted.has(e.id) ? { ...e, bullets: adapted.get(e.id)! } : e)) };
  await saveBuilderCv(copy.id, { title: copy.title, templateId: copy.templateId, data });
  // Mots-clés de l'offre pour l'onglet « Mots-clés » et le coach (hors quota, sans échec), comme
  // pour une copie créée depuis la fiche.
  await ensureOfferKeywords(detail).catch(() => {});
  revalidatePath("/cv-builder");
  revalidatePath(`/candidatures/${applicationId}`);
  return { ok: true as const, message: T.done, link: { href: `/cv-builder/${copy.id}`, label: T.openCv } };
}

/**
 * Relance retravaillée (lot 3a) : part du texte de la boîte « Relancer », sinon du message
 * pré-écrit (buildFollowUpMessage, sans IA). Le nom du contact, la signature et les coordonnées
 * sont masqués avant l'appel et remis après contrôle. Rien n'est enregistré, rien n'est envoyé.
 */
export async function runLumeoRelance(applicationId: string, source: string | undefined): Promise<LumeoActionDone | LumeoRefusal> {
  const [detail, name] = await Promise.all([getApplicationDetail(applicationId), getAccountName().catch(() => null)]);
  if (!detail) return { ok: false, message: T.notFound };
  const app = detail.application;
  const signer = name ? fullName(name) : null;
  const start = source?.trim() || buildFollowUpMessage(app, signer);
  // Aucun nom en clair vers le modèle : contact et compte masqués dans le texte et dans le résumé.
  const { mask, content } = prepareRelanceCall({ facts: app, offerSummary: app.offer_summary, contactName: app.contact_name, signer, source: start });
  const output = lumeoMockEnabled() ? mockLumeoRelance(mask.text) : await improveLumeoRelance(content);
  const check = checkRelanceOutput(output, mask, content);
  if (!check.ok) {
    // Journalisation sans le texte (données de l'utilisateur).
    console.error("[lumeo relance] brouillon refusé :", check.reason);
    return { ok: false, message: T.failed };
  }
  return { ok: true, message: T.relanceDone, draft: unmaskRelance(check.text, mask.placeholders) };
}
