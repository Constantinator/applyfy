type Stat = { label: string; value: number; hint?: string; highlight?: boolean };

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border bg-white p-4 ${
            stat.highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
          }`}
        >
          <dt className="text-sm text-slate-500">{stat.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">{stat.value}</dd>
          {stat.hint && <dd className="mt-1 text-xs text-slate-500">{stat.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
