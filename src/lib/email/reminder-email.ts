// Email de rappel de relance : encourageant, jamais culpabilisant. Gabarit commun : layout.ts.
import type { EmailMessage } from "./brevo";
import { SIGNATURE, emailButton, emailLink, emailParagraph, emailSignature, escapeHtml, renderEmail } from "./layout";
import { unsubscribeUrl } from "./unsubscribe-token";

export function buildReminderEmail(input: {
  to: string;
  company: string;
  position: string;
  daysSinceApplied: number;
  applicationUrl: string;
  userId: string;
}): EmailMessage {
  const { company, position, daysSinceApplied, applicationUrl } = input;
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const subject = `Il est temps de relancer ${company}`;
  // Nombre réel de jours depuis la candidature (reminder-job.ts), jamais écrit en dur.
  const days = `${daysSinceApplied} jour${daysSinceApplied > 1 ? "s" : ""}`;
  const nudge = "Un petit message peut tout changer.";
  const sentence = `Ça fait ${days} que tu as postulé chez ${company} pour le poste de ${position}. ${nudge}`;
  const button = "Voir ma candidature";
  const footer = "Tu reçois cet email car les rappels de relance sont activés.";

  const html = renderEmail({
    title: subject,
    rows: [
      emailParagraph(
        `Ça fait ${days} que tu as postulé chez <strong>${escapeHtml(company)}</strong> pour le poste de <strong>${escapeHtml(position)}</strong>. ${escapeHtml(nudge)}`,
      ),
      emailButton(button, applicationUrl),
      emailSignature(),
    ],
    footer: `${escapeHtml(footer)} ${emailLink("Se désinscrire des emails", unsubscribeLink)}`,
  });

  const text = `${sentence}\n\n${button} : ${applicationUrl}\n\n${SIGNATURE}\n\n—\n${footer} Se désinscrire des emails : ${unsubscribeLink}`;

  return { to: input.to, subject, html, text };
}
