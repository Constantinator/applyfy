import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BetaMessageForm, ReactivateBetaButton, RemoveBetaButton } from "@/components/admin/beta-admin-controls";
import { AdminThread, BroadcastMessageForm } from "@/components/beta/beta-messages";
import { requireAdmin } from "@/lib/admin-metrics";
import { betaActivity, listBetaTesters, type BetaActivity } from "@/lib/beta-admin";
import { listBetaThreads } from "@/lib/beta-messages";
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
  active: "bg-pill text-ink ring-line",
  suspended: "bg-[#FEF2F2] text-[#B91C1C] ring-[#FECACA]",
  removed: "bg-pill text-muted ring-line",
};

const REPORT_STYLES: Record<BetaReportStatus, string> = {
  a_venir: "text-muted",
  a_faire: "text-accent",
  soumis: "text-ink dark:text-slate-200",
  en_retard: "font-medium text-red-700",
};

const ACTIVITY: Record<BetaActivity["kind"], { icon: string; label: (e: BetaActivity) => string }> = {
  soumis: { icon: "📝", label: (e) => `Rapport ${e.report} soumis` },
  en_retard: { icon: "⏰", label: (e) => `Rapport ${e.report} en retard (suspension au prochain passage de la tâche quotidienne)` },
  suspendu: { icon: "⛔", label: (e) => `Accès retiré${e.detail ? ` — ${e.detail}` : ""}` },
};

const th = "px-3 py-2 text-left text-xs font-medium tracking-wide text-muted uppercase";
const td = "px-3 py-2 align-top text-sm text-ink";

