"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { getAiUsageFor, recordAiUsage } from "@/lib/ai-usage";
import { isLimitReached, LIMIT_REACHED_MESSAGE } from "@/lib/ai-usage-limits";
import { getApplicationDetail, MissingMigrationError, saveEditedDocument } from "@/lib/applications";
import {
  claudeErrorMessage,
  generateCoverLetter,
  isClaudeConfigured,
  transcribeLetter,
  type CandidateProfile,
} from "@/lib/claude";
import { coverLetterToHtml, transcribedLetterToHtml } from "@/lib/cover-letter";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, sanitizeCvHtml } from "@/lib/cv-html";
import { DEFAULT_LETTER_STYLE, readCvStyle } from "@/lib/cv-style";
import { CV_MAX_BYTES, CV_MAX_LABEL, PROFILE_SUMMARY_MAX, PROFILE_SUMMARY_MIN } from "@/lib/cv-types";
import { extractDocxText } from "@/lib/docx";
import { fullName } from "@/lib/person-name";
import { getProfileCvFile } from "@/lib/profile";
import { refineApplicationDocument, type RefineResult } from "@/lib/refine";

import type { SaveCvResult } from "./cv";

export type GenerateCoverLetterState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean };

const MIGRATION_MESSAGE =
  "La lettre ne peut pas être enregistrée : la migration 0010 n'est pas encore appliquée dans Supabase.";

/** Profil du candidat selon la source choisie : CV du profil, PDF importé ou résumé saisi. */
async function readCandidate(formData: FormData): Promise<CandidateProfile | { error: string }> {
  const source = formData.get("source");

  if (source === "resume") {
    const summary = String(formData.get("summary") ?? "").trim();
    if (summary.length < PROFILE_SUMMARY_MIN) {
      return { error: "Décris ton profil en quelques phrases (formation, expériences, compétences)." };
    }
    if (summary.length > PROFILE_SUMMARY_MAX) return { error: "Ton résumé est trop long." };
    return { kind: "resume", summary };
  }

  if (source === "profil") {
    // Propriété du CV vérifiée par getProfileCvFile.
    const profileCv = await getProfileCvFile(String(formData.get("cvId") ?? ""));
    if (!profileCv) return { error: "Ce CV n'existe plus dans ton profil. Choisis-en un autre." };
    return { kind: "cv", pdfBase64: profileCv.bytes.toString("base64") };
  }

  const upload = await readPdfUpload(formData.get("cv"));
  if (!upload.ok) return { error: upload.error };
  return { kind: "cv", pdfBase64: upload.bytes.toString("base64") };
}

export async function generateCoverLetterAction(
  _prev: GenerateCoverLetterState,
  formData: FormData,
): Promise<GenerateCoverLetterState> {
  if (!isClaudeConfigured()) {
    return { status: "error", message: "La génération n'est pas activée (clé API Claude manquante)." };
  }

  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const id = String(formData.get("id") ?? "");
  const detail = id ? await getApplicationDetail(id) : null;
  if (!detail) return { status: "error", message: "Candidature introuvable." };
  const app = detail.application;

  // Génération et regénération comptent toutes deux dans la limite mensuelle.
  if (isLimitReached(await getAiUsageFor("lettre"))) {
    return { status: "error", message: LIMIT_REACHED_MESSAGE, limitReached: true };
  }

  // Prénom et nom du compte : signature et objet de la lettre.
  const accountName = await getAccountName();
  const signer = accountName ? fullName(accountName) : null;

  const candidate = await readCandidate(formData);
  if ("error" in candidate) return { status: "error", message: candidate.error };
  if (candidate.kind === "resume" && !signer) {
    return { status: "error", message: "Renseigne d'abord ton prénom et ton nom dans « Mon profil »." };
  }

  let html: string;
  try {
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
    if (!letter) return { status: "error", message: "La lettre n'a pas pu être rédigée. Réessaie." };
    await recordAiUsage("lettre");
    // Le nom du compte fait foi (en-tête, objet et signature), même si le CV en indique un autre.
    if (signer) letter.nom = signer;
    html = sanitizeCvHtml(coverLetterToHtml(letter, app.position));
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "generateCoverLetter") };
  }

  try {
    // Le style déjà choisi (lettre précédente) est conservé.
    await saveEditedDocument("lettre", app.id, html);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof MissingMigrationError) return { status: "error", message: MIGRATION_MESSAGE };
    console.error("[generateCoverLetter] enregistrement", error);
    return { status: "error", message: "La lettre a été rédigée mais n'a pas pu être enregistrée." };
  }

  revalidatePath(`/candidatures/${app.id}`);
  redirect(`/candidatures/${app.id}/lettre`);
}

