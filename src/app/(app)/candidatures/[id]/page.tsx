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
import { getBuilderCvByApplication } from "@/lib/cv-builder";
import { getLatestProfileCvText, listProfileCvs } from "@/lib/profile";

// Lettre (Server Actions de cette page) : 30 à 90 s.
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
    <section className={`ui-card p-5 sm:p-7 ${className}`}>
      <h2 className="ui-title-sm mb-4">{title}</h2>
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
  const [detail, profileCvs, accountName, usage, latestProfileCvText, linkedCv] = await Promise.all([
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
    getLatestProfileCvText(),
    // Sans échec (null si indisponible) : CV du CV Builder lié à cette candidature.
    getBuilderCvByApplication(id),
  ]);
  if (!detail) notFound();

  const { application: app, events, source } = detail;
  // CV de l'éditeur pour cette candidature : celui du CV Builder, sinon celui de l'ancien éditeur.
  const hasEditorCv = Boolean(linkedCv || app.cv_improved_html);
  // « S'aider du CV en cours » (lettre) : le chat reçoit le CV de la candidature, à défaut
  // le dernier CV du profil importé dans l'éditeur.
  const hasCvForLetter = Boolean(hasEditorCv || latestProfileCvText);
  const toFollowUp = needsFollowUp(app);
  const followUpBox = (
    <FollowUpBox
      applicationId={app.id}
      defaultMessage={buildFollowUpMessage(app, accountName ? fullName(accountName) : null)}
      contactEmail={app.contact_email}
      subject={`Relance — candidature ${app.position}`}
      highlight={toFollowUp}
    />
  );

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-5">
        <Link href="/candidatures" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
          Retour aux candidatures
        </Link>

        {source === "demo" && (
          <p className="ui-notice px-4 py-2 text-sm">
            Mode démo : tes modifications sont gardées en mémoire jusqu&apos;au redémarrage du
            serveur.
          </p>
        )}

        {creee === "1" && (
          <p
            role="status"
            className="ui-notice px-4 py-2 text-sm"
          >
            ✓ Candidature créée en brouillon.
          </p>
        )}

        {/* En-tête */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] break-words text-ink dark:text-white">{app.company}</h1>
            <p className="mt-1.5 text-muted dark:text-slate-300">
              {app.position}
              {app.location && <span> · {app.location}</span>}
              {app.offer_url && (
                <>
                  {" · "}
                  <a href={app.offer_url} target="_blank" rel="noopener noreferrer" className="ui-link">
                    Voir l&apos;offre
                  </a>
                </>
              )}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* Sur mobile : statut et contact, puis le contenu, puis l'historique. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div className="order-2 min-w-0 space-y-5 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {app.status === "brouillon" && <MarkAsSent applicationId={app.id} today={today()} />}

            {toFollowUp && followUpBox}

            <CvAdapter applicationId={app.id} hasLinkedCv={Boolean(linkedCv)} />

            {/* Résumé IA : la version lisible de l'offre, au-dessus du texte brut. */}
            {app.offer_summary && (
              <section aria-labelledby="summary-title" className="ui-card p-5 sm:p-7">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200">
                    <IconSparkles className="h-5 w-5" />
                  </span>
                  <h2 id="summary-title" className="ui-title-sm">
                    Résumé de l&apos;offre
                  </h2>
                </div>
                <FormattedText text={app.offer_summary} />
              </section>
            )}

            <section aria-labelledby="description-title" className="ui-card p-5 sm:p-7">
              <div className="mb-4">
                <h2 id="description-title" className="ui-title-sm">
                  {app.offer_summary ? "Description complète" : "Description de l'offre"}
                </h2>
                {app.offer_summary && (
                  <p className="mt-0.5 text-[13px] text-muted dark:text-slate-400">Texte de l&apos;annonce, tel qu&apos;importé.</p>
                )}
              </div>
              {/* Extrait seulement (site d'origine bloqué) : l'utilisateur peut coller l'offre complète. */}
              {app.offer_description_partial && (
                <OfferDescriptionCompleter applicationId={app.id} offerUrl={app.offer_url} />
              )}
              {app.offer_description ? (
                <CollapsibleBox label="Description de l'offre">
                  <FormattedText text={app.offer_description} className="text-muted dark:text-slate-300" />
                </CollapsibleBox>
              ) : (
                <p className="text-sm text-muted dark:text-slate-400">Aucune description enregistrée.</p>
              )}
            </section>

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

            {!toFollowUp && followUpBox}

            <NotesPad applicationId={app.id} initialNotes={app.notes ?? ""} />
          </div>

          <div className="order-1 min-w-0 space-y-5 lg:order-none lg:col-start-2 lg:row-start-1">
            <Card title="Statut">
              <StatusChanger applicationId={app.id} currentStatus={app.status} />
              <dl className="mt-3 text-[13px]">
                <dt className="inline text-muted dark:text-slate-400">Date d&apos;envoi : </dt>
                <dd className="inline font-medium text-ink dark:text-white">{formatDate(app.applied_at)}</dd>
              </dl>
            </Card>
            <Card title="Contact">
              <div className="min-w-0 text-sm font-medium text-ink dark:text-white">
                <ContactEditor applicationId={app.id} initialName={app.contact_name} initialEmail={app.contact_email} />
              </div>
            </Card>
          </div>

          <div className="order-3 min-w-0 space-y-5 lg:order-none lg:col-start-2 lg:row-start-2">
            <Card title="Historique">
              <Timeline events={events} />
            </Card>
            <section aria-label="Supprimer la candidature">
              <DeleteApplicationButton applicationId={app.id} company={app.company} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
