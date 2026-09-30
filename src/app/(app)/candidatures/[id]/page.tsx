import Link from "next/link";
import { notFound } from "next/navigation";

import { CvAdapter } from "@/components/application/cv-adapter";
import { DeleteApplicationButton } from "@/components/application/delete-application-button";
import { DocumentsList } from "@/components/application/documents-list";
import { FollowUpBox } from "@/components/application/follow-up-box";
import { StatusChanger } from "@/components/application/status-changer";
import { Timeline } from "@/components/application/timeline";
import { FormattedText } from "@/components/formatted-text";
import { StatusBadge } from "@/components/status-badge";
import { MarkAsSent } from "@/components/application/mark-as-sent";
import {
  buildFollowUpMessage,
  getApplicationDetail,
  needsFollowUp,
  today,
} from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { readCvSuggestions } from "@/lib/cv-types";
import { listProfileCvs } from "@/lib/profile";

// Analyse de CV et génération du CV amélioré (Server Actions de cette page) : 30 à 90 s.
export const maxDuration = 120;

// Date sans heure (YYYY-MM-DD) : formatée en UTC pour ne pas dépendre du fuseau du serveur.
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string | null) {
  return date ? dateFormatter.format(new Date(date)) : "Pas encore envoyée";
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <h2 className="mb-4 font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function ApplicationPage({
  params,
  searchParams,
}: PageProps<"/candidatures/[id]">) {
  const { id } = await params;
  const { creee } = await searchParams;
  const [detail, profileCvs] = await Promise.all([
    getApplicationDetail(id),
    // Non bloquant : la fiche reste affichée même si le profil est indisponible
    // (ex. migration 0007 pas encore appliquée).
    listProfileCvs().catch((error) => {
      console.error("[fiche] CV du profil", error);
      return [];
    }),
  ]);
  if (!detail) notFound();

  const { application: app, events, documents, source } = detail;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      {source === "demo" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Mode démo : tes modifications sont gardées en mémoire jusqu&apos;au redémarrage du
          serveur.
        </p>
      )}

      {creee === "1" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
        >
          ✓ Candidature créée en brouillon.
        </p>
      )}

      {/* En-tête */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{app.company}</h1>
              <StatusBadge status={app.status} />
            </div>
            <p className="mt-1 text-slate-600">
              {app.position}
              {app.location && <span className="text-slate-400"> · {app.location}</span>}
            </p>

            <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Date d&apos;envoi</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{formatDate(app.applied_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Contact</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {app.contact_name ?? "—"}
                  {app.contact_email && (
                    <a
                      href={`mailto:${app.contact_email}`}
                      className="block truncate font-normal text-indigo-600 hover:text-indigo-500"
                    >
                      {app.contact_email}
                    </a>
                  )}
                </dd>
              </div>
              {app.offer_url && (
                <div>
                  <dt className="text-slate-500">Annonce</dt>
                  <dd className="mt-0.5">
                    <a
                      href={app.offer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Voir l&apos;offre ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="w-full lg:w-80 lg:shrink-0">
            <StatusChanger applicationId={app.id} currentStatus={app.status} />
          </div>
        </div>
      </section>

      {app.status === "brouillon" && <MarkAsSent applicationId={app.id} today={today()} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {app.offer_summary && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <h2 className="mb-4 font-semibold text-slate-900">
                <span aria-hidden="true">✨ </span>Résumé de l&apos;offre
              </h2>
              <FormattedText text={app.offer_summary} />
            </section>
          )}

          <Card title="Description de l'offre">
            {app.offer_description ? (
              <FormattedText text={app.offer_description} className="max-h-[32rem] overflow-y-auto pr-2" />
            ) : (
              <p className="text-sm text-slate-500">Aucune description enregistrée.</p>
            )}
          </Card>

          <Card title="Documents">
            <DocumentsList documents={documents} />
          </Card>

          <CvAdapter
            applicationId={app.id}
            hasOfferDescription={Boolean(app.offer_description)}
            aiEnabled={isClaudeConfigured()}
            saved={readCvSuggestions(app.cv_suggestions)}
            savedAt={app.cv_suggestions_at ?? null}
            profileCvs={profileCvs}
            hasImprovedCv={Boolean(app.cv_improved_html)}
          />

          <FollowUpBox
            applicationId={app.id}
            defaultMessage={buildFollowUpMessage(app)}
            contactEmail={app.contact_email}
            subject={`Relance — candidature ${app.position}`}
            highlight={needsFollowUp(app)}
          />
        </div>

        <Card title="Historique" className="h-fit lg:sticky lg:top-6">
          <Timeline events={events} />
        </Card>
      </div>

      <section
        aria-label="Supprimer la candidature"
        className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-slate-500">
          Cette candidature n&apos;est plus d&apos;actualité ? Tu peux la supprimer définitivement.
        </p>
        <DeleteApplicationButton applicationId={app.id} company={app.company} />
      </section>
    </main>
  );
}