/**
 * « Importer une lettre existante » : un PDF ou un .docx (ancienne lettre) est retranscrit
 * tel quel dans l'éditeur. Compte dans la limite mensuelle des lettres.
 */
export async function importCoverLetterAction(
  _prev: GenerateCoverLetterState,
  formData: FormData,
): Promise<GenerateCoverLetterState> {
  if (!isClaudeConfigured()) {
    return { status: "error", message: "L'import d'une lettre n'est pas disponible sur ce site." };
  }
  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const id = String(formData.get("id") ?? "");
  const detail = id ? await getApplicationDetail(id) : null;
  if (!detail) return { status: "error", message: "Candidature introuvable." };
  const app = detail.application;

  const file = formData.get("lettre");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choisis ta lettre (PDF ou Word)." };
  if (file.size > CV_MAX_BYTES) return { status: "error", message: `Ce fichier dépasse ${CV_MAX_LABEL}.` };
  const bytes = Buffer.from(await file.arrayBuffer());

  // Format reconnu à la signature du fichier, pas seulement à son extension.
  let source: Parameters<typeof transcribeLetter>[0];
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    source = { kind: "pdf", base64: bytes.toString("base64") };
  } else if (bytes.subarray(0, 2).toString("latin1") === "PK") {
    const text = extractDocxText(bytes);
    if (!text || text.length < 50) {
      return { status: "error", message: "Ce document Word n'a pas pu être lu. Essaie de l'exporter en PDF." };
    }
    source = { kind: "text", text: text.slice(0, 20_000) };
  } else {
    return { status: "error", message: "Choisis un fichier PDF ou Word (.docx)." };
  }

  if (isLimitReached(await getAiUsageFor("lettre"))) {
    return { status: "error", message: LIMIT_REACHED_MESSAGE, limitReached: true };
  }

  let html: string;
  try {
    const letter = await transcribeLetter(source);
    if (!letter || letter.paragraphes.every((p) => !p.trim())) {
      return { status: "error", message: "Cette lettre n'a pas pu être lue. Vérifie le fichier." };
    }
    await recordAiUsage("lettre");
    const account = await getAccountName().catch(() => null);
    html = sanitizeCvHtml(transcribedLetterToHtml(letter, app.position, account ? fullName(account) : null));
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "transcribeLetter") };
  }

  try {
    await saveEditedDocument("lettre", app.id, html);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof MissingMigrationError) return { status: "error", message: MIGRATION_MESSAGE };
    console.error("[importCoverLetter] enregistrement", error);
    return { status: "error", message: "La lettre n'a pas pu être enregistrée. Réessaie dans un instant." };
  }

  revalidatePath(`/candidatures/${app.id}`);
  redirect(`/candidatures/${app.id}/lettre`);
}

export async function saveCoverLetterAction(
  id: string,
  html: string,
  style?: unknown,
): Promise<SaveCvResult> {
  if (typeof id !== "string" || typeof html !== "string") return { ok: false, error: "Requête invalide." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: "La lettre est trop longue." };

  // getApplicationDetail vérifie la connexion et la propriété de la candidature.
  const detail = await getApplicationDetail(id);
  if (!detail) return { ok: false, error: "Candidature introuvable." };

  try {
    await saveEditedDocument(
      "lettre",
      id,
      sanitizeCvHtml(html),
      style === undefined ? undefined : readCvStyle(style, DEFAULT_LETTER_STYLE),
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof MissingMigrationError) return { ok: false, error: MIGRATION_MESSAGE };
    console.error("[saveCoverLetter]", error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Chat « Affiner avec l'IA » de la lettre (cf. lib/refine). */
export async function refineCoverLetterAction(
  id: string,
  html: string,
  message: string,
  history: unknown,
): Promise<RefineResult> {
  return refineApplicationDocument("lettre", id, html, message, history);
}
