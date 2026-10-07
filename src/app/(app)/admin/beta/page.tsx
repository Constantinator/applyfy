import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BetaMessageForm, RemoveBetaButton } from "@/components/admin/beta-admin-controls";
import { requireAdmin } from "@/lib/admin-metrics";
import { betaActivity, listBetaTesters, type BetaActivity } from "@/lib/beta-admin";
import {
  BETA_MAX_TESTERS,
  BETA_REPORT_STATUS_LABELS,
  BETA_REPORTS,
  BETA_STATUS_LABELS,
  formatAnswer,
  type BetaReportStatus,
  type BetaStatus,
} from "@/lib/beta-rules";
import { isEmailConfigured } from "@/lib/email/brevo";

export const metadata: Metadata = { title: "Beta testeurs — Admin Applyfy", robots: { index: false } };

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

const STATUS_STYLES: Record<BetaStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  suspended: "bg-amber-50 text-amber-800 ring-amber-200",
  removed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const REPORT_STYLES: Record<BetaReportStatus, string> = {
  a_venir: "text-slate-500",
  a_faire: "text-blue-700",
  soumis: "text-emerald-700",
  en_retard: "font-medium text-red-700",
};

const ACTIVITY: Record<BetaActivity["kind"], { icon: string; label: (e: BetaActivity) => string }> = {
  soumis: { icon: "📝", label: (e) => `Rapport ${e.report} soumis` },
  en_retard: { icon: "⏰", label: (e) => `Rapport ${e.report} en retard (suspension au prochain passage de la tâche quotidienne)` },
  suspendu: { icon: "⛔", label: (e) => `Accès retiré${e.detail ? ` — ${e.detail}` : ""}` },
};

const th = "px-3 py-2 text-left text-xs font-medium tracking-wide text-slate-500 uppercase";
const td = "px-3 py-2 align-top text-sm text-slate-700";

export default async function BetaAdminPage({ searchParams }: PageProps<"/admin/beta">) {
  await connection();
  await requireAdmin();
  const { a: messageTarget } = await searchParams;
  const testers = await listBetaTesters();

  if (!testers) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          ← Retour à l&apos;admin
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Beta testeurs</h1>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Le programme beta n&apos;est pas encore disponible : applique la migration 0017 (tables beta_testers et
          beta_reports) dans Supabase.
        </p>
      </main>
    );
  }

  const active = testers.filter((t) => t.status === "active");
  const activity = betaActivity(testers);
  const submittedCount = testers.reduce((sum, t) => sum + t.submittedCount, 0);
  const target = typeof messageTarget === "string" && testers.some((t) => t.userId === messageTarget) ? messageTarget : "all";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          ← Retour à l&apos;admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Beta testeurs</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Rapports à envoyer 7, 14 et 30 jours après l&apos;inscription. Rappels J-2 et suspensions : tâche
          quotidienne de 7 h 30 (UTC).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Testeurs actifs</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {active.length}
            <span className="text-base font-medium text-slate-500"> / {BETA_MAX_TESTERS}</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Suspendus ou retirés</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {testers.length - active.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Rapports reçus</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{submittedCount}</p>
        </div>
      </div>

      {/* Notifications : rapports soumis, en retard, suspensions (30 derniers jours) */}
      <section aria-labelledby="beta-activite" className="space-y-3">
        <h2 id="beta-activite" className="text-lg font-semibold text-slate-900">
          Activité récente
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">Rien de nouveau sur les 30 derniers jours.</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {activity.map((event, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                <span aria-hidden="true">{ACTIVITY[event.kind].icon}</span>
                <span className="font-medium text-slate-900">{event.email}</span>
                <span className={event.kind === "soumis" ? "text-slate-600" : "text-red-700"}>
                  {ACTIVITY[event.kind].label(event)}
                </span>
                <span className="ml-auto text-xs text-slate-400">{date.format(new Date(event.date))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="beta-liste" className="space-y-3">
        <h2 id="beta-liste" className="text-lg font-semibold text-slate-900">
          Tous les beta testeurs
        </h2>
        {testers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun beta testeur pour l&apos;instant.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={th}>Email</th>
                  <th className={th}>Inscription</th>
                  <th className={th}>Statut</th>
                  <th className={th}>Rapports</th>
                  {BETA_REPORTS.map((def) => (
                    <th key={def.number} className={th}>
                      R{def.number} · {def.period.toLowerCase()}
                    </th>
                  ))}
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {testers.map((t) => (
                  <tr key={t.userId}>
                    <td className={`${td} break-all`}>
                      {t.email}
                      {t.submittedCount > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-blue-600">Voir les réponses</summary>
                          <div className="mt-2 space-y-3">
                            {t.reports
                              .filter((r) => r.answers)
                              .map((r) => (
                                <dl key={r.number} className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs">
                                  <p className="font-semibold text-slate-900">Rapport {r.number}</p>
                                  {BETA_REPORTS[r.number - 1].fields.map((field) => (
                                    <div key={field.name}>
                                      <dt className="text-slate-500">{field.label}</dt>
                                      <dd className="whitespace-pre-line text-slate-700">
                                        {formatAnswer(field, r.answers?.[field.name])}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{date.format(new Date(t.joinedAt))}</td>
                    <td className={td}>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[t.status]}`}>
                        {BETA_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td className={`${td} font-medium tabular-nums`}>{t.submittedCount}/3</td>
                    {t.reports.map((r) => (
                      <td key={r.number} className={`${td} whitespace-nowrap`}>
                        <span className="block text-xs text-slate-500">avant le {shortDate.format(new Date(r.deadline))}</span>
                        <span className={`text-xs ${REPORT_STYLES[r.status]}`}>
                          {BETA_REPORT_STATUS_LABELS[r.status]}
                          {r.submittedAt ? ` le ${shortDate.format(new Date(r.submittedAt))}` : ""}
                        </span>
                      </td>
                    ))}
                    <td className={`${td} space-y-1.5`}>
                      <Link
                        href={`/admin/beta?a=${t.userId}#message`}
                        scroll={false}
                        className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                      >
                        Envoyer un message
                      </Link>
                      {t.status !== "removed" && <RemoveBetaButton userId={t.userId} email={t.email} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="message" aria-labelledby="beta-message-title" className="scroll-mt-6 space-y-3">
        <h2 id="beta-message-title" className="text-lg font-semibold text-slate-900">
          Envoyer un message
        </h2>
        {isEmailConfigured() ? (
          <div className="card p-5">
            <BetaMessageForm
              key={target}
              initialTarget={target}
              testers={testers.map((t) => ({ userId: t.userId, email: t.email, active: t.status === "active" }))}
            />
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            L&apos;envoi d&apos;emails n&apos;est pas configuré (BREVO_API_KEY, BREVO_SENDER_EMAIL).
          </p>
        )}
      </section>
    </main>
  );
}
