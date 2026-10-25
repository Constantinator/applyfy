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
  type ImportStatus,
} from "./cv-builder-types";
import { readCvStyle } from "./cv-style";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// CV du CV Builder (table cv_builder, migrations 0025 et 0027) de l'utilisateur connecté.
// Lecture et écriture avec la session de l'utilisateur (RLS). Mode démo : en mémoire.
//
// Un CV créé à partir d'un CV existant reste d'abord sous sa forme importée (HTML de
// l'éditeur de CV, colonnes imported_*), pendant que l'IA extrait ses données en arrière-plan
// (data, import_status) ; « Convertir en template Applyfy » le fait passer aux modèles.

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
  imported_html?: string | null;
  imported_style?: unknown;
  import_status?: string | null;
  imported_edited?: boolean | null;
};

const BASE_COLUMNS = "id, title, template_id, data, created_at, updated_at";
const IMPORT_COLUMNS = `${BASE_COLUMNS}, imported_html, imported_style, import_status, imported_edited`;

const isImportStatus = (value: unknown): value is ImportStatus => value === "pending" || value === "ready" || value === "failed";

const toCv = (row: Row): BuilderCv => ({
  id: row.id,
  title: row.title,
  templateId: isTemplateId(row.template_id) ? row.template_id : "minimaliste",
  data: readCvData(row.data),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  imported:
    typeof row.imported_html === "string" && isImportStatus(row.import_status)
      ? { html: row.imported_html, style: readCvStyle(row.imported_style), status: row.import_status, edited: !!row.imported_edited }
      : null,
});

const toSummary = ({ data, imported, ...cv }: BuilderCv): BuilderCvSummary => ({
  ...cv,
  jobTitle: data.personal.jobTitle,
  isImported: imported !== null,
});

const globalForDemo = globalThis as unknown as { applyfyDemoCvBuilder?: BuilderCv[] };
const demoCvs = (globalForDemo.applyfyDemoCvBuilder ??= []);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Colonne absente (migration 0027 non appliquée) : la requête est rejouée sans les colonnes d'import. */
const missingColumn = (error: { code?: string; message: string } | null) =>
  !!error && (error.code === "42703" || /imported_|import_status/.test(error.message));

/** CV de l'utilisateur, du plus récemment modifié au plus ancien. */
export async function listBuilderCvs(): Promise<BuilderCvSummary[]> {
  if (!isSupabaseConfigured()) {
    return [...demoCvs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toSummary);
  }

  const user = await requireUser();
  const supabase = await createClient();
  // Sans le HTML importé (inutile pour la liste).
  const list = (columns: string) =>
    supabase.from("cv_builder").select(columns).eq("user_id", user.id).order("updated_at", { ascending: false });
  let { data, error } = await list(`${BASE_COLUMNS}, import_status`);
  if (missingColumn(error)) ({ data, error } = await list(BASE_COLUMNS));
  if (error) throw new Error(`Chargement des CV impossible : ${error.message}`);
  return (data as unknown as Row[]).map((row) =>
    toSummary({
      ...toCv(row),
      imported: isImportStatus(row.import_status)
        ? { html: "", style: readCvStyle(null), status: row.import_status, edited: false }
        : null,
    }),
  );
}

async function selectOne(id: string, userId: string) {
  const supabase = await createClient();
  const one = (columns: string) => supabase.from("cv_builder").select(columns).eq("id", id).eq("user_id", userId).maybeSingle();
  let { data, error } = await one(IMPORT_COLUMNS);
  if (missingColumn(error)) ({ data, error } = await one(BASE_COLUMNS));
  if (error) throw new Error(`Chargement du CV impossible : ${error.message}`);
  return data as unknown as Row | null;
}

export async function getBuilderCv(id: string): Promise<BuilderCv | null> {
  if (!isSupabaseConfigured()) return demoCvs.find((cv) => cv.id === id) ?? null;

  const user = await requireUser();
  if (!isUuid(id)) return null;
  const row = await selectOne(id, user.id);
  return row ? toCv(row) : null;
}

async function assertBelowLimit(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from("cv_builder").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`Création du CV impossible : ${error.message}`);
  if ((count ?? 0) >= CV_BUILDER_MAX) throw new CvBuilderError(`Tu as atteint la limite de ${CV_BUILDER_MAX} CV.`);
}

function demoInsert(cv: Omit<BuilderCv, "id" | "createdAt" | "updatedAt">) {
  if (demoCvs.length >= CV_BUILDER_MAX) throw new CvBuilderError(`Tu as atteint la limite de ${CV_BUILDER_MAX} CV.`);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  demoCvs.push({ ...cv, id, createdAt: now, updatedAt: now });
  return id;
}

