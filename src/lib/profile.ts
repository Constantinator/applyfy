import "server-only";

import { requireUser } from "./auth";
import { PROFILE_CV_LIMIT, type ProfileCv } from "./cv-types";
import { demoStore } from "./demo-data";
import { DEFAULT_REMINDER_SETTINGS, readReminderSettings, type ReminderSettings } from "./reminders";
import { createClient, isSupabaseConfigured } from "./supabase/server";

const BUCKET = "documents";
const COLUMNS = "id, name, file_name, created_at";

type Row = { id: string; name: string; file_name: string; created_at: string };
const toCv = (row: Row): ProfileCv => ({
  id: row.id,
  name: row.name,
  fileName: row.file_name,
  uploadedAt: row.created_at,
});

export class ProfileCvError extends Error {}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** CV enregistrés dans le profil de l'utilisateur connecté (du plus ancien au plus récent). */
export async function listProfileCvs(): Promise<ProfileCv[]> {
  if (!isSupabaseConfigured()) {
    return demoStore.profileCvs.map(({ id, name, fileName, uploadedAt }) => ({
      id,
      name,
      fileName,
      uploadedAt,
    }));
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_cvs")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error(`Chargement des CV impossible : ${error.message}`);
  return (data as Row[]).map(toCv);
}

/** Métadonnées + contenu d'un CV du profil (pour Claude ou le téléchargement). */
export async function getProfileCvFile(id: string): Promise<{ cv: ProfileCv; bytes: Buffer } | null> {
  if (!isSupabaseConfigured()) {
    const cv = demoStore.profileCvs.find((c) => c.id === id);
    return cv ? { cv: { id, name: cv.name, fileName: cv.fileName, uploadedAt: cv.uploadedAt }, bytes: cv.data } : null;
  }

  const user = await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("profile_cvs")
    .select(`${COLUMNS}, storage_path`)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (downloadError) throw new Error(`Lecture du CV impossible : ${downloadError.message}`);
  return { cv: toCv(row as Row), bytes: Buffer.from(await data.arrayBuffer()) };
}

// ---------------------------------------------------------------------------
// CV du profil au format de l'éditeur (colonne html, migration 0019) : retranscrit une
// seule fois par CV, puis réutilisé pour chaque candidature. Sans échec : null si la
// colonne n'existe pas encore.
// ---------------------------------------------------------------------------

/** Version éditable (HTML) d'un CV du profil, ou null si pas encore retranscrit. */
export async function getProfileCvHtml(id: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !isUuid(id)) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_cvs")
    .select("html")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[profile] lecture du CV éditable", error.message);
    return null;
  }
  return (data?.html as string | null) ?? null;
}

/** Mémorise la version éditable d'un CV du profil (non bloquant en cas d'échec). */
export async function saveProfileCvHtml(id: string, html: string) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_cvs")
    .update({ html, html_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) console.error("[profile] enregistrement du CV éditable", error.message);
}

/** Dernier CV du profil déjà retranscrit (contexte du chat de la lettre), ou null. */
export async function getLatestProfileCvHtml(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_cvs")
    .select("html")
    .eq("user_id", user.id)
    .not("html", "is", null)
    .order("html_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.html as string | null) ?? null;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function assertNameAvailable(name: string, exceptId?: string) {
  const existing = await listProfileCvs();
  const taken = existing.some(
    (cv) => cv.id !== exceptId && cv.name.localeCompare(name, "fr", { sensitivity: "base" }) === 0,
  );
  if (taken) throw new ProfileCvError(`Tu as déjà un CV nommé « ${name} ».`);
  return existing;
}

export async function addProfileCv(rawName: string, fileName: string, bytes: Buffer): Promise<ProfileCv> {
  const name = normalizeName(rawName);
  const existing = await assertNameAvailable(name);
  if (existing.length >= PROFILE_CV_LIMIT) {
    throw new ProfileCvError(`Tu as déjà ${PROFILE_CV_LIMIT} CV : supprimes-en un pour en ajouter un autre.`);
  }

  const id = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    demoStore.profileCvs.push({ id, name, fileName, uploadedAt, data: bytes });
    return { id, name, fileName, uploadedAt };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const path = `${user.id}/profil/${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(`Envoi du CV impossible : ${uploadError.message}`);

  const { error } = await supabase
    .from("profile_cvs")
    .insert({ id, user_id: user.id, name, file_name: fileName, storage_path: path, created_at: uploadedAt });
  if (error) {
    // Ne pas laisser de fichier orphelin si l'enregistrement échoue (ex. limite atteinte).
    await supabase.storage.from(BUCKET).remove([path]);
    if (error.code === "P0001") {
      throw new ProfileCvError(`Tu as déjà ${PROFILE_CV_LIMIT} CV : supprimes-en un pour en ajouter un autre.`);
    }
    throw new Error(`Enregistrement du CV impossible : ${error.message}`);
  }
  return { id, name, fileName, uploadedAt };
}

export async function renameProfileCv(id: string, rawName: string) {
  const name = normalizeName(rawName);
  await assertNameAvailable(name, id);

  if (!isSupabaseConfigured()) {
    const cv = demoStore.profileCvs.find((c) => c.id === id);
    if (!cv) throw new ProfileCvError("CV introuvable.");
    cv.name = name;
    return;
  }

  const user = await requireUser();
  if (!isUuid(id)) throw new ProfileCvError("CV introuvable.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_cvs")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new ProfileCvError("CV introuvable.");
}

export async function deleteProfileCv(id: string) {
  if (!isSupabaseConfigured()) {
    const index = demoStore.profileCvs.findIndex((c) => c.id === id);
    if (index === -1) throw new ProfileCvError("CV introuvable.");
    demoStore.profileCvs.splice(index, 1);
    return;
  }

  const user = await requireUser();
  if (!isUuid(id)) throw new ProfileCvError("CV introuvable.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_cvs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("storage_path");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new ProfileCvError("CV introuvable.");

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([data[0].storage_path]);
  // Déjà retiré de la liste : un fichier orphelin ne doit pas bloquer l'utilisateur.
  if (storageError) console.error("[deleteProfileCv] storage", storageError.message);
}

// ---------------------------------------------------------------------------
// Rappels de relance
// ---------------------------------------------------------------------------

export async function getReminderSettings(): Promise<ReminderSettings> {
  if (!isSupabaseConfigured()) return demoStore.reminderSettings ?? DEFAULT_REMINDER_SETTINGS;

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("reminders_enabled, first_reminder_days, second_reminder_days")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Chargement des préférences impossible : ${error.message}`);
  return readReminderSettings(data);
}

export async function saveReminderSettings(settings: ReminderSettings) {
  if (!isSupabaseConfigured()) {
    demoStore.reminderSettings = settings;
    return;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    reminders_enabled: settings.enabled,
    first_reminder_days: settings.firstDays,
    second_reminder_days: settings.secondDays,
  });
  if (error) throw new Error(`Enregistrement des préférences impossible : ${error.message}`);
}