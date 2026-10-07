import type { Metadata } from "next";
import { connection } from "next/server";

import { DailyChart } from "@/components/admin/daily-chart";
import { FeedbackSection } from "@/components/admin/feedback-section";
import { MonthPicker } from "@/components/admin/month-picker";
import {
  AI_ACTION_COSTS,
  PREMIUM_MONTHLY_PRICE,
  STRIPE_FEE_FIXED,
  STRIPE_FEE_RATE,
  URSSAF_RATE,
  VAT_FRANCHISE_THRESHOLD,
  getAdminMetrics,
  getFeedbackMetrics,
  requireAdmin,
} from "@/lib/admin-metrics";
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
const dayName = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

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

// Montant signé : « +5,54 € », « -0,37 € », « 0,00 € » (jamais « -0,00 € »).
const signed = (value: number) =>
  Math.abs(value) < 0.005 ? euros.format(0) : `${value > 0 ? "+" : ""}${euros.format(value)}`;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await connection();
  await requireAdmin();
  const { mois } = await searchParams;
  const [m, feedback] = await Promise.all([
    getAdminMetrics(typeof mois === "string" ? mois : undefined),
    getFeedbackMetrics(),
  ]);
  const month = monthName.format(new Date(`${m.month}-01T00:00:00Z`));
  const asOf = dayName.format(new Date(`${m.asOf}T00:00:00Z`));
  // « d'octobre », « de mars ».
  const ofMonth = `${/^[aeiou]/i.test(month) ? "d'" : "de "}${month}`;
  const p = m.profitability;
  const sumOf = (key: "revenue" | "stripeFees" | "aiCost" | "urssaf" | "net") =>
    p.projection.reduce((sum, row) => sum + row[key], 0);
  const projectedYearRevenue = sumOf("revenue");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {m.isCurrentMonth
              ? `Mois en cours · mis à jour le ${dateTime.format(new Date(m.generatedAt))}`
              : `Mois terminé · inscrits et abonnés au ${asOf}`}
          </p>
        </div>
        <MonthPicker month={m.month} months={m.months} />
      </div>

      {/* 1. Utilisateurs */}
      <Section id="admin-utilisateurs" title="Utilisateurs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Inscrits"
            value={integer.format(m.users.total)}
            hint={`+${integer.format(m.users.newInMonth)} en ${month}`}
          />
          <Stat
            label={`Actifs en ${month}`}
            value={integer.format(m.users.activeInMonth)}
            hint="Au moins une action IA dans le mois"
          />
          <Stat label="Gratuit" value={integer.format(m.users.free)} />
          <Stat
            label="Premium"
            value={integer.format(m.users.premium)}
            hint={m.users.total ? `${percent.format(m.users.premium / m.users.total)} des inscrits` : undefined}
          />
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-medium text-slate-900">
            Nouveaux inscrits par jour <span className="font-normal text-slate-500">· 30 derniers jours</span>
          </h3>
          <DailyChart
            points={m.charts.signupsPerDay}
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
            value={`${m.revenue.netNewSubscribersInMonth > 0 ? "+" : ""}${m.revenue.netNewSubscribersInMonth}`}
            hint={`En ${month}`}
          />
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-medium text-slate-900">
            Abonnés Premium <span className="font-normal text-slate-500">· 30 derniers jours</span>
          </h3>
          <DailyChart
            points={m.charts.subscribersPerDay}
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
        <div className="card overflow-x-auto">
          <table className="w-full">
            <caption className="px-3 pt-3 text-left text-sm font-medium text-slate-900">
              Compte de résultat {ofMonth}
            </caption>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <th scope="row" className={`${td} text-left font-medium text-slate-900`}>
                  Revenus bruts (MRR)
                  <span className="block text-xs font-normal text-slate-500">
                    {integer.format(m.users.premium)} abonnés × {PREMIUM_MONTHLY_PRICE} €
                  </span>
                </th>
                <td className={`${td} ${num} font-medium text-slate-900`}>{euros.format(p.revenue)}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} text-left font-normal`}>
                  Frais Stripe
                  <span className="block text-xs text-slate-500">
                    {percent.format(STRIPE_FEE_RATE)} + {euros.format(STRIPE_FEE_FIXED)} par paiement
                  </span>
                </th>
                <td className={`${td} ${num}`}>{signed(-p.stripeFees)}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} text-left font-normal`}>
                  Coûts IA
                  <span className="block text-xs text-slate-500">Calculés depuis la table usage</span>
                </th>
                <td className={`${td} ${num}`}>{signed(-p.aiCost)}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} text-left font-normal`}>
                  Cotisations URSSAF
                  <span className="block text-xs text-slate-500">
                    {percent.format(URSSAF_RATE)} du CA brut
                  </span>
                </th>
                <td className={`${td} ${num}`}>{signed(-p.urssaf)}</td>
              </tr>
              <tr>
                <th scope="row" className={`${td} text-left font-normal`}>
                  TVA
                  <span className="block text-xs text-slate-500">
                    Auto-entrepreneur sous {euros.format(VAT_FRANCHISE_THRESHOLD)} de CA annuel
                  </span>
                </th>
                <td className={`${td} text-right text-slate-500`}>Non applicable — Franchise en base de TVA</td>
              </tr>
            </tbody>
            <tfoot className="border-t-2 border-slate-200">
              <tr>
                <th scope="row" className={`${td} text-left font-semibold text-slate-900`}>
                  Bénéfice net réel
                  <span className="block text-xs font-normal text-slate-500">
                    Revenus − frais Stripe − coûts IA − URSSAF (hors hébergement et autres frais)
                  </span>
                </th>
                <td
                  className={`${td} ${num} text-base font-bold ${p.net >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {signed(p.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {projectedYearRevenue > VAT_FRANCHISE_THRESHOLD && (
          <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Au rythme projeté, le CA des 12 prochains mois ({euros.format(projectedYearRevenue)}) dépasserait le
            plafond de la franchise en base de TVA ({euros.format(VAT_FRANCHISE_THRESHOLD)}) : la TVA deviendrait
            applicable. La projection ci-dessous n&apos;en tient pas compte.
          </p>
        )}
        <div className="card overflow-x-auto">
          <table className="w-full">
            <caption className="px-3 pt-3 text-left">
              <span className="block text-sm font-medium text-slate-900">Projection sur 12 mois</span>
              <span className="block text-xs text-slate-500">
                À partir {ofMonth}, même croissance que{" "}
                {p.growth.basis === "30 jours" ? "sur les 30 derniers jours" : `en ${month}`} : +
                {integer.format(p.growth.users)} inscrits et {p.growth.subscribers >= 0 ? "+" : ""}
                {p.growth.subscribers} abonnés par mois, coût IA moyen par utilisateur et taux (Stripe, URSSAF)
                inchangés.
              </span>
            </caption>
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Mois</th>
                <th className={`${th} ${num}`}>Inscrits</th>
                <th className={`${th} ${num}`}>Abonnés</th>
                <th className={`${th} ${num}`}>Revenus</th>
                <th className={`${th} ${num}`}>Stripe</th>
                <th className={`${th} ${num}`}>Coûts IA</th>
                <th className={`${th} ${num}`}>URSSAF</th>
                <th className={`${th} ${num}`}>Bénéfice net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.profitability.projection.map((row) => (
                <tr key={row.month}>
                  <td className={td}>M+{row.month}</td>
                  <td className={`${td} ${num}`}>{integer.format(row.users)}</td>
                  <td className={`${td} ${num}`}>{integer.format(row.subscribers)}</td>
                  <td className={`${td} ${num}`}>{euros.format(row.revenue)}</td>
                  <td className={`${td} ${num} text-slate-500`}>{euros.format(row.stripeFees)}</td>
                  <td className={`${td} ${num} text-slate-500`}>{euros.format(row.aiCost)}</td>
                  <td className={`${td} ${num} text-slate-500`}>{euros.format(row.urssaf)}</td>
                  <td className={`${td} ${num} font-medium ${row.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {signed(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200">
              <tr>
                <td className={`${td} font-semibold text-slate-900`} colSpan={3}>
                  Total 12 mois
                </td>
                <td className={`${td} ${num} font-semibold`}>{euros.format(projectedYearRevenue)}</td>
                <td className={`${td} ${num}`}>{euros.format(sumOf("stripeFees"))}</td>
                <td className={`${td} ${num}`}>{euros.format(sumOf("aiCost"))}</td>
                <td className={`${td} ${num}`}>{euros.format(sumOf("urssaf"))}</td>
                <td className={`${td} ${num} font-semibold ${sumOf("net") >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {signed(sumOf("net"))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      {/* 5. Derniers inscrits */}
      <Section id="admin-inscrits" title={m.isCurrentMonth ? "Derniers inscrits" : `Derniers inscrits au ${asOf}`}>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Email</th>
                <th className={th}>Inscription</th>
                <th className={th}>Plan</th>
                <th className={`${th} ${num}`}>Actions IA en {month}</th>
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
                  <td className={`${td} ${num}`}>{integer.format(u.actionsInMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Avis utilisateurs (tous les mois, indépendant du sélecteur) */}
      <Section id="admin-avis" title="Avis utilisateurs">
        <FeedbackSection feedback={feedback} />
      </Section>
    </main>
  );
}
