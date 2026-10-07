import type { FeedbackMetrics } from "@/lib/admin-metrics";
import { FAVORITE_FEATURES, MISSING_FEATURES, RECOMMEND_ANSWERS } from "@/lib/feedback-options";

const integer = new Intl.NumberFormat("fr-FR");
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const monthName = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });

const th = "px-3 py-2 text-left text-xs font-medium tracking-wide text-slate-500 uppercase";
const td = "px-3 py-2 align-top text-sm text-slate-700";

const stars = (rating: number) => `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;

/** Répartition des réponses : une barre par choix, longueur proportionnelle au plus fréquent. */
function Breakdown({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-700">{row.label}</span>
              <span className="tabular-nums text-slate-500">
                {integer.format(row.count)}
                {total > 0 && <span className="text-slate-400"> · {percent.format(row.count / total)}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Section « Avis utilisateurs » du tableau de bord admin (tous les avis, tous mois confondus). */
export function FeedbackSection({ feedback }: { feedback: FeedbackMetrics | null }) {
  if (!feedback) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Les avis ne sont pas encore disponibles : applique la migration 0016 (table feedback) dans Supabase.
      </p>
    );
  }
  if (feedback.count === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Aucun avis pour l&apos;instant.
      </p>
    );
  }

  const { count } = feedback;
  const yes = feedback.recommend.find((r) => r.key === "oui")?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Avis reçus</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{integer.format(count)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Note moyenne</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {decimal.format(feedback.averageRating)}
            <span className="text-base font-medium text-slate-500"> / 5</span>
          </p>
          <p className="mt-0.5 text-xs text-amber-500" aria-hidden="true">
            {stars(Math.round(feedback.averageRating))}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Recommanderaient Applyfy</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{percent.format(yes / count)}</p>
          <p className="mt-0.5 text-xs text-slate-500">Réponse « Oui »</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown
          title="Notes"
          total={count}
          rows={[5, 4, 3, 2, 1].map((r) => ({ label: `${stars(r)} (${r})`, count: feedback.ratingCounts[r - 1] }))}
        />
        <Breakdown
          title="Recommandation"
          total={count}
          rows={feedback.recommend.map((r) => ({ label: RECOMMEND_ANSWERS[r.key], count: r.count }))}
        />
        <Breakdown
          title="Fonctionnalité préférée"
          total={count}
          rows={feedback.favorites.map((r) => ({ label: FAVORITE_FEATURES[r.key], count: r.count }))}
        />
        <Breakdown
          title="Ce qui manque (plusieurs choix possibles)"
          total={count}
          rows={feedback.missing.map((r) => ({ label: MISSING_FEATURES[r.key], count: r.count }))}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <caption className="px-3 pt-3 text-left">
            <span className="block text-sm font-medium text-slate-900">Tendance sur 6 mois</span>
            <span className="block text-xs text-slate-500">Avis donnés ou modifiés chaque mois.</span>
          </caption>
          <thead className="border-b border-slate-200">
            <tr>
              <th className={th}>Mois</th>
              <th className={`${th} text-right`}>Avis</th>
              <th className={`${th} text-right`}>Note moyenne</th>
              <th className={`${th} text-right`}>Recommandent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feedback.trend.map((row) => (
              <tr key={row.month}>
                <td className={`${td} capitalize`}>{monthName.format(new Date(`${row.month}-01T00:00:00Z`))}</td>
                <td className={`${td} text-right tabular-nums`}>{integer.format(row.count)}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {row.averageRating === null ? "—" : `${decimal.format(row.averageRating)} / 5`}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {row.count ? percent.format(row.recommendYes / row.count) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <caption className="px-3 pt-3 text-left text-sm font-medium text-slate-900">Tous les avis</caption>
          <thead className="border-b border-slate-200">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Email</th>
              <th className={th}>Note</th>
              <th className={th}>Préférée</th>
              <th className={th}>Manque</th>
              <th className={th}>Recommande</th>
              <th className={th}>À améliorer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feedback.entries.map((entry) => (
              <tr key={`${entry.email}-${entry.updatedAt}`}>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{date.format(new Date(entry.updatedAt))}</td>
                <td className={`${td} break-all`}>{entry.email}</td>
                <td className={`${td} whitespace-nowrap text-amber-500`}>
                  <span aria-hidden="true">{stars(entry.rating)}</span>
                  <span className="sr-only">{entry.rating} sur 5</span>
                </td>
                <td className={td}>{FAVORITE_FEATURES[entry.favoriteFeature]}</td>
                <td className={td}>{entry.missing.map((m) => MISSING_FEATURES[m]).join(", ") || "—"}</td>
                <td className={td}>{RECOMMEND_ANSWERS[entry.recommend]}</td>
                <td className={`${td} min-w-56 whitespace-pre-line`}>{entry.improvement ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
