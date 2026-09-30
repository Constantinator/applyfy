"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getApplicationDetail, MissingMigrationError, saveEditedDocument } from "@/lib/applications";
import {
  claudeErrorMessage,
  generateCoverLetter,
  isClaudeConfigured,
  type CandidateProfile,
} from "@/lib/claude";
import { coverLetterToHtml } from "@/lib/cover-letter";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, sanitizeCvHtml } from "@/lib/cv-html";
import { DEFAULT_LETTER_STYLE, readCvStyle } from "@/lib/cv-style";
import { PROFILE_SUMMARY_MAX, PROFILE_SUMMARY_MIN } from "@/lib/cv-types";
import { getProfileCvFile } from "@/lib/profile";

import type { SaveCvResult } from "./cv";

export type GenerateCoverLetterState = { status: "idle" } | { status: "error"; message: string };

const MIGRATION_MESSAGE =
  "La lettre ne peut pas être enregistrée : la migration 0010 n'est pas encore appliquée dans Supabase.";

/** Profil du candidat selon la source choisie : CV du profil, PDF importé ou résumé saisi. */
async function readCandidate(formData: FormData): Promise<CandidateProfile | { error: string }> {
  const source = formData.get("source");

  if (source === "resume") {
    const name = String(formData.get("name") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    if (name.length < 2 || name.length > 80) return { error: "Indique ton prénom et ton nom." };
    if (summary.length < PROFILE_SUMMARY_MIN) {
      return { error: "Décris ton profil en quelques phrases (formation, expériences, compétences)." };
    }
    if (summary.length > PROFILE_SUMMARY_MAX) return { error: "Ton résumé est trop long." };
    return { kind: "resume", name, summary };
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

  const candidate = await readCandidate(formData);
  if ("error" in candidate) return { status: "error", message: candidate.error };

  let html: string;
  try {
    const letter = await generateCoverLetter(candidate, {
      position: app.position,
      company: app.company,
      location: app.location,
      summary: app.offer_summary ?? null,
      description: app.offer_description,
    });
    if (!letter) return { status: "error", message: "La lettre n'a pas pu être rédigée. Réessaie." };
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
