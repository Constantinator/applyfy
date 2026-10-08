import Link from "next/link";
import { notFound } from "next/navigation";

import { CoverLetterGenerator } from "@/components/application/cover-letter-generator";
import { ContactEditor } from "@/components/application/contact-editor";
import { CvAdapter } from "@/components/application/cv-adapter";
import { NotesPad } from "@/components/application/notes-pad";
import { OfferDescriptionCompleter } from "@/components/application/offer-description-completer";
import { DeleteApplicationButton } from "@/components/application/delete-application-button";
import { FollowUpBox } from "@/components/application/follow-up-box";
import { StatusChanger } from "@/components/application/status-changer";
import { Timeline } from "@/components/application/timeline";
import { CollapsibleBox } from "@/components/collapsible-box";
import { FormattedText } from "@/components/formatted-text";
import { IconSparkles } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { MarkAsSent } from "@/components/application/mark-as-sent";
import {
  buildFollowUpMessage,
  getApplicationDetail,
  needsFollowUp,
  today,
} from "@/lib/applications";
import { getAccountName } from "@/lib/account";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";
import { fullName } from "@/lib/person-name";
import { readCvSuggestions } from "@/lib/cv-types";
import { getLatestProfileCvHtml, listProfileCvs } from "@/lib/profile";

// Analyse de CV, ouverture du CV dans l'éditeur et lettre (Server Actions de cette page) : 30 à 90 s.
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
    <section className={`card p-5 ${className}`}>
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
  const [detail, profileCvs, accountName, usage, latestProfileCvHtml] = await Promise.all([
    getApplicationDetail(id),
    // Non bloquant : la fiche reste affichée même si le profil est indisponible
    // (ex. migration 0007 pas encore appliquée).
    listProfileCvs().catch((error) => {
      console.error("[fiche] CV du profil", error);
      return [];
    }),
    // Non bloquant : sans nom, la lettre reprend celui du CV.
    getAccountName().catch((error) => {
      console.error("[fiche] nom du compte", error);
      return null;
    }),
    readAiUsage(),
    // Sans échec (null si indisponible) : CV du profil déjà importé, utilisable pour la lettre.
    getLatestProfileCvHtml(),
  ]);
  if (!detail) notFound();

  const { application: app, events, source } = detail;
  // « S'aider du CV en cours » (lettre) : le chat reçoit le CV de la candidature, à défaut
  // le dernier CV du profil importé dans l'éditeur.
  const hasCvForLetter = Boolean(app.cv_improved_html || latestProfileCvHtml);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
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
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{app.company}</h1>
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
                <dd className="mt-0.5 min-w-0 font-medium text-slate-900">
                  <ContactEditor
                    applicationId={app.id}
                    initialName={app.contact_name}
                    initialEmail={app.contact_email}
                  />
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
                      className="font-medium text-blue-600 hover:text-blue-500"
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
          {/* Résumé IA : la version lisible de l'offre, mise en avant au-dessus du texte brut. */}
          {app.offer_summary && (
            <section
              aria-labelledby="summary-title"
              className="bg-brand rounded-2xl p-[1.5px] shadow-md shadow-blue-500/10"
            >
              <div className="rounded-[calc(1rem-1.5px)] bg-white p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="bg-brand flex h-9 w-9 items-center justify-center rounded-xl text-white">
                    <IconSparkles className="h-5 w-5" />
                  </span>
                  <h2 id="summary-title" className="text-lg font-semibold text-slate-900">
                    Résumé de l&apos;offre
                  </h2>
                </div>
                <FormattedText text={app.offer_summary} />
              </div>
            </section>
          )}

          <section aria-labelledby="description-title" className="card p-5">
            <div className="mb-4">
              <h2 id="description-title" className="font-semibold text-slate-900">
                {app.offer_summary ? "Description complète" : "Description de l'offre"}
              </h2>
              {app.offer_summary && (
                <p className="mt-0.5 text-xs text-slate-500">Texte de l&apos;annonce, tel qu&apos;importé.</p>
              )}
            </div>
            {/* Extrait seulement (site d'origine bloqué) : l'utilisateur peut coller l'offre complète. */}
            {app.offer_description_partial && (
              <OfferDescriptionCompleter applicationId={app.id} offerUrl={app.offer_url} />
            )}
            {app.offer_description ? (
              <CollapsibleBox label="Description de l'offre">
                <FormattedText text={app.offer_description} className="text-slate-600" />
              </CollapsibleBox>
            ) : (
              <p className="text-sm text-slate-500">Aucune description enregistrée.</p>
            )}
          </section>

          <CvAdapter
            applicationId={app.id}
            hasOfferDescription={Boolean(app.offer_description)}
            aiEnabled={isClaudeConfigured()}
            saved={readCvSuggestions(app.cv_suggestions)}
            savedAt={app.cv_suggestions_at ?? null}
            profileCvs={profileCvs}
            hasImprovedCv={Boolean(app.cv_improved_html)}
            usage={usage.counts.adaptation_cv}
            editorUsage={usage.counts.cv_ameliore}
            resetLabel={formatResetDate(usage.resetsOn)}
          />

          <CoverLetterGenerator
            applicationId={app.id}
            hasOfferDescription={Boolean(app.offer_description)}
            aiEnabled={isClaudeConfigured()}
            profileCvs={profileCvs}
            hasLetter={Boolean(app.cover_letter_html)}
            hasCv={hasCvForLetter}
            letterSavedAt={app.cover_letter_at ?? null}
            signerName={accountName ? fullName(accountName) : null}
            usage={usage.counts.lettre}
            resetLabel={formatResetDate(usage.resetsOn)}
          />

          <FollowUpBox
            applicationId={app.id}
            defaultMessage={buildFollowUpMessage(app, accountName ? fullName(accountName) : null)}
            contactEmail={app.contact_email}
            subject={`Relance — candidature ${app.position}`}
            highlight={needsFollowUp(app)}
          />
        </div>

        <Card title="Historique" className="h-fit lg:sticky lg:top-6">
          <Timeline events={events} />
        </Card>
      </div>

      <NotesPad applicationId={app.id} initialNotes={app.notes ?? ""} />

      <section aria-label="Supprimer la candidature" className="flex justify-end border-t border-slate-200 pt-6">
        <DeleteApplicationButton applicationId={app.id} company={app.company} />
      </section>
    </main>
  );
}
