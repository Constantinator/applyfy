import "server-only";

import { requireUser } from "./auth";
import { demoStore } from "./demo-data";
import { createClient, isSupabaseConfigured } from "./supabase/server";

export type ProfileCv = { fileName: string; uploadedAt: string };

const BUCKET = "documents";
const cvPath = (userId: string) => `${userId}/profil/cv.pdf`;

/** CV enregistré dans le profil de l'utilisateur connecté (métadonnées). */
export async function getProfileCv(): Promise<ProfileCv | null> {
  if (!isSupabaseConfigured()) {
    const cv = demoStore.profileCv;
    return cv ? { fileName: cv.fileName, uploadedAt: cv.uploadedAt } : null;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("cv_file_name, cv_path, cv_uploaded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Chargement du profil impossible : ${error.message}`);
  if (!data?.cv_path) return null;
  return { fileName: data.cv_file_name ?? "cv.pdf", uploadedAt: data.cv_uploaded_at };
}

/** Contenu du CV du profil (pour l'analyse par Claude ou le téléchargement). */
export async function getProfileCvBytes(): Promise<Buffer | null> {
  if (!isSupabaseConfigured()) return demoStore.profileCv?.data ?? null;

  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("cv_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.cv_path) return null;

  const { data, error } = await supabase.storage.from(BUCKET).download(profile.cv_path);
  if (error) throw new Error(`Lecture du CV impossible : ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function saveProfileCv(fileName: string, bytes: Buffer) {
  const uploadedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    demoStore.profileCv = { fileName, data: bytes, uploadedAt };
    return;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const path = cvPath(user.id);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`Envoi du CV impossible : ${uploadError.message}`);

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, cv_file_name: fileName, cv_path: path, cv_uploaded_at: uploadedAt });
  if (error) throw new Error(`Mise à jour du profil impossible : ${error.message}`);
}

export async function deleteProfileCv() {
  if (!isSupabaseConfigured()) {
    demoStore.profileCv = undefined;
    return;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([cvPath(user.id)]);
  if (storageError) throw new Error(`Suppression du fichier impossible : ${storageError.message}`);

  const { error } = await supabase
    .from("profiles")
    .update({ cv_file_name: null, cv_path: null, cv_uploaded_at: null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
