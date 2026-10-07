import type { Metadata } from "next";
import { connection } from "next/server";

import { DailyChart } from "@/components/admin/daily-chart";
import { AI_ACTION_COSTS, PREMIUM_MONTHLY_PRICE, getAdminMetrics, requireAdmin } from "@/lib/admin-metrics";
import { AI_USAGE_LABELS } from "@/lib/ai-usage-limits";

export const metadata: Metadata = { title: "Admin — Applyfy", robots: { index: false } };

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const integer = new Intl.NumberFormat("fr-FR");
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
          tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlanBadge({ premium }: { premium: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        premium ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {premium ? "Premium" : "Gratuit"}
    </span>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium tracking-wide text-slate-500 uppercase";
const td = "px-3 py-2 text-sm text-slate-700";
const num = "text-right tabular-nums";

const signed = (value: number) => `${value > 0 ? "+" : ""}${euros.format(value)}`;

export default async function AdminPage() {
  await connection();
  await requireAdmin();
  const m = await getAdminMetrics();
  const month = monthName.format(new Date(`${m.period}T00:00:00Z`));
  // « d'octobre », « de mars ».
  const ofMonth = `${/^[aeiou]/i.test(month) ? "d'" : "de "}${month}`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Données {ofMonth} · mises à jour le {dateTime.format(new Date(m.generatedAt))}
        </p>
      </div>

      {/* 1. Utilisateurs */}
      <Section id="admin-utilisateurs" title="Utilisateurs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Inscrits"
            value={integer.format(m.users.total)}
            hint={`+${integer.format(m.users.newLast30Days)} sur 30 jours`}
          />
          <Stat
            label="Actifs ce mois-ci"
            value={integer.format(m.users.activeThisMonth)}
            hint="Au moins une action IA"
          />
          <Stat label="Gratuit" value={integer.format(m.users.free)} />
          <Stat
            label="Premium"
            value={integer.format(m.users.premium)}
            hint={m.users.total ? `${percent.format(m.users.premium / m.users.total)} des inscrits` : undefined}
          />
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-medium text-slate-900">Nouveaux inscrits par jour (30 jours)</h3>
          <DailyChart
            points={m.users.signupsPerDay}
            type="bar"
            unit="inscrits"
            label="Nouveaux inscrits par jour sur les 30 derniers jours"
          />
        </div>
      </Section>

      {/* 2. Revenus */}
      <Section id="admin-revenus" title="Revenus">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="MRR"
            value={euros.format(m.revenue.mrr)}
            hint={`${integer.format(m.users.premium)} abonnés × ${PREMIUM_MONTHLY_PRICE} €`}
          />
          <Stat
            label="Conversion Gratuit → Premium"
            value={percent.format(m.revenue.conversionRate)}
            hint="Abonnés / inscrits"
          />
          <Stat
            label="Abonnés gagnés (nets)"
            value={`${m.revenue.netNewSubscribers30Days > 0 ? "+" : ""}${m.revenue.netNewSubscribers30Days}`}
            hint="Sur 30 jours"
          />
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-medium text-slate-900">Abonnés Premium (30 jours)</h3>
          <DailyChart
            points={m.revenue.subscribersPerDay}
            type="line"
            unit="abonnés"
            label="Nombre d'abonnés Premium par jour sur les 30 derniers jours"
          />
        </div>
      </Section>

      {/* 3. Coûts IA */}
      <Section id="admin-couts" title={`Coûts IA ${ofMonth}`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Coût total" value={euros.format(m.costs.total)} />
          <Stat
            label="Moyenne par utilisateur gratuit"
            value={euros.format(m.costs.avgPerFreeUser)}
            hint={`Sur ${integer.format(m.users.free)} utilisateurs gratuits`}
          />
          <Stat
            label="Moyenne par utilisateur Premium"
            value={euros.format(m.costs.avgPerPremiumUser)}
            hint={`Sur ${integer.format(m.users.premium)} abonnés`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card overflow-x-auto">
            <table className="w-full">
              <caption className="px-3 pt-3 text-left text-sm font-medium text-slate-900">Actions par type</caption>
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={th}>Action</th>
                  <th className={`${th} ${num}`}>Nombre</th>
                  <th className={`${th} ${num}`}>Coût unitaire</th>
                  <th className={`${th} ${num}`}>Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.costs.byKind.map((row) => (
                  <tr key={row.kind}>
                    <td className={td}>{AI_USAGE_LABELS[row.kind].title}</td>
                    <td className={`${td} ${num}`}>{integer.format(row.count)}</td>
                    <td className={`${td} ${num} text-slate-500`}>{euros.format(AI_ACTION_COSTS[row.kind])}</td>
                    <td className={`${td} ${num} font-medium`}>{euros.format(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200">
                <tr>
                  <td className={`${td} font-semibold text-slate-900`}>Total</td>
                  <td className={`${td} ${num} font-semibold`}>
                    {integer.format(m.costs.byKind.reduce((s, r) => s + r.count, 0))}
                  </td>
                  <td />
                  <td className={`${td} ${num} font-semibold text-slate-900`}>{euros.format(m.costs.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <caption className="px-3 pt-3 text-left text-sm font-medium text-slate-900">
                Top 10 des plus gros consommateurs
              </caption>
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={th}>Email</th>
                  <th className={`${th} ${num}`}>Actions</th>
                  <th className={`${th} ${num}`}>Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.costs.topUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`${td} text-slate-500`}>
                      Aucune action IA ce mois-ci.
                    </td>
                  </tr>
                ) : (
                  m.costs.topUsers.map((u) => (
                    <tr key={u.email}>
                      <td className={td}>
                        <span className="mr-2 break-all">{u.email}</span>
                        <PlanBadge premium={u.premium} />
                      </td>
                      <td className={`${td} ${num}`}>{integer.format(u.actions)}</td>
                      <td className={`${td} ${num} font-medium`}>{euros.format(u.cost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 4. Rentabilité */}
      <Section id="admin-rentabilite" title="Rentabilité">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Revenus du mois (MRR)" value={euros.format(m.profitability.revenue)} />
          <Stat label="Coûts IA du mois" value={euros.format(m.profitability.cost)} />
          <Stat
            label={m.profitability.result >= 0 ? "Bénéfice estimé" : "Perte estimée"}
            value={signed(m.profitability.result)}
            tone={m.profitability.result >= 0 ? "good" : "bad"}
            hint="Hors frais Stripe, hébergement et autres coûts"
          />
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <caption className="px-3 pt-3 text-left">
              <span className="block text-sm font-medium text-slate-900">Projection sur 12 mois</span>
              <span className="block text-xs text-slate-500">
                Même croissance que sur les 30 derniers jours : +{integer.format(m.users.newLast30Days)} inscrits et{" "}
                {m.revenue.netNewSubscribers30Days >= 0 ? "+" : ""}
                {m.revenue.netNewSubscribers30Days} abonnés par mois, coût IA moyen par utilisateur inchangé.
              </span>
            </caption>
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Mois</th>
                <th className={`${th} ${num}`}>Inscrits</th>
                <th className={`${th} ${num}`}>Abonnés</th>
                <th className={`${th} ${num}`}>Revenus</th>
                <th className={`${th} ${num}`}>Coûts IA</th>
                <th className={`${th} ${num}`}>Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.profitability.projection.map((row) => (
                <tr key={row.month}>
                  <td className={td}>M+{row.month}</td>
                  <td className={`${td} ${num}`}>{integer.format(row.users)}</td>
                  <td className={`${td} ${num}`}>{integer.format(row.subscribers)}</td>
                  <td className={`${td} ${num}`}>{euros.format(row.revenue)}</td>
                  <td className={`${td} ${num}`}>{euros.format(row.cost)}</td>
                  <td
                    className={`${td} ${num} font-medium ${row.result >= 0 ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {signed(row.result)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Derniers inscrits */}
      <Section id="admin-inscrits" title="Derniers inscrits">
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Email</th>
                <th className={th}>Inscription</th>
                <th className={th}>Plan</th>
                <th className={`${th} ${num}`}>Actions IA ce mois</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.latestSignups.map((u) => (
                <tr key={`${u.email}-${u.createdAt}`}>
                  <td className={`${td} break-all`}>{u.email}</td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{dateTime.format(new Date(u.createdAt))}</td>
                  <td className={td}>
                    <PlanBadge premium={u.premium} />
                  </td>
                  <td className={`${td} ${num}`}>{integer.format(u.actionsThisMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
