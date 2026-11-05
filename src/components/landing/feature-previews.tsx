// Aperçus décoratifs des fonctionnalités (landing page) : versions miniatures de
// l'interface réelle, en HTML/CSS. Purement illustratifs : masqués des lecteurs d'écran.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="@container h-[200px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 select-none"
    >
      {children}
    </div>
  );
}

const STATUS = {
  envoyee: "bg-blue-50 text-blue-700 ring-blue-200",
  relancer: "bg-amber-50 text-amber-700 ring-amber-200",
  entretien: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;

function Pill({
  tone,
  children,
}: {
  tone: keyof typeof STATUS;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${STATUS[tone]}`}
    >
      {children}
    </span>
  );
}

/** « Suivi en temps réel » : mini dashboard, 3 candidatures et leur statut. */
export function TrackingPreview() {
  const rows = [
    {
      company: "Spotify",
      role: "Data Analyst",
      status: "Envoyée",
      tone: "envoyee" as const,
    },
    {
      company: "BlaBlaCar",
      role: "Product Marketing",
      status: "À relancer",
      tone: "relancer" as const,
    },
    {
      company: "Doctolib",
      role: "Product Manager",
      status: "Entretien",
      tone: "entretien" as const,
    },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-semibold text-slate-900">
          Mes candidatures
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />À jour
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.company}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
              {row.company.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-semibold text-slate-900">
                {row.company}
              </span>
              <span className="block truncate text-[10px] text-slate-500">
                {row.role}
              </span>
            </span>
            <Pill tone={row.tone}>{row.status}</Pill>
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
      <p className="px-1 text-xs font-semibold text-slate-900">Mots-clés</p>
      <p className="px-1 pt-1 text-[11px] text-slate-500">62 % de correspondance avec l&apos;offre</p>
      <div className="space-y-2.5 px-1 pt-2.5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{group.label}</p>
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
      <div className="rounded-lg border border-amber-300 bg-white p-2.5 shadow-sm ring-1 ring-amber-200">
        <p className="text-xs font-semibold text-slate-900">Relancer</p>
        <p className="truncate text-[10px] text-slate-500">
          Sans réponse depuis 8 jours : c&apos;est le moment.
        </p>
        <div className="mt-2 line-clamp-3 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] leading-relaxed text-slate-600">
          Bonjour Mme Martin,
          <br />
          Je me permets de revenir vers vous au sujet de ma candidature au poste
          de Product Marketing chez BlaBlaCar…
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium whitespace-nowrap text-slate-700">
            Copier le message
          </span>
          <span className="ml-auto rounded-md bg-[#1E40AF] px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-white">
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
          <span className="font-semibold text-slate-900">Doctolib</span>
          <span className="text-slate-500"> · Product Manager</span>
        </span>
        <Pill tone="entretien">Entretien</Pill>
      </div>
      <div className="space-y-2.5">
        {docs.map((doc) => (
          <div
            key={doc.title}
            className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white p-2.5 shadow-sm"
          >
            <span className="flex h-9 w-7 shrink-0 flex-col justify-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-1">
              <span className="h-0.5 rounded bg-slate-300" />
              <span className="h-0.5 rounded bg-slate-300" />
              <span className="h-0.5 rounded bg-slate-300" />
              <span className="h-0.5 w-2/3 rounded bg-slate-300" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[11px] font-semibold text-slate-900">
                {doc.title}
              </span>
              <span className="block truncate text-[10px] text-slate-500">
                {doc.detail}
              </span>
            </span>
            {/* Libellé complet si l'aperçu est assez large, sinon « Ouvrir → ». */}
            <span className="shrink-0 rounded-md bg-[#1E40AF] px-2 py-1 text-[10px] font-semibold text-white">
              <span className="hidden @sm:inline">{doc.action}</span>
              <span className="@sm:hidden">Ouvrir</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
