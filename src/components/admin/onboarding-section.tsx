import { ONBOARDING_LAUNCHED_AT, ONBOARDING_STEPS, type OnboardingStats, type OnboardingStep } from "@/lib/onboarding";

const SCREEN_LABELS: Record<OnboardingStep, string> = {
  accueil: "Écran 1 · cherches-tu un job ?",
  apport: "Écran 2 · ce qu'Applyfy apporte",
  temps: "Écran 2 bis · gagner du temps",
  cv: "Écran 3 · as-tu un CV ?",
  chemin_cv: "Chemin A · importer ou créer le CV",
  chemin_offre: "Chemin B · ajouter ou trouver une offre",
  guide_cv: "Phase guidée · améliorer le CV",
  guide_telecharger: "Phase guidée · enregistrer le CV",
  guide_offre: "Phase guidée · ajouter une offre",
};

const launched = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
}).format(new Date(ONBOARDING_LAUNCHED_AT));

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="ui-card-soft p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="ui-card p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Section « Parcours d'accueil » de /admin : réponses et progression des nouveaux comptes. */
export function OnboardingSection({
  result,
}: {
  result: { status: "ok"; stats: OnboardingStats } | { status: "absente" } | { status: "erreur" };
}) {
  if (result.status === "absente") {
    return <p className="ui-notice px-4 py-3 text-sm">Applique la migration 0045 (table onboarding_progress) dans Supabase.</p>;
  }
  if (result.status === "erreur") {
    return <p className="ui-notice-error px-4 py-3 text-sm">Le parcours d&apos;accueil n&apos;a pas pu être lu. Réessaie dans un instant.</p>;
  }
  const { stats } = result;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Comptes créés depuis la mise en ligne du parcours ({launched}).</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Nouveaux inscrits" value={stats.signups} />
        <Figure label="Parcours commencés" value={stats.started} />
        <Figure label="Parcours terminés" value={stats.completed} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Arrêtés en cours de route, par écran"
          rows={ONBOARDING_STEPS.map((s) => [SCREEN_LABELS[s], stats.stoppedAt[s]])}
        />
        <Breakdown title="Écrans passés (« Passer »)" rows={ONBOARDING_STEPS.map((s) => [SCREEN_LABELS[s], stats.skipped[s]])} />
        <Breakdown
          title="Tu cherches un job en ce moment ?"
          rows={[
            ["Oui, je cherche", stats.jobSearch.oui],
            ["Pas encore", stats.jobSearch.pas_encore],
            ["Sans réponse", stats.jobSearch.sans_reponse],
          ]}
        />
        <Breakdown
          title="Tu as déjà un CV ?"
          rows={[
            ["Ajouter mon CV", stats.hasCv.oui],
            ["Plus tard", stats.hasCv.plus_tard],
            ["Sans réponse", stats.hasCv.sans_reponse],
          ]}
        />
        <Breakdown
          title="Action choisie en fin de parcours"
          rows={[
            ["Importer mon CV", stats.choice.import],
            ["Le créer de zéro", stats.choice.zero],
            ["Ajouter une offre par lien", stats.choice.lien],
            ["Trouver une offre", stats.choice.recherche],
            ["Aucune (passé ou arrêté)", stats.choice.aucune],
          ]}
        />
      </div>
    </div>
  );
}
