import { StatusBadge } from "@/components/status-badge";
import { FOLLOW_UP_AFTER_DAYS } from "@/lib/follow-up";
import type { ApplicationStatus } from "@/lib/types";

// Aperçus décoratifs des fonctionnalités (landing page) : versions miniatures de
// l'interface réelle, en HTML/CSS. Purement illustratifs : masqués des lecteurs d'écran.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="@container h-[200px] overflow-hidden rounded-block border border-line bg-surface p-3 select-none"
    >
      {children}
    </div>
  );
}

/** « Suivi en temps réel » : mini dashboard, 3 candidatures et leur statut. */
export function TrackingPreview() {
  const rows = [
    { company: "Spotify", role: "Data Analyst", status: "envoyee" as ApplicationStatus },
    { company: "BlaBlaCar", role: "Product Marketing", status: "relancee" as ApplicationStatus },
    { company: "Doctolib", role: "Product Manager", status: "entretien" as ApplicationStatus },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-semibold text-ink">
          Mes candidatures
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />À jour
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.company}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-box text-[11px] font-bold text-ink">
              {row.company.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-semibold text-ink">
                {row.company}
              </span>
              <span className="block truncate text-[10px] text-muted">
                {row.role}
              </span>
            </span>
            <StatusBadge status={row.status} />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** « Ton CV optimisé » : aperçu de l'onglet « Mots-clés » du CV Builder, en plus petit. */
export function CvPreview() {
  const groups = [
    { label: "Compétences techniques", keywords: ["Python", "Tableau", "SQL avancé"] },
    { label: "Compétences comportementales", keywords: ["Autonomie", "Esprit d'équipe"] },
  ];
  return (
    <Frame>
      <p className="px-1 text-xs font-semibold text-ink">Mots-clés</p>
      <p className="px-1 pt-1 text-[11px] text-muted">62 % de correspondance avec l&apos;offre</p>
      <div className="space-y-2.5 px-1 pt-2.5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-muted">{group.label}</p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {group.keywords.map((keyword) => (
                <li key={keyword} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                  {keyword}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** « Rappels de relance » : boîte « Relancer » avec le message pré-rempli. */
export function FollowUpPreview() {
  return (
    <Frame>
      <div className="rounded-xl border border-line bg-white p-2.5">
        <p className="text-xs font-semibold text-ink">Relancer</p>
        <p className="truncate text-[10px] text-muted">
          Sans réponse depuis {FOLLOW_UP_AFTER_DAYS} jours : c&apos;est le moment.
        </p>
        <div className="mt-2 line-clamp-3 rounded-lg border border-line px-2 py-1.5 text-[10px] leading-relaxed text-prose">
          Bonjour Mme Martin,
          <br />
          Je me permets de revenir vers vous au sujet de ma candidature au poste
          de Product Marketing chez BlaBlaCar…
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-[10px] font-medium whitespace-nowrap text-ink">
            Copier le message
          </span>
          <span className="ml-auto rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-white">
            Marquer comme relancée
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** « Tous tes documents » : fiche candidature avec son CV et sa lettre de motivation. */
export function DocumentsPreview() {
  const docs = [
    {
      title: "CV adapté à l'offre",
      detail: "Modifié il y a 2 jours",
      action: "Adapter mon CV à l'offre",
    },
    {
      title: "Lettre de motivation",
      detail: "Modifiée hier",
      action: "Ouvrir l'éditeur de lettre",
    },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="min-w-0 truncate text-xs">
          <span className="font-semibold text-ink">Doctolib</span>
          <span className="text-muted"> · Product Manager</span>
        </span>
        <StatusBadge status="entretien" />
      </div>
      <div className="space-y-2.5">
        {docs.map((doc) => (
          <div
            key={doc.title}
            className="flex items-center gap-2 rounded-xl border border-line bg-white p-2.5"
          >
            <span className="flex h-9 w-7 shrink-0 flex-col justify-center gap-1 rounded-sm border border-line bg-surface px-1">
              <span className="h-0.5 rounded bg-line-strong" />
              <span className="h-0.5 rounded bg-line-strong" />
              <span className="h-0.5 rounded bg-line-strong" />
              <span className="h-0.5 w-2/3 rounded bg-line-strong" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[11px] font-semibold text-ink">
                {doc.title}
              </span>
              <span className="block truncate text-[10px] text-muted">
                {doc.detail}
              </span>
            </span>
            {/* Libellé complet si l'aperçu est assez large, sinon « Ouvrir → ». */}
            <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-white">
              <span className="hidden @sm:inline">{doc.action}</span>
              <span className="@sm:hidden">Ouvrir</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