export default async function BetaAdminPage({ searchParams }: PageProps<"/admin/beta">) {
  await connection();
  await requireAdmin();
  const { a: messageTarget, fil } = await searchParams;
  const [testers, threads] = await Promise.all([listBetaTesters(), listBetaThreads()]);

  if (!testers) {
    return (
      <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
        <main className="ui-page flex-1 space-y-6">
          <Link href="/admin" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
            Retour à l&apos;admin
          </Link>
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink">Beta testeurs</h1>
          <p className="ui-notice px-4 py-3 text-sm">
            Le programme beta n&apos;est pas encore disponible : applique la migration 0017 (tables beta_testers et
            beta_reports) dans Supabase.
          </p>
        </main>
      </div>
    );
  }

  const active = testers.filter((t) => t.status === "active");
  const activity = betaActivity(testers);
  const submittedCount = testers.reduce((sum, t) => sum + t.submittedCount, 0);
  const target = typeof messageTarget === "string" && testers.some((t) => t.userId === messageTarget) ? messageTarget : "all";

  // Messagerie interne : un fil par testeur, les plus récents d'abord.
  const threadList = testers
    .map((tester) => {
      const messages = threads?.get(tester.userId) ?? [];
      return {
        tester,
        messages,
        lastAt: messages.at(-1)?.createdAt ?? null,
        unread: messages.filter((m) => m.sender === "tester" && !m.readAt).length,
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  // Fil ouvert : celui demandé (?fil=), sinon le plus récent.
  const openThread =
    (typeof fil === "string" && threadList.find((t) => t.tester.userId === fil)) ||
    threadList.find((t) => t.messages.length > 0) ||
    null;

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        <div>
          <Link href="/admin" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
            Retour à l&apos;admin
          </Link>
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] mt-2 text-ink">Beta testeurs</h1>
          <p className="mt-1.5 text-sm text-muted">
            Rapports à envoyer 7, 14 et 30 jours après l&apos;inscription. Rappels J-2 et suspensions : tâche
            quotidienne de 7 h 30 (UTC).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="ui-card-soft p-5">
            <p className="text-[13px] text-muted">Testeurs actifs</p>
            <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">
              {active.length}
              <span className="text-base font-medium text-muted"> / {BETA_MAX_TESTERS}</span>
            </p>
          </div>
          <div className="ui-card-soft p-5">
            <p className="text-[13px] text-muted">Suspendus ou retirés</p>
            <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">
              {testers.length - active.length}
            </p>
          </div>
          <div className="ui-card-soft p-5">
            <p className="text-[13px] text-muted">Rapports reçus</p>
            <p className="text-[30px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">{submittedCount}</p>
          </div>
        </div>

        {/* Notifications : rapports soumis, en retard, suspensions (30 derniers jours) */}
        <section aria-labelledby="beta-activite" className="space-y-3">
          <h2 id="beta-activite" className="ui-title-sm">
            Activité récente
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Rien de nouveau sur les 30 derniers jours.</p>
          ) : (
            <ul className="ui-card divide-y divide-line-soft">
              {activity.map((event, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span aria-hidden="true">{ACTIVITY[event.kind].icon}</span>
                  <span className="font-medium text-ink">{event.email}</span>
                  <span className={event.kind === "soumis" ? "text-muted" : "text-red-700"}>
                    {ACTIVITY[event.kind].label(event)}
                  </span>
                  <span className="ml-auto text-xs text-muted">{date.format(new Date(event.date))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="beta-liste" className="space-y-3">
          <h2 id="beta-liste" className="ui-title-sm">
            Tous les beta testeurs
          </h2>
          {testers.length === 0 ? (
            <p className="text-sm text-muted">Aucun beta testeur pour l&apos;instant.</p>
          ) : (
            <div className="ui-card overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line">
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
                <tbody className="divide-y divide-line-soft">
                  {testers.map((t) => (
                    <tr key={t.userId}>
                      <td className={`${td} break-all`}>
                        {t.email}
                        {t.submittedCount > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium text-accent">Voir les réponses</summary>
                            <div className="mt-2 space-y-3">
                              {t.reports
                                .filter((r) => r.answers)
                                .map((r) => (
                                  <dl key={r.number} className="space-y-1 rounded-block bg-surface p-2 text-xs">
                                    <p className="font-semibold text-ink">Rapport {r.number}</p>
                                    {BETA_REPORTS[r.number - 1].fields.map((field) => (
                                      <div key={field.name}>
                                        <dt className="text-muted">{field.label}</dt>
                                        <dd className="whitespace-pre-line text-ink">
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
                          <span className="block text-xs text-muted">avant le {shortDate.format(new Date(r.deadline))}</span>
                          <span className={`text-xs ${REPORT_STYLES[r.status]}`}>
                            {BETA_REPORT_STATUS_LABELS[r.status]}
                            {r.submittedAt ? ` le ${shortDate.format(new Date(r.submittedAt))}` : ""}
                          </span>
                        </td>
                      ))}
                      <td className={`${td} space-y-1.5`}>
                        <div className="flex gap-1.5">
                          <Link
                            href={`/admin/beta?fil=${t.userId}#messages`}
                            scroll={false}
                            className="ui-btn-secondary whitespace-nowrap"
                          >
                            Messages
                          </Link>
                          <Link
                            href={`/admin/beta?a=${t.userId}#email`}
                            scroll={false}
                            className="ui-btn-secondary whitespace-nowrap"
                          >
                            Email
                          </Link>
                        </div>
                        {t.status === "suspended" && <ReactivateBetaButton userId={t.userId} email={t.email} />}
                        {t.status !== "removed" && <RemoveBetaButton userId={t.userId} email={t.email} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Messagerie interne (s'ajoute aux emails) */}
        <section id="messages" aria-labelledby="beta-messages-title" className="scroll-mt-22 space-y-3">
          <h2 id="beta-messages-title" className="ui-title-sm">
            Messages
          </h2>
          {!threads ? (
            <p className="ui-notice px-4 py-3 text-sm">
              La messagerie n&apos;est pas encore disponible : applique la migration 0018 (table beta_messages) dans
              Supabase.
            </p>
          ) : testers.length === 0 ? (
            <p className="text-sm text-muted">Aucun beta testeur pour l&apos;instant.</p>
          ) : (
            <>
              <div className="ui-card p-5 sm:p-7">
                <BroadcastMessageForm activeCount={active.length} />
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <nav aria-label="Fils de discussion" className="ui-card divide-y divide-line-soft self-start overflow-hidden">
                  {threadList.map(({ tester, messages, lastAt, unread }) => {
                    const selected = openThread?.tester.userId === tester.userId;
                    return (
                      <Link
                        key={tester.userId}
                        href={`/admin/beta?fil=${tester.userId}#messages`}
                        scroll={false}
                        aria-current={selected ? "true" : undefined}
                        className={`flex items-center gap-2 px-4 py-3 text-sm ${selected ? "bg-pill" : "hover:bg-surface"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${unread ? "font-semibold text-ink" : "text-ink"}`}>
                            {tester.email}
                          </span>
                          <span className="block text-xs text-muted">
                            {lastAt
                              ? `${messages.length} message${messages.length > 1 ? "s" : ""} · ${shortDate.format(new Date(lastAt))}`
                              : "Aucun message"}
                          </span>
                        </span>
                        {unread > 0 && (
                          <span className="ui-btn-danger">
                            {unread}
                            <span className="sr-only"> non lu{unread > 1 ? "s" : ""}</span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
                <div className="ui-card p-5 sm:p-7">
                  {openThread ? (
                    <>
                      <h3 className="mb-3 text-sm font-medium text-ink">{openThread.tester.email}</h3>
                      <AdminThread
                        key={openThread.tester.userId}
                        testerId={openThread.tester.userId}
                        email={openThread.tester.email}
                        messages={openThread.messages}
                      />
                    </>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted">Choisis un beta testeur pour lui écrire.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <section id="email" aria-labelledby="beta-email-title" className="scroll-mt-22 space-y-3">
          <h2 id="beta-email-title" className="ui-title-sm">
            Envoyer un email
          </h2>
          {isEmailConfigured() ? (
            <div className="ui-card p-5 sm:p-7">
              <BetaMessageForm
                key={target}
                initialTarget={target}
                testers={testers.map((t) => ({ userId: t.userId, email: t.email, active: t.status === "active" }))}
              />
            </div>
          ) : (
            <p className="ui-notice px-4 py-3 text-sm">
              L&apos;envoi d&apos;emails n&apos;est pas configuré (BREVO_API_KEY, BREVO_SENDER_EMAIL).
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
