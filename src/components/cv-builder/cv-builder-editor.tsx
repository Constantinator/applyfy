"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  adaptToOfferAction,
  generateSummaryAction,
  improveBulletAction,
  refineBuilderCvAction,
  saveBuilderCvAction,
  type AdaptedExperiences,
} from "@/app/actions/cv-builder";
import { RefineChat } from "@/components/application/refine-chat";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import {
  CVB_CHAT_LIMIT_MESSAGE,
  isLimitReached,
  LIMIT_REACHED_LABEL,
  type AiUsageCount,
} from "@/lib/ai-usage-limits";
import {
  applyEdit,
  chatContent,
  CV_LIMITS,
  CvDataSchema,
  CV_TEMPLATES,
  fullName,
  newItemId,
  SKILL_LEVELS,
  type BuilderCv,
  type CvAnalysis,
  type CvData,
  type CvExperience,
  type CvTemplateId,
  type SkillLevel,
} from "@/lib/cv-builder-types";

import { CvHtmlPreview } from "./cv-html-preview";
import { FormatToolbar } from "./format-toolbar";
import { AddButton, Field, ItemCard, move, TextArea } from "./form-controls";

type AiKind = "cvb_puce" | "cvb_resume" | "cvb_adaptation";
export type CvBuilderUsage = {
  counts: Record<AiKind | "cvb_chat", AiUsageCount>;
  resetLabel: string;
  /** Clé API Claude configurée (chat « Affiner avec l'IA »). */
  aiEnabled: boolean;
};