/** Nouveau CV pré-rempli (nom, email) dans un modèle ; renvoie son identifiant. */
export async function createBuilderCv(
  initial: CvData,
  rawTitle = "Mon CV",
  templateId: CvTemplateId = "minimaliste",
): Promise<string> {
  const data = CvDataSchema.parse(initial);
  const title = rawTitle.trim().slice(0, 120) || "Mon CV";

  if (!isSupabaseConfigured()) return demoInsert({ title, templateId, data, imported: null });

  const user = await requireUser();
  await assertBelowLimit(user.id);
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("cv_builder")
    .insert({ user_id: user.id, title, template_id: templateId, data })
    .select("id")
    .single();
  if (error) throw new Error(`Création du CV impossible : ${error.message}`);
  return row.id as string;
}

/** CV créé à partir d'un CV existant : HTML retranscrit, données extraites ensuite. */
export async function createImportedCv(rawTitle: string, html: string): Promise<string> {
  const title = rawTitle.trim().slice(0, 120) || "CV importé";
  const data = CvDataSchema.parse({});

  if (!isSupabaseConfigured()) {
    return demoInsert({
      title,
      templateId: "minimaliste",
      data,
      imported: { html, style: readCvStyle(null), status: "pending", edited: false },
    });
  }

  const user = await requireUser();
  await assertBelowLimit(user.id);
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("cv_builder")
    .insert({ user_id: user.id, title, template_id: "minimaliste", data, imported_html: html, import_status: "pending" })
    .select("id")
    .single();
  if (error) {
    if (missingColumn(error)) throw new CvBuilderError("L'import n'est pas encore disponible (migration 0027 à appliquer).");
    throw new Error(`Création du CV impossible : ${error.message}`);
  }
  return row.id as string;
}

/** Données extraites en arrière-plan d'un CV importé (null : extraction échouée). */
export async function finishImportExtraction(id: string, extracted: CvData | null, userId: string | null) {
  if (!isSupabaseConfigured()) {
    const cv = demoCvs.find((c) => c.id === id);
    if (cv?.imported?.status === "pending") {
      cv.imported = { ...cv.imported, status: extracted ? "ready" : "failed" };
      if (extracted) cv.data = extracted;
    }
    return;
  }
  if (!userId) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("cv_builder")
    .update(extracted ? { data: CvDataSchema.parse(extracted), import_status: "ready" } : { import_status: "failed" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("import_status", "pending");
  if (error) console.error("[cv-builder] extraction en arrière-plan", error.message);
}

/** État de l'extraction d'un CV importé, ou null s'il n'est plus sous sa forme importée. */
export async function getImportState(id: string): Promise<{ status: ImportStatus; createdAt: string; html: string } | null> {
  const cv = await getBuilderCv(id);
  return cv?.imported ? { status: cv.imported.status, createdAt: cv.createdAt, html: cv.imported.html } : null;
}

/** Modifications du HTML d'un CV importé (éditeur de CV) ; renvoie la date de modification. */
export async function saveImportedCvHtml(id: string, html: string, style: unknown): Promise<string> {
  const importedStyle = readCvStyle(style);

  if (!isSupabaseConfigured()) {
    const cv = demoCvs.find((c) => c.id === id);
    if (!cv?.imported) throw new CvBuilderError("Ce CV n'existe plus sous sa forme importée.");
    cv.imported = { ...cv.imported, html, style: importedStyle, edited: true };
    cv.updatedAt = new Date().toISOString();
    return cv.updatedAt;
  }

  const user = await requireUser();
  if (!isUuid(id)) throw new CvBuilderError("Ce CV n'existe plus.");
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("cv_builder")
    .update({ imported_html: html, imported_style: importedStyle, imported_edited: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .not("import_status", "is", null)
    .select("updated_at")
    .maybeSingle();
  if (error) throw new Error(`Enregistrement du CV impossible : ${error.message}`);
  if (!row) throw new CvBuilderError("Ce CV a été converti en modèle Applyfy : recharge la page.");
  return row.updated_at as string;
}

/** « Convertir en template Applyfy » : le CV quitte sa forme importée. */
export async function convertImportedCv(id: string, templateId: CvTemplateId, data: CvData): Promise<void> {
  const parsed = CvDataSchema.parse(data);

  if (!isSupabaseConfigured()) {
    const cv = demoCvs.find((c) => c.id === id);
    if (!cv) throw new CvBuilderError("Ce CV n'existe plus.");
    Object.assign(cv, { templateId, data: parsed, imported: null, updatedAt: new Date().toISOString() });
    return;
  }

  const user = await requireUser();
  if (!isUuid(id)) throw new CvBuilderError("Ce CV n'existe plus.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("cv_builder")
    .update({
      template_id: templateId,
      data: parsed,
      imported_html: null,
      imported_style: null,
      import_status: null,
      imported_edited: false,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Conversion du CV impossible : ${error.message}`);
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

/** Nouveau titre d'un CV (CV importé, dont le reste est enregistré par l'éditeur de CV). */
export async function renameBuilderCv(id: string, rawTitle: string): Promise<void> {
  const title = rawTitle.trim().slice(0, 120) || "Mon CV";
  if (!isSupabaseConfigured()) {
    const cv = demoCvs.find((c) => c.id === id);
    if (cv) cv.title = title;
    return;
  }
  const user = await requireUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("cv_builder").update({ title }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(`Renommage du CV impossible : ${error.message}`);
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
