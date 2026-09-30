import "server-only";

import { requireUser } from "./auth";
import type { CvSuggestions } from "./cv-types";
import { demoStore } from "./demo-data";
import { createClient, isSupabaseConfigured } from "./supabase/server";
import {
  STATUS_LABELS,
  type Application,
  type ApplicationDetail,
  type ApplicationDocument,
  type ApplicationEvent,
  type ApplicationEventType,
  type ApplicationStatus,
} from "./types";

import { FOLLOW_UP_STATUSES } from "./follow-up";

// Règles de relance déplacées dans follow-up.ts (utilisables côté client).
export { FOLLOW_UP_AFTER_DAYS, daysSince, needsFollowUp } from "./follow-up";

const RESPONSE_STATUSES: ApplicationStatus[] = ["entretien", "offre", "refusee"];

const LIST_COLUMNS =
  "id, company, position, location, offer_url, contact_name, contact_email, status, applied_at, last_contact_at, created_at";

export type DataSource = "supabase" | "demo";

export type ApplicationsResult = {
  applications: Application[];
  source: DataSource;
};

export type ApplicationDetailResult = {
  application: ApplicationDetail;
  events: ApplicationEvent[];
  documents: ApplicationDocument[];
  source: DataSource;
};

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<ApplicationsResult> {
  if (!isSupabaseConfigured()) {
    const applications = [...demoStore.applications].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return { applications, source: "demo" };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(LIST_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Chargement des candidatures impossible : ${error.message}`);

  return { applications: data as Application[], source: "supabase" };
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetailResult | null> {
  if (!isSupabaseConfigured()) {
    const application = demoStore.applications.find((app) => app.id === id);
    if (!application) return null;
    return {
      application,
      events: demoStore.events
        .filter((e) => e.application_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      documents: demoStore.documents.filter((d) => d.application_id === id),
      source: "demo",
    };
  }

  const user = await requireUser();
  if (!isUuid(id)) return null;

  const supabase = await createClient();
  const [appRes, eventsRes, docsRes] = await Promise.all([
    supabase
      .from("applications")
      // "*" : reste compatible si la migration 0004 (offer_summary) n'est pas encore appliquée.
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("application_events")
      .select("id, application_id, type, content, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("application_documents")
      .select("id, application_id, kind, file_name, storage_path, content, created_at")
      .eq("application_id", id)
      .order("kind"),
  ]);

  const error = appRes.error ?? eventsRes.error ?? docsRes.error;
  if (error) throw new Error(`Chargement de la candidature impossible : ${error.message}`);
  if (!appRes.data) return null;

  return {
    application: appRes.data as ApplicationDetail,
    events: (eventsRes.data ?? []) as ApplicationEvent[],
    documents: (docsRes.data ?? []) as ApplicationDocument[],
    source: "supabase",
  };
}

export type DocumentDownload =
  | { kind: "content"; fileName: string; content: string }
  | { kind: "url"; url: string };

export async function getDocumentDownload(
  applicationId: string,
  documentId: string,
): Promise<DocumentDownload | null> {
  let doc: ApplicationDocument | undefined;

  if (!isSupabaseConfigured()) {
    doc = demoStore.documents.find(
      (d) => d.id === documentId && d.application_id === applicationId,
    );
  } else {
    await requireUser();
    if (!isUuid(applicationId) || !isUuid(documentId)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("application_documents")
      .select("id, application_id, kind, file_name, storage_path, content, created_at")
      .eq("id", documentId)
      .eq("application_id", applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    doc = data ?? undefined;

    if (doc?.storage_path) {
      const { data: signed, error: signError } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
      if (signError) throw new Error(signError.message);
      return { kind: "url", url: signed.signedUrl };
    }
  }

  if (!doc?.content) return null;
  return { kind: "content", fileName: doc.file_name, content: doc.content };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type ApplicationPatch = Partial<Pick<Application, "status" | "applied_at" | "last_contact_at">>;

export type NewApplicationInput = {
  company: string;
  position: string;
  location: string | null;
  offer_url: string | null;
  offer_description: string | null;
  offer_summary: string | null;
  status: ApplicationStatus;
  /** Date d'envoi (YYYY-MM-DD) ; null pour un brouillon. */
  applied_at: string | null;
};

/** Crée une candidature et ses premiers événements d'historique. Retourne son id. */
export async function createApplication(input: NewApplicationInput): Promise<string> {
  const { offer_summary, ...fields } = input;
  const row = {
    ...fields,
    // Colonne ajoutée par la migration 0004 : envoyée seulement si un résumé existe.
    ...(offer_summary ? { offer_summary } : {}),
    last_contact_at: input.applied_at,
  };

  const events: { type: ApplicationEventType; content: string | null; created_at: string }[] = [];
  if (input.applied_at) {
    // Daté du jour d'envoi déclaré, pour un historique chronologique fidèle.
    events.push({ type: "envoi", content: null, created_at: `${input.applied_at}T12:00:00.000Z` });
  }
  events.push({
    type: "creation",
    content: `Ajoutée dans Applyfy — statut initial : ${STATUS_LABELS[input.status]}`,
    created_at: new Date().toISOString(),
  });

  if (!isSupabaseConfigured()) {
    const id = crypto.randomUUID();
    demoStore.applications.push({
      id,
      ...row,
      contact_name: null,
      contact_email: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    demoStore.events.push(
      ...events.map((e) => ({ id: crypto.randomUUID(), application_id: id, ...e })),
    );
    return id;
  }

  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .insert({ ...row, user_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(`Création de la candidature impossible : ${error.message}`);

  const { error: eventsError } = await supabase
    .from("application_events")
    .insert(events.map((e) => ({ ...e, application_id: data.id, user_id: user.id })));
  if (eventsError) throw new Error(eventsError.message);

  return data.id as string;
}

/** Change le statut et consigne l'événement correspondant dans l'historique. */
export async function changeApplicationStatus(id: string, status: ApplicationStatus) {
  const current = await findForUpdate(id);
  if (!current) return { ok: false as const, error: "Candidature introuvable." };
  if (current.status === status) return { ok: true as const };

  const patch: ApplicationPatch = { status };
  let eventType: ApplicationEventType = "changement_statut";

  if (status === "envoyee" && !current.applied_at) {
    patch.applied_at = today();
    patch.last_contact_at = today();
    eventType = "envoi";
  } else if (RESPONSE_STATUSES.includes(status)) {
    patch.last_contact_at = today();
    eventType = "reponse";
  }

  const content = `${STATUS_LABELS[current.status]} → ${STATUS_LABELS[status]}`;
  await applyUpdate(id, patch, eventType, content);
  return { ok: true as const };
}

/** Enregistre une relance (le message envoyé est conservé dans l'historique). */
export async function recordFollowUp(id: string, message: string) {
  const current = await findForUpdate(id);
  if (!current) return { ok: false as const, error: "Candidature introuvable." };

  const patch: ApplicationPatch = { last_contact_at: today() };
  if (FOLLOW_UP_STATUSES.includes(current.status)) patch.status = "relancee";

  await applyUpdate(id, patch, "relance", message);
  return { ok: true as const };
}

/**
 * Supprime définitivement une candidature de l'utilisateur connecté.
 * L'historique et les documents sont supprimés en cascade (clés étrangères),
 * les fichiers éventuels du bucket Storage sont supprimés explicitement.
 */
export async function deleteApplication(id: string) {
  if (!isSupabaseConfigured()) {
    const index = demoStore.applications.findIndex((app) => app.id === id);
    if (index === -1) return { ok: false as const, error: "Candidature introuvable." };
    demoStore.applications.splice(index, 1);
    demoStore.events = demoStore.events.filter((e) => e.application_id !== id);
    demoStore.documents = demoStore.documents.filter((d) => d.application_id !== id);
    return { ok: true as const };
  }

  const user = await requireUser();
  if (!isUuid(id)) return { ok: false as const, error: "Candidature introuvable." };
  const supabase = await createClient();

  // Chemins des fichiers à retirer du Storage (lus avant la cascade).
  const { data: files } = await supabase
    .from("application_documents")
    .select("storage_path")
    .eq("application_id", id)
    .eq("user_id", user.id)
    .not("storage_path", "is", null);

  const { data: deleted, error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
  if (!deleted || deleted.length === 0) {
    return { ok: false as const, error: "Candidature introuvable." };
  }

  const paths = (files ?? []).map((f) => f.storage_path as string);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("documents").remove(paths);
    // La candidature est déjà supprimée : un fichier orphelin ne doit pas bloquer l'utilisateur.
    if (storageError) console.error("[deleteApplication] storage", storageError.message);
  }

  return { ok: true as const };
}

/** Enregistre les dernières suggestions d'adaptation du CV (le CV n'est pas stocké). */
export async function saveCvSuggestions(id: string, suggestions: CvSuggestions) {
  const cv_suggestions_at = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === id);
    if (app) Object.assign(app, { cv_suggestions: suggestions, cv_suggestions_at });
    return;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("applications")
    .update({ cv_suggestions: suggestions, cv_suggestions_at })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

/** Enregistre le CV amélioré (HTML déjà nettoyé par sanitizeCvHtml). */
export async function saveImprovedCv(id: string, html: string) {
  const cv_improved_at = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === id);
    if (!app) throw new Error("Candidature introuvable.");
    Object.assign(app, { cv_improved_html: html, cv_improved_at });
    return;
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ cv_improved_html: html, cv_improved_at })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Candidature introuvable.");
}

async function findForUpdate(id: string) {
  if (!isSupabaseConfigured()) {
    return demoStore.applications.find((app) => app.id === id) ?? null;
  }
  const user = await requireUser();
  if (!isUuid(id)) return null;

  // Filtre explicite + RLS : seule une candidature de l'utilisateur connecté est modifiable.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, applied_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Pick<Application, "id" | "status" | "applied_at"> | null;
}

async function applyUpdate(
  id: string,
  patch: ApplicationPatch,
  type: ApplicationEventType,
  content: string | null,
) {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === id);
    if (app) Object.assign(app, patch);
    demoStore.events.push({
      id: crypto.randomUUID(),
      application_id: id,
      type,
      content,
      created_at: new Date().toISOString(),
    });
    return;
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase.from("applications").update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabase
    .from("application_events")
    .insert({ application_id: id, type, content });
  if (eventError) throw new Error(eventError.message);
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC", // date sans heure, cf. applications-list.tsx
});

/** Message de relance pré-rempli, modifiable par l'utilisateur. */
export function buildFollowUpMessage(app: Application): string {
  const greeting = app.contact_name ? `Bonjour ${app.contact_name},` : "Bonjour,";
  const sentOn = app.applied_at ? `, envoyée le ${longDate.format(new Date(app.applied_at))}` : "";
  const again = app.status === "relancee" ? "de nouveau " : "";

  return [
    greeting,
    "",
    `Je me permets de revenir ${again}vers vous au sujet de ma candidature au poste de ${app.position} chez ${app.company}${sentOn}.`,
    "",
    `Ce poste m'intéresse toujours vivement et je serais ravi·e d'échanger avec vous pour vous présenter ma motivation et ce que je pourrais apporter à ${app.company}.`,
    "",
    "Je reste disponible pour un appel ou un entretien à votre convenance.",
    "",
    "Bien cordialement,",
    "[Prénom Nom]",
  ].join("\n");
}

const isoDateInParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Date du jour (YYYY-MM-DD) à l'heure de Paris, quel que soit le fuseau du serveur. */
export function today() {
  return isoDateInParis.format(new Date());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