const TABS = [
  { id: "infos", label: "Infos" },
  { id: "profil", label: "Profil" },
  { id: "experiences", label: "Expériences" },
  { id: "formation", label: "Formation" },
  { id: "competences", label: "Compétences" },
  { id: "langues", label: "Langues" },
  { id: "plus", label: "Plus" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Couleur de la pastille de chaque modèle dans le sélecteur. */
const TEMPLATE_SWATCH: Record<CvTemplateId, string> = {
  minimaliste: "bg-white ring-1 ring-slate-400",
  classique: "bg-slate-700",
  moderne: "bg-[#1E40AF]",
  sidebar: "bg-[#1E293B]",
  tech: "bg-[#059669]",
};

type SaveStatus = "saved" | "pending" | "saving" | "error";

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: "Enregistré",
  pending: "Modifications en cours…",
  saving: "Enregistrement…",
  error: "Échec de l'enregistrement",
};

/** Photo carrée (recadrée au centre), 320 px, JPEG : ~30 à 60 Ko dans le CV. */
async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  canvas.getContext("2d")!.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    320,
    320,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function fileName(title: string, data: CvData) {
  const base = `CV ${fullName(data) || title}`.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${base.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-") || "CV"}.pdf`;
}

/** Premier message du chat d'un CV importé : les optimisations prioritaires de l'analyse. */
function welcomeMessage(analysis: CvAnalysis) {
  const points = analysis.optimizations.map((o) => `• ${o.title}`);
  return [
    points.length ? `Voici ce que j'ai identifié à améliorer dans ton CV :\n${points.join("\n")}` : null,
    analysis.targetJob ? `Je tiens compte du poste que tu vises : ${analysis.targetJob}.` : null,
    "Tu peux me demander de corriger l'un de ces points, ou me poser n'importe quelle question sur ton CV.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Éditeur du CV Builder : formulaire à onglets (40 %) et aperçu en temps réel (60 %). CV
 * importé (avec analyse) : aperçu à gauche (60 %) et, à droite (40 %), le chat initialisé
 * avec les points à améliorer, ou le formulaire.
 */
export function CvBuilderEditor({ cv, usage }: { cv: BuilderCv; usage: CvBuilderUsage }) {
  const [title, setTitle] = useState(cv.title);
  const [templateId, setTemplateId] = useState<CvTemplateId>(cv.templateId);
  const [data, setData] = useState<CvData>(cv.data);
  const [tab, setTab] = useState<TabId>("infos");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [counts, setCounts] = useState(usage.counts);
  const [limitHit, setLimitHit] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pages, setPages] = useState(1);
  const analysis = cv.data.analysis;
  const [panel, setPanel] = useState<"assistant" | "formulaire">("assistant");
  const version = useRef(0);
  const touched = useRef(false);
  // Dernières données, lues par le chat au moment d'un envoi ou d'une annulation.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const edit = (fn: (d: CvData) => CvData) => {
    touched.current = true;
    setStatus("pending");
    setData(fn);
  };
  const setPersonal = (field: keyof CvData["personal"], value: string | null) =>
    edit((d) => ({ ...d, personal: { ...d.personal, [field]: value } }));

  // Sauvegarde automatique, une seconde après la dernière modification.
  useEffect(() => {
    if (!touched.current) return;
    const current = ++version.current;
    const timer = setTimeout(async () => {
      setStatus("saving");
      const result = await saveBuilderCvAction(cv.id, { title, templateId, data });
      if (current !== version.current) return; // une modification plus récente suivra
      setStatus(result.ok ? "saved" : "error");
      setSaveError(result.ok ? null : result.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cv.id, title, templateId, data]);

  // Quitter la page avec des modifications non enregistrées : confirmation du navigateur.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  /** Après une action IA : compteur local, ou bandeau si l'essai gratuit est utilisé. */
  function afterAi(kind: AiKind, result: { ok: boolean; limitReached?: boolean }) {
    if (result.ok) setCounts((c) => ({ ...c, [kind]: { ...c[kind], used: c[kind].used + 1 } }));
    else if (result.limitReached) setLimitHit(true);
  }
  const exhausted = (kind: AiKind) => isLimitReached(counts[kind]);

  async function download() {
    setDownloading(true);
    try {
      const [{ pdf }, { CvDocument, registerCvFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./cv-document"),
      ]);
      registerCvFonts(window.location.origin);
      const blob = await pdf(<CvDocument data={data} templateId={templateId} title={title} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(title, data);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("[cv-builder] PDF", error);
      setSaveError("Le PDF n'a pas pu être généré. Réessaie dans un instant.");
    } finally {
      setDownloading(false);
    }
  }

  // Formulaire
  const form = (
    <section aria-label="Contenu du CV" data-cv-form className="card min-w-0 p-4 sm:p-5">
      <div role="tablist" aria-label="Sections du CV" className="mb-5 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`onglet-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="cv-panneau"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {limitHit && (
        <div className="mb-5">
          <UsageLimitBanner resetLabel={usage.resetLabel} />
        </div>
      )}

      <div id="cv-panneau" role="tabpanel" aria-labelledby={`onglet-${tab}`} className="space-y-5">
        {tab === "infos" && <PersonalTab data={data} setPersonal={setPersonal} />}
        {tab === "profil" && (
          <SummaryTab
            data={data}
            exhausted={exhausted("cvb_resume")}
            onChange={(summary) => edit((d) => ({ ...d, summary }))}
            afterAi={(r) => afterAi("cvb_resume", r)}
          />
        )}
        {tab === "experiences" && (
          <ExperiencesTab
            data={data}
            edit={edit}
            bulletExhausted={exhausted("cvb_puce")}
            adaptExhausted={exhausted("cvb_adaptation")}
            afterAi={afterAi}
          />
        )}
        {tab === "formation" && <EducationTab data={data} edit={edit} />}
        {tab === "competences" && <SkillsTab data={data} edit={edit} />}
        {tab === "langues" && <LanguagesTab data={data} edit={edit} />}
        {tab === "plus" && <MoreTab data={data} edit={edit} />}
      </div>
    </section>
  );

  // Chat « Affiner avec l'IA » : même composant que l'éditeur du CV d'une candidature.
  const chat = (
    <RefineChat
      document="cvBuilder"
      applicationId={cv.id}
      aiEnabled={usage.aiEnabled}
      usage={usage.counts.cvb_chat}
      resetLabel={usage.resetLabel}
      refine={refineBuilderCvAction}
      readDocument={() => JSON.stringify(chatContent(dataRef.current))}
      replaceDocument={(json) => {
        const current = dataRef.current;
        const previous = JSON.stringify(chatContent(current));
        try {
          const parsed = JSON.parse(json);
          const next = CvDataSchema.safeParse({
            ...parsed,
            personal: { ...parsed.personal, photo: current.personal.photo },
            style: current.style,
            analysis: current.analysis,
          });
          if (next.success) edit(() => next.data);
        } catch {
          // Contenu illisible : le CV reste tel quel.
        }
        return previous;
      }}
      onPendingChange={() => {}}
      welcome={analysis ? welcomeMessage(analysis) : undefined}
      suggestions={analysis?.optimizations.map((o) => o.request).filter(Boolean)}
      limitMessage={CVB_CHAT_LIMIT_MESSAGE}
      tall={analysis !== null}
    />
  );

  // Aperçu : reste visible pendant la saisie (grand écran).
  const preview = (
    <section
      aria-label="Aperçu du CV"
      className="card flex h-[80vh] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 text-xs dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">Clique sur un texte de l&apos;aperçu pour le modifier.</p>
        <p className={pages > 1 ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>
          {pages > 1
            ? `Environ ${pages} pages${data.style.density !== "compact" ? " : essaie la taille de texte « Petite »" : ""}`
            : "1 page"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4 dark:bg-slate-800/60">
        <CvHtmlPreview
          data={data}
          templateId={templateId}
          onEdit={(path, value) => edit((d) => applyEdit(d, path, value))}
          onPagesChange={setPages}
        />
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      {/* Barre du haut : titre, état de l'enregistrement, téléchargement. */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/cv-builder" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Mes CV
        </Link>
        <input
          aria-label="Nom du CV"
          value={title}
          maxLength={CV_LIMITS.title}
          onChange={(e) => {
            touched.current = true;
            setStatus("pending");
            setTitle(e.target.value);
          }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none dark:text-white dark:hover:border-slate-700 sm:text-2xl"
        />
        <p
          role="status"
          className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
        >
          {SAVE_LABELS[status]}
        </p>
        <button type="button" onClick={download} disabled={downloading} className="btn-primary px-4 py-2.5 text-sm">
          {downloading ? "Génération du PDF…" : "Télécharger en PDF"}
        </button>
      </div>
      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30">
          {saveError}
        </p>
      )}

      {/* Choix du modèle : les données sont communes aux 5 modèles. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Modèle</legend>
        <div className="flex flex-wrap gap-2">
          {CV_TEMPLATES.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                title={t.description}
                onClick={() => {
                  touched.current = true;
                  setStatus("pending");
                  setTemplateId(t.id);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${TEMPLATE_SWATCH[t.id]}`} />
                {t.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Mise en forme : gras / italique / souligné sur le champ actif, réglages du CV entier. */}
      <div className="space-y-1.5">
        <FormatToolbar
          style={data.style}
          onStyle={(patch) => edit((d) => ({ ...d, style: { ...d.style, ...patch } }))}
          onPreviewEdit={(path, value) => edit((d) => applyEdit(d, path, value))}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gras, italique, souligné : sélectionne du texte dans le formulaire ou dans l&apos;aperçu. Dans le formulaire, la
          mise en forme s&apos;écrit **gras**, *italique* et __souligné__.
        </p>
      </div>

      {analysis ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          {preview}
          <div className="min-w-0 space-y-4">
            <div role="tablist" aria-label="Panneau de droite" className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  ["assistant", "Assistant IA"],
                  ["formulaire", "Formulaire"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={panel === id}
                  onClick={() => setPanel(id)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    panel === id
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Les deux panneaux restent montés : la conversation survit au changement d'onglet. */}
            <div hidden={panel !== "assistant"}>{chat}</div>
            <div hidden={panel !== "formulaire"}>{form}</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <div className="min-w-0 space-y-6">
            {form}
            {chat}
          </div>
          {preview}
        </div>
      )}
    </div>
  );
}

type Edit = (fn: (d: CvData) => CvData) => void;
type AiResultLike = { ok: boolean; limitReached?: boolean };

/** Bouton IA : libellé « Essai gratuit utilisé » une fois l'essai du mois consommé. */
function AiButton({
  onClick,
  pending,
  exhausted,
  children,
  pendingLabel,
}: {
  onClick: () => void;
  pending: boolean;
  exhausted: boolean;
  children: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || exhausted}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300 dark:ring-blue-400/30 dark:hover:bg-blue-500/15"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      </svg>
      {exhausted ? LIMIT_REACHED_LABEL : pending ? pendingLabel : children}
    </button>
  );
}

function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

function PersonalTab({
  data,
  setPersonal,
}: {
  data: CvData;
  setPersonal: (field: keyof CvData["personal"], value: string | null) => void;
}) {
  const p = data.personal;
  const [photoError, setPhotoError] = useState<string | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" value={p.firstName} maxLength={60} onChange={(v) => setPersonal("firstName", v)} />
        <Field label="Nom" value={p.lastName} maxLength={60} onChange={(v) => setPersonal("lastName", v)} />
        <Field
          label="Titre du poste"
          value={p.jobTitle}
          onChange={(v) => setPersonal("jobTitle", v)}
          placeholder="Ex. Data Analyst"
          className="sm:col-span-2"
        />
        <Field label="Email" type="email" value={p.email} onChange={(v) => setPersonal("email", v)} />
        <Field label="Téléphone" type="tel" value={p.phone} maxLength={40} onChange={(v) => setPersonal("phone", v)} />
        <Field label="Ville" value={p.city} onChange={(v) => setPersonal("city", v)} placeholder="Ex. Lyon" />
        <Field
          label="LinkedIn"
          type="url"
          value={p.linkedin}
          maxLength={CV_LIMITS.url}
          onChange={(v) => setPersonal("linkedin", v)}
          placeholder="linkedin.com/in/…"
        />
        <Field
          label="Site web / portfolio"
          type="url"
          value={p.website}
          maxLength={CV_LIMITS.url}
          onChange={(v) => setPersonal("website", v)}
        />
        <Field
          label="GitHub"
          type="url"
          value={p.github}
          maxLength={CV_LIMITS.url}
          onChange={(v) => setPersonal("github", v)}
          placeholder="github.com/…"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Photo (optionnelle)</p>
        <div className="flex flex-wrap items-center gap-3">
          {p.photo && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL locale
            <img src={p.photo} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200" />
          )}
          <label className="btn-secondary cursor-pointer px-3 py-2 text-sm">
            {p.photo ? "Changer la photo" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPersonal("photo", await resizePhoto(file));
                  setPhotoError(null);
                } catch {
                  setPhotoError("Cette image n'a pas pu être lue. Choisis un fichier JPEG ou PNG.");
                }
              }}
            />
          </label>
          {p.photo && (
            <button
              type="button"
              onClick={() => setPersonal("photo", null)}
              className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Retirer
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Affichée dans les modèles Moderne bleu, Sidebar sombre et Tech moderne.
        </p>
        <ErrorText>{photoError}</ErrorText>
      </div>
    </>
  );
}

function SummaryTab({
  data,
  exhausted,
  onChange,
  afterAi,
}: {
  data: CvData;
  exhausted: boolean;
  onChange: (summary: string) => void;
  afterAi: (r: AiResultLike) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <TextArea
        label="Profil / résumé"
        value={data.summary}
        rows={7}
        onChange={onChange}
        placeholder="En 2 à 4 phrases : ton métier, ton expérience, tes points forts et ce que tu recherches."
        action={
          <AiButton
            pending={pending}
            exhausted={exhausted}
            pendingLabel="Rédaction…"
            onClick={() =>
              startTransition(async () => {
                const result = await generateSummaryAction(data);
                afterAi(result);
                setError(result.ok ? null : result.limitReached ? null : result.error);
                if (result.ok) onChange(result.value);
              })
            }
          >
            Générer un résumé
          </AiButton>
        }
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        « Générer un résumé » rédige ce texte à partir de tes expériences, formations et compétences. Il remplace le
        texte actuel.
      </p>
      <ErrorText>{error}</ErrorText>
    </>
  );
}

function newExperience(): CvExperience {
  return { id: newItemId(), company: "", position: "", startDate: "", endDate: "", current: false, location: "", bullets: [""] };
}

function ExperiencesTab({
  data,
  edit,
  bulletExhausted,
  adaptExhausted,
  afterAi,
}: {
  data: CvData;
  edit: Edit;
  bulletExhausted: boolean;
  adaptExhausted: boolean;
  afterAi: (kind: AiKind, r: AiResultLike) => void;
}) {
  const items = data.experiences;
  const update = (id: string, patch: Partial<CvExperience>) =>
    edit((d) => ({ ...d, experiences: d.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  return (
    <>
      <AdaptToOffer data={data} edit={edit} exhausted={adaptExhausted} afterAi={(r) => afterAi("cvb_adaptation", r)} />
      {items.map((exp, index) => (
        <ItemCard
          key={exp.id}
          title={[exp.position, exp.company].filter(Boolean).join(" — ") || "Nouvelle expérience"}
          index={index}
          count={items.length}
          onMove={(delta) => edit((d) => ({ ...d, experiences: move(d.experiences, index, delta) }))}
          onRemove={() => edit((d) => ({ ...d, experiences: d.experiences.filter((e) => e.id !== exp.id) }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Poste" value={exp.position} onChange={(v) => update(exp.id, { position: v })} />
            <Field label="Entreprise" value={exp.company} onChange={(v) => update(exp.id, { company: v })} />
            <Field label="Début" value={exp.startDate} maxLength={40} placeholder="Ex. 09/2022" onChange={(v) => update(exp.id, { startDate: v })} />
            <div className="space-y-1.5">
              <Field
                label="Fin"
                value={exp.current ? "" : exp.endDate}
                maxLength={40}
                placeholder={exp.current ? "Aujourd'hui" : "Ex. 06/2024"}
                onChange={(v) => update(exp.id, { endDate: v, current: false })}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={exp.current}
                  onChange={(e) => update(exp.id, { current: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Poste actuel
              </label>
            </div>
            <Field label="Lieu" value={exp.location} onChange={(v) => update(exp.id, { location: v })} className="sm:col-span-2" />
          </div>
          <Bullets exp={exp} update={update} exhausted={bulletExhausted} afterAi={(r) => afterAi("cvb_puce", r)} />
        </ItemCard>
      ))}
      <AddButton
        disabled={items.length >= CV_LIMITS.items}
        onClick={() => edit((d) => ({ ...d, experiences: [...d.experiences, newExperience()] }))}
      >
        Ajouter une expérience
      </AddButton>
    </>
  );
}

function Bullets({
  exp,
  update,
  exhausted,
  afterAi,
}: {
  exp: CvExperience;
  update: (id: string, patch: Partial<CvExperience>) => void;
  exhausted: boolean;
  afterAi: (r: AiResultLike) => void;
}) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setBullet = (i: number, value: string) => update(exp.id, { bullets: exp.bullets.map((b, j) => (j === i ? value : b)) });

  async function improve(i: number) {
    setPendingIndex(i);
    const result = await improveBulletAction({ bullet: exp.bullets[i], position: exp.position, company: exp.company });
    setPendingIndex(null);
    afterAi(result);
    setError(result.ok || result.limitReached ? null : result.error);
    if (result.ok) setBullet(i, result.value);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Missions et réalisations</p>
      {exp.bullets.map((bullet, i) => (
        <div key={i} className="space-y-1.5">
          <textarea
            aria-label={`Point ${i + 1}`}
            value={bullet}
            rows={2}
            maxLength={CV_LIMITS.bullet}
            placeholder="Ex. Réduit de 30 % le temps de préparation des reportings"
            onChange={(e) => setBullet(i, e.target.value)}
            className="input resize-y"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AiButton
              pending={pendingIndex === i}
              exhausted={exhausted}
              pendingLabel="Amélioration…"
              onClick={() => improve(i)}
            >
              Améliorer avec l&apos;IA
            </AiButton>
            <button
              type="button"
              onClick={() => update(exp.id, { bullets: exp.bullets.filter((_, j) => j !== i) })}
              className="text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              Retirer ce point
            </button>
          </div>
        </div>
      ))}
      <ErrorText>{error}</ErrorText>
      {exp.bullets.length < CV_LIMITS.bullets && (
        <button
          type="button"
          onClick={() => update(exp.id, { bullets: [...exp.bullets, ""] })}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Ajouter un point
        </button>
      )}
    </div>
  );
}

/** « Adapter à une offre » : points d'expérience reformulés, annulable. */
function AdaptToOffer({
  data,
  edit,
  exhausted,
  afterAi,
}: {
  data: CvData;
  edit: Edit;
  exhausted: boolean;
  afterAi: (r: AiResultLike) => void;
}) {
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ previous: CvData["experiences"]; keywords: string[] } | null>(null);

  function apply(result: AdaptedExperiences) {
    const byId = new Map(result.experiences.map((e) => [e.id, e.bullets]));
    setDone({ previous: data.experiences, keywords: result.keywords });
    edit((d) => ({
      ...d,
      experiences: d.experiences.map((e) => {
        const bullets = byId.get(e.id);
        if (!bullets) return e;
        // Les points vides restent à leur place ; les autres sont remplacés dans l'ordre.
        let k = 0;
        return { ...e, bullets: e.bullets.map((b) => (b.trim() ? (bullets[k++] ?? b) : b)) };
      }),
    }));
  }

  return (
    <div className="rounded-xl bg-blue-50/60 p-4 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Adapter à une offre</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            L&apos;IA reformule tes points d&apos;expérience avec les mots-clés de l&apos;offre, sans rien inventer.
          </p>
        </div>
        {!open && (
          <AiButton pending={false} exhausted={exhausted} pendingLabel="" onClick={() => setOpen(true)}>
            Adapter à une offre
          </AiButton>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <TextArea
            label="Adresse ou texte de l'offre"
            value={offer}
            rows={4}
            maxLength={30_000}
            onChange={setOffer}
            placeholder="Colle le lien de l'offre (LinkedIn, Welcome to the Jungle, Indeed…) ou son texte."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || exhausted}
              onClick={() =>
                startTransition(async () => {
                  const result = await adaptToOfferAction(data, offer);
                  afterAi(result);
                  setError(result.ok || result.limitReached ? null : result.error);
                  if (result.ok) {
                    apply(result.value);
                    setOpen(false);
                    setOffer("");
                  }
                })
              }
              className="btn-primary px-4 py-2 text-sm"
            >
              {exhausted ? LIMIT_REACHED_LABEL : pending ? "Adaptation en cours…" : "Adapter mes expériences"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-4 py-2 text-sm">
              Fermer
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {done && (
        <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <p>
            Expériences adaptées
            {done.keywords.length ? ` (mots-clés : ${done.keywords.join(", ")})` : ""}. Relis chaque point avant
            d&apos;envoyer ton CV.
          </p>
          <button
            type="button"
            onClick={() => {
              const previous = done.previous;
              edit((d) => ({ ...d, experiences: previous }));
              setDone(null);
            }}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Annuler l&apos;adaptation
          </button>
        </div>
      )}
    </div>
  );
}

function EducationTab({ data, edit }: { data: CvData; edit: Edit }) {
  const items = data.education;
  const update = (id: string, patch: Partial<CvData["education"][number]>) =>
    edit((d) => ({ ...d, education: d.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <>
      {items.map((edu, index) => (
        <ItemCard
          key={edu.id}
          title={edu.degree || edu.school || "Nouvelle formation"}
          index={index}
          count={items.length}
          onMove={(delta) => edit((d) => ({ ...d, education: move(d.education, index, delta) }))}
          onRemove={() => edit((d) => ({ ...d, education: d.education.filter((e) => e.id !== edu.id) }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Diplôme" value={edu.degree} onChange={(v) => update(edu.id, { degree: v })} className="sm:col-span-2" />
            <Field label="École" value={edu.school} onChange={(v) => update(edu.id, { school: v })} className="sm:col-span-2" />
            <Field label="Début" value={edu.startDate} maxLength={40} placeholder="Ex. 2020" onChange={(v) => update(edu.id, { startDate: v })} />
            <Field label="Fin" value={edu.endDate} maxLength={40} placeholder="Ex. 2022" onChange={(v) => update(edu.id, { endDate: v })} />
            <Field
              label="Mention (optionnelle)"
              value={edu.honors}
              onChange={(v) => update(edu.id, { honors: v })}
              className="sm:col-span-2"
            />
          </div>
        </ItemCard>
      ))}
      <AddButton
        disabled={items.length >= CV_LIMITS.items}
        onClick={() =>
          edit((d) => ({
            ...d,
            education: [...d.education, { id: newItemId(), school: "", degree: "", startDate: "", endDate: "", honors: "" }],
          }))
        }
      >
        Ajouter une formation
      </AddButton>
    </>
  );
}

const removeButton = "shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400";

function SkillsTab({ data, edit }: { data: CvData; edit: Edit }) {
  const update = (id: string, patch: Partial<CvData["skills"][number]>) =>
    edit((d) => ({ ...d, skills: d.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <>
      {data.skills.map((skill, index) => (
        <div key={skill.id} className="flex items-center gap-2">
          <input
            aria-label={`Compétence ${index + 1}`}
            value={skill.name}
            maxLength={CV_LIMITS.short}
            placeholder="Ex. SQL"
            onChange={(e) => update(skill.id, { name: e.target.value })}
            className="input"
          />
          <select
            aria-label={`Niveau de la compétence ${index + 1}`}
            value={skill.level}
            onChange={(e) => update(skill.id, { level: e.target.value as SkillLevel })}
            className="input w-40 shrink-0"
          >
            {SKILL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => edit((d) => ({ ...d, skills: d.skills.filter((s) => s.id !== skill.id) }))}
            className={removeButton}
          >
            Retirer
          </button>
        </div>
      ))}
      <AddButton
        disabled={data.skills.length >= 40}
        onClick={() => edit((d) => ({ ...d, skills: [...d.skills, { id: newItemId(), name: "", level: "" }] }))}
      >
        Ajouter une compétence
      </AddButton>
    </>
  );
}

function LanguagesTab({ data, edit }: { data: CvData; edit: Edit }) {
  const update = (id: string, patch: Partial<CvData["languages"][number]>) =>
    edit((d) => ({ ...d, languages: d.languages.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  return (
    <>
      {data.languages.map((lang, index) => (
        <div key={lang.id} className="flex items-center gap-2">
          <input
            aria-label={`Langue ${index + 1}`}
            value={lang.name}
            maxLength={60}
            placeholder="Ex. Anglais"
            onChange={(e) => update(lang.id, { name: e.target.value })}
            className="input"
          />
          <input
            aria-label={`Niveau de la langue ${index + 1}`}
            value={lang.level}
            maxLength={60}
            placeholder="Ex. Courant (C1)"
            onChange={(e) => update(lang.id, { level: e.target.value })}
            className="input"
          />
          <button
            type="button"
            onClick={() => edit((d) => ({ ...d, languages: d.languages.filter((l) => l.id !== lang.id) }))}
            className={removeButton}
          >
            Retirer
          </button>
        </div>
      ))}
      <AddButton
        disabled={data.languages.length >= CV_LIMITS.items}
        onClick={() => edit((d) => ({ ...d, languages: [...d.languages, { id: newItemId(), name: "", level: "" }] }))}
      >
        Ajouter une langue
      </AddButton>
    </>
  );
}

/** Sections optionnelles : certifications, projets, centres d'intérêt. */
function MoreTab({ data, edit }: { data: CvData; edit: Edit }) {
  const updateCert = (id: string, patch: Partial<CvData["certifications"][number]>) =>
    edit((d) => ({ ...d, certifications: d.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const updateProject = (id: string, patch: Partial<CvData["projects"][number]>) =>
    edit((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return (
    <>
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">Certifications</h3>
        {data.certifications.map((cert, index) => (
          <ItemCard
            key={cert.id}
            title={cert.name || "Nouvelle certification"}
            index={index}
            count={data.certifications.length}
            onMove={(delta) => edit((d) => ({ ...d, certifications: move(d.certifications, index, delta) }))}
            onRemove={() => edit((d) => ({ ...d, certifications: d.certifications.filter((c) => c.id !== cert.id) }))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Certification" value={cert.name} onChange={(v) => updateCert(cert.id, { name: v })} className="sm:col-span-2" />
              <Field label="Organisme" value={cert.issuer} onChange={(v) => updateCert(cert.id, { issuer: v })} />
              <Field label="Date" value={cert.date} maxLength={40} placeholder="Ex. 2024" onChange={(v) => updateCert(cert.id, { date: v })} />
            </div>
          </ItemCard>
        ))}
        <AddButton
          disabled={data.certifications.length >= CV_LIMITS.items}
          onClick={() =>
            edit((d) => ({ ...d, certifications: [...d.certifications, { id: newItemId(), name: "", issuer: "", date: "" }] }))
          }
        >
          Ajouter une certification
        </AddButton>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">Projets</h3>
        {data.projects.map((project, index) => (
          <ItemCard
            key={project.id}
            title={project.name || "Nouveau projet"}
            index={index}
            count={data.projects.length}
            onMove={(delta) => edit((d) => ({ ...d, projects: move(d.projects, index, delta) }))}
            onRemove={() => edit((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== project.id) }))}
          >
            <Field label="Nom du projet" value={project.name} onChange={(v) => updateProject(project.id, { name: v })} />
            <TextArea
              label="Description"
              value={project.description}
              rows={3}
              onChange={(v) => updateProject(project.id, { description: v })}
            />
            <Field
              label="Lien (GitHub, démo…)"
              type="url"
              value={project.link}
              maxLength={CV_LIMITS.url}
              onChange={(v) => updateProject(project.id, { link: v })}
            />
          </ItemCard>
        ))}
        <AddButton
          disabled={data.projects.length >= CV_LIMITS.items}
          onClick={() =>
            edit((d) => ({ ...d, projects: [...d.projects, { id: newItemId(), name: "", description: "", link: "" }] }))
          }
        >
          Ajouter un projet
        </AddButton>
      </div>

      <TextArea
        label="Centres d'intérêt"
        value={data.interests}
        rows={2}
        maxLength={500}
        onChange={(interests) => edit((d) => ({ ...d, interests }))}
        placeholder="Séparés par des virgules. Ex. course à pied, photographie, bénévolat"
      />
    </>
  );
}
