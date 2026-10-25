import "server-only";

import { requireUser } from "./auth";
import {
  CvDataSchema,
  isTemplateId,
  readCvData,
  type BuilderCv,
  type BuilderCvSummary,
  type CvData,
  type CvTemplateId,
} from "./cv-builder-types";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// CV du CV Builder (table cv_builder, migration 0025) de l'utilisateur connecté. Lecture et
// écriture avec la session de l'utilisateur (RLS). Mode démo : en mémoire.

/** Nombre maximum de CV par utilisateur. */
export const CV_BUILDER_MAX = 20;

export class CvBuilderError extends Error {}

type Row = {
  id: string;
  title: string;
  template_id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
};

const toCv = (row: Row): BuilderCv => ({
  id: row.id,
  title: row.title,
  templateId: isTemplateId(row.template_id) ? row.template_id : "minimaliste",
  data: readCvData(row.data),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSummary = ({ data, ...cv }: BuilderCv): BuilderCvSummary => ({ ...cv, jobTitle: data.personal.jobTitle });

const globalForDemo = globalThis as unknown as { applyfyDemoCvBuilder?: BuilderCv[] };
const demoCvs = (globalForDemo.applyfyDemoCvBuilder ??= []);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** CV de l'utilisateur, du plus récemment modifié au plus ancien. */
export async function listBuilderCvs(): Promise<BuilderCvSummary[]> {
  if (!isSupabaseConfigured()) {
    return [...demoCvs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toSummary);
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_builder")
    .select("id, title, template_id, data, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Chargement des CV impossible : ${error.message}`);
  return (data as Row[]).map(toCv).map(toSummary);
}

export async function getBuilderCv(id: string): Promise<BuilderCv | null> {
  if (!isSupabaseConfigured()) return demoCvs.find((cv) => cv.id === id) ?? null;

  const user = await requireUser();
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_builder")
    .select("id, title, template_id, data, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Chargement du CV impossible : ${error.message}`);
  return data ? toCv(data as Row) : null;
}

/** Nouveau CV pré-rempli (nom, email, ou CV importé) ; renvoie son identifiant. */
export async function createBuilderCv(initial: CvData, rawTitle = "Mon CV"): Promise<string> {
  const data = CvDataSchema.parse(initial);
  const title = rawTitle.trim().slice(0, 120) || "Mon CV";

  if (!isSupabaseConfigured()) {
    if (demoCvs.length >= CV_BUILDER_MAX) throw new CvBuilderError(`Tu as atteint la limite de ${CV_BUILDER_MAX} CV.`);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    demoCvs.push({ id, title, templateId: "minimaliste", data, createdAt: now, updatedAt: now });
    return id;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("cv_builder")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) throw new Error(`Création du CV impossible : ${countError.message}`);
  if ((count ?? 0) >= CV_BUILDER_MAX) throw new CvBuilderError(`Tu as atteint la limite de ${CV_BUILDER_MAX} CV.`);

  const { data: row, error } = await supabase
    .from("cv_builder")
    .insert({ user_id: user.id, title, template_id: "minimaliste", data })
    .select("id")
    .single();
  if (error) throw new Error(`Création du CV impossible : ${error.message}`);
  return row.id as string;
}

/** Enregistre le titre, le modèle et le contenu ; renvoie la date de modification. */
export async function saveBuilderCv(
  id: string,
  input: { title: string; templateId: CvTemplateId; data: CvData },
): Promise<string> {
  const title = input.title.trim().slice(0, 120) || "Mon CV";
  const data = CvDataSchema.parse(input.data);

  if (!isSupabaseConfigured()) {
    const cv = demoCvs.find((c) => c.id === id);
    if (!cv) throw new CvBuilderError("Ce CV n'existe plus.");
    Object.assign(cv, { title, templateId: input.templateId, data, updatedAt: new Date().toISOString() });
    return cv.updatedAt;
  }

  const user = await requireUser();
  if (!isUuid(id)) throw new CvBuilderError("Ce CV n'existe plus.");
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("cv_builder")
    .update({ title, template_id: input.templateId, data })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("updated_at")
    .maybeSingle();
  if (error) throw new Error(`Enregistrement du CV impossible : ${error.message}`);
  if (!row) throw new CvBuilderError("Ce CV n'existe plus.");
  return row.updated_at as string;
}

export async function deleteBuilderCv(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const index = demoCvs.findIndex((c) => c.id === id);
    if (index >= 0) demoCvs.splice(index, 1);
    return;
  }

  const user = await requireUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("cv_builder").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(`Suppression du CV impossible : ${error.message}`);
}
