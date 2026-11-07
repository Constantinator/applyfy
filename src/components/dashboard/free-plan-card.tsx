import Link from "next/link";

import { buildFreePlanLines, type FreePlanCounts } from "@/lib/free-plan";

/** Carte « Ton plan gratuit » : utilisation réelle des quotas, sans message d'alerte. */
export function FreePlanCard({ counts }: { counts: FreePlanCounts }) {
  return (
    <section aria-labelledby="free-plan-title" className="ui-card p-5 sm:p-7">
      <h2 id="free-plan-title" className="ui-title">
        Ton plan gratuit
      </h2>
      <ul className="mt-5 space-y-4">
        {buildFreePlanLines(counts).map((line) => (
          <li key={line.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-ink dark:text-slate-200">{line.label}</span>
              <span className="shrink-0 font-medium text-ink dark:text-white">
                {line.used} / {line.limit}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={line.label}
              aria-valuemin={0}
              aria-valuemax={line.limit}
              aria-valuenow={line.used}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-track dark:bg-slate-800"
            >
              <div
                className={`h-full rounded-full ${line.reached ? "bg-late" : "bg-ink dark:bg-white"}`}
                style={{ width: `${line.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <Link href="/premium" className="ui-btn-secondary mt-6">
        Passer au Premium
      </Link>
    </section>
  );
}
