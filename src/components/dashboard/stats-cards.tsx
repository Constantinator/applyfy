import { IconBell, IconBriefcase, IconChat, IconClock } from "@/components/icons";
import { FUNCTION_TINTS } from "@/lib/ui-tints";

export type StatTone = "blue" | "waiting" | "violet" | "amber";

type Stat = { label: string; value: number; hint?: string; tone: StatTone; highlight?: boolean };

const NEUTRAL = "bg-pill text-ink dark:bg-slate-800 dark:text-slate-200";

// Candidatures → offres, entretiens → entretiens ; « en attente » reste neutre, « à relancer » garde l'orange de retard.
const TONES: Record<StatTone, { icon: typeof IconBriefcase; badge: string }> = {
  blue: { icon: IconBriefcase, badge: FUNCTION_TINTS.offer },
  waiting: { icon: IconClock, badge: NEUTRAL },
  violet: { icon: IconChat, badge: FUNCTION_TINTS.interview },
  amber: { icon: IconBell, badge: "bg-pill dark:bg-amber-500/15 text-late dark:text-amber-400" },
};

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const tone = TONES[stat.tone];
        return (
          <div
            key={stat.label}
            className={`ui-card p-5 ${stat.highlight ? "ring-2 ring-late/25 dark:ring-amber-400/30" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <dt className="text-sm font-medium text-muted dark:text-slate-400">{stat.label}</dt>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}>
                <tone.icon className="h-5 w-5" />
              </span>
            </div>
            <dd className="mt-2 text-3xl font-semibold tracking-title text-ink dark:text-white">{stat.value}</dd>
            {stat.hint && <dd className="mt-1 text-xs text-muted dark:text-slate-400">{stat.hint}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
