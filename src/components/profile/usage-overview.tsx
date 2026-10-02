import { PremiumButton } from "@/components/usage/usage-limit-banner";
import {
  AI_USAGE_KINDS,
  AI_USAGE_LABELS,
  formatResetDate,
  isLimitReached,
  LIMIT_REACHED_MESSAGE,
  usageLabel,
  type AiUsage,
} from "@/lib/ai-usage-limits";

/** Section « Mon utilisation » : compteurs mensuels des actions IA du plan gratuit. */
export function UsageOverview({ usage }: { usage: AiUsage }) {
  const anyReached = AI_USAGE_KINDS.some((kind) => isLimitReached(usage.counts[kind]));

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {AI_USAGE_KINDS.map((kind) => {
          const { used, limit } = usage.counts[kind];
          const { title } = AI_USAGE_LABELS[kind];
          const reached = isLimitReached({ used, limit });
          const shown = Math.min(used, limit);
          const labelId = `usage-${kind}`;
          return (
            <li key={kind} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span id={labelId} className="font-medium text-slate-700">
                  {title}
                </span>
                <span className={reached ? "font-medium text-amber-700" : "text-slate-500"}>
                  {usageLabel(kind, { used, limit })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-labelledby={labelId}
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={shown}
                aria-valuetext={`${shown} sur ${limit}`}
                className="h-2 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${
                    reached ? "bg-amber-500" : "bg-linear-to-r from-blue-600 to-cyan-500"
                  }`}
                  style={{ width: `${(shown / limit) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-slate-500">
        Tes compteurs repartent à zéro le {formatResetDate(usage.resetsOn)}.
      </p>

      {anyReached && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="text-amber-900">{LIMIT_REACHED_MESSAGE}</p>
          <PremiumButton />
        </div>
      )}
    </div>
  );
}
