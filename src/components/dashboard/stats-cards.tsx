import { IconBell, IconBriefcase, IconChat, IconClock } from "@/components/icons";

export type StatTone = "blue" | "indigo" | "violet" | "amber";

type Stat = { label: string; value: number; hint?: string; tone: StatTone; highlight?: boolean };

const TONES: Record<StatTone, { icon: typeof IconBriefcase; badge: string }> = {
  blue: { icon: IconBriefcase, badge: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  indigo: { icon: IconClock, badge: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  violet: { icon: IconChat, badge: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  amber: { icon: IconBell, badge: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const tone = TONES[stat.tone];
        return (
          <div
            key={stat.label}
            className={`card p-5 ${stat.highlight ? "ring-2 ring-amber-200 dark:ring-amber-400/30" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</dt>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.badge}`}>
                <tone.icon className="h-5 w-5" />
              </span>
            </div>
            <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stat.value}</dd>
            {stat.hint && <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.hint}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
