import { DailyChart } from "@/components/admin/daily-chart";
import { CVB_COACH_DAILY_LIMIT } from "@/lib/ai-usage-limits";
import { COACH_LIMIT_DAYS, type CoachLimitStats } from "@/lib/coach-limit-rules";

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="ui-card-soft p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Section « Limite du coach » de /admin : refus par jour et personnes touchées. */
export function CoachLimitSection({
  result,
}: {
  result: { status: "ok"; stats: CoachLimitStats } | { status: "absente" } | { status: "erreur" };
}) {
  if (result.status === "absente") {
    return <p className="ui-notice px-4 py-3 text-sm">Applique la migration 0046 (table coach_limit_hits) dans Supabase.</p>;
  }
  if (result.status === "erreur") {
    return <p className="ui-notice-error px-4 py-3 text-sm">Les refus n&apos;ont pas pu être lus. Réessaie dans un instant.</p>;
  }
  const { stats } = result;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Questions refusées aux comptes gratuits ayant atteint leurs {CVB_COACH_DAILY_LIMIT} questions du jour, sur les{" "}
        {COACH_LIMIT_DAYS} derniers jours.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Refus" value={stats.total} />
        <Figure label="Personnes touchées" value={stats.people} />
        <Figure label="Éditeur / panneau" value={stats.bySurface.editeur} hint={`${stats.bySurface.panneau} dans le panneau de Lumeo`} />
      </div>
      <div className="ui-card p-5">
        <DailyChart points={stats.perDay} type="bar" label={`Refus par jour, ${COACH_LIMIT_DAYS} derniers jours`} unit="refus" />
      </div>
    </div>
  );
}
