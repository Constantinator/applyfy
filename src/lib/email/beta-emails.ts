// Emails du programme beta : rappel avant une date limite, suspension, message de l'équipe.
// Gabarit commun : layout.ts.
import type { EmailMessage } from "./brevo";
import {
  SIGNATURE,
  emailButton,
  emailLink,
  emailParagraph,
  emailSignature,
  endsWithSignature,
  escapeHtml,
  renderEmail,
} from "./layout";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./unsubscribe-token";

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(date);

const FOOTER = "Tu reçois cet email car tu participes au programme beta d'Applyfy.";

/**
 * Gabarit beta : paragraphes (texte brut, échappé), bouton et signature facultatifs.
 * `unsubscribeLink` : message libre seulement (rappel et suspension sont des e-mails de service).
 */
function layout({
  title,
  paragraphs,
  button,
  signed = true,
  unsubscribeLink,
}: {
  title: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  signed?: boolean;
  unsubscribeLink?: string;
}) {
  return renderEmail({
    title,
    label: "Beta",
    rows: [
      ...paragraphs.map((p) => emailParagraph(escapeHtml(p).replace(/\n/g, "<br>"))),
      ...(button ? [emailButton(button.label, button.url)] : []),
      ...(signed ? [emailSignature()] : []),
    ],
    footer: unsubscribeLink
      ? `${escapeHtml(FOOTER)} ${emailLink("Se désinscrire des emails", unsubscribeLink)}`
      : escapeHtml(FOOTER),
  });
}

export function buildBetaReminderEmail(input: {
  to: string;
  reportTitle: string;
  period: string;
  deadline: Date;
  reportsUrl: string;
}): EmailMessage {
  const subject = `Rappel : ton ${input.reportTitle.toLowerCase()} beta est attendu dans 2 jours`;
  const paragraphs = [
    `Petit rappel : ton ${input.reportTitle.toLowerCase()} beta (${input.period.toLowerCase()}) est à envoyer avant le ${dateLabel(input.deadline)}.`,
    "Il ne prend que quelques minutes, et sans lui ton accès Premium beta sera suspendu automatiquement.",
  ];
  return {
    to: input.to,
    subject,
    html: layout({ title: subject, paragraphs, button: { label: "Envoyer mon rapport", url: input.reportsUrl } }),
    text: `${paragraphs.join("\n\n")}\n\nEnvoyer mon rapport : ${input.reportsUrl}\n\n${SIGNATURE}`,
  };
}

export function buildBetaSuspensionEmail(input: { to: string; reportTitle: string; period: string }): EmailMessage {
  const subject = "Ton accès beta Applyfy est suspendu";
  const paragraphs = [
    `Ton ${input.reportTitle.toLowerCase()} beta (${input.period.toLowerCase()}) n'a pas été envoyé avant sa date limite.`,
    "Comme prévu dans les conditions du programme, ton accès beta et le Premium offert sont suspendus. Ton compte et tes données restent intacts : tu repasses simplement au plan gratuit.",
    "Si tu penses qu'il s'agit d'une erreur, réponds simplement à cet email.",
  ];
  return {
    to: input.to,
    subject,
    html: layout({ title: subject, paragraphs }),
    text: `${paragraphs.join("\n\n")}\n\n${SIGNATURE}`,
  };
}

/**
 * Message libre de l'équipe (tableau de bord admin), texte brut échappé. Signé s'il ne l'est pas
 * déjà. Avec lien de désinscription (HTML, texte, en-têtes one-click) : ce n'est pas un e-mail de service.
 */
export function buildBetaMessageEmail(input: { to: string; subject: string; message: string; userId: string }): EmailMessage {
  const signed = !endsWithSignature(input.message);
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const body = signed ? `${input.message.trimEnd()}\n\n${SIGNATURE}` : input.message.trimEnd();
  return {
    to: input.to,
    subject: input.subject,
    html: layout({ title: input.subject, paragraphs: input.message.split(/\n{2,}/), signed, unsubscribeLink }),
    text: `${body}\n\n—\n${FOOTER} Se désinscrire des emails : ${unsubscribeLink}`,
    unsubscribeUrl: oneClickUnsubscribeUrl(input.userId),
  };
}
