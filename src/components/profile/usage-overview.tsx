import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import {
  AI_USAGE_KINDS,
  AI_USAGE_LABELS,
  formatResetDate,
  isLimitReached,
  usageLabel,
  type AiUsage,
} from "@/lib/ai-usage-limits";

/** Section « Mon utilisation » : compteurs mensuels des actions IA (limites du plan gratuit). */
export function UsageOverview({ usage }: { usage: AiUsage }) {
  if (usage.premium) {
    return (
      <ul className="divide-y divide-slate-100 text-sm">
        {AI_USAGE_KINDS.map((kind) => (
          <li key={kind} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="font-medium text-slate-700">{AI_USAGE_LABELS[kind].title}</span>
            <span className="text-slate-500">
              {usageLabel(kind, usage.counts[kind])} · <span className="text-emerald-700">illimité</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const anyReached = AI_USAGE_KINDS.some((kind) => isLimitReached(usage.counts[kind]));

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {AI_USAGE_KINDS.map((kind) => {
          const { used } = usage.counts[kind];
          const limit = usage.counts[kind].limit ?? 0;
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
                    reached ? "bg-amber-500" : "bg-blue-600"
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

      {/* Même bandeau que sur les fiches ; la date de remise à zéro est affichée juste au-dessus. */}
      {anyReached && <UsageLimitBanner />}
    </div>
  );
}
