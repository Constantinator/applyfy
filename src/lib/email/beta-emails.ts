// Emails du programme beta : rappel avant une date limite, suspension, message de l'équipe.
// Même présentation sobre que l'email de relance (styles en ligne).
import type { EmailMessage } from "./brevo";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(date);

/** Gabarit commun : paragraphes (texte brut, échappé) et bouton facultatif. */
function layout({ paragraphs, button }: { paragraphs: string[]; button?: { label: string; url: string } }) {
  const body = paragraphs
    .map(
      (p) =>
        `<tr><td style="font-size:16px;line-height:1.6;padding-bottom:16px;">${escapeHtml(p).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const cta = button
    ? `<tr><td style="padding:8px 0 28px;"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#1E40AF;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(button.label)}</a></td></tr>`
    : "";
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
          <tr><td style="font-size:16px;font-weight:bold;color:#1E40AF;padding-bottom:20px;">Applyfy · Beta</td></tr>
          ${body}
          ${cta}
          <tr><td style="font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
            Tu reçois cet email car tu participes au programme beta d'Applyfy.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function buildBetaReminderEmail(input: {
  to: string;
  reportTitle: string;
  period: string;
  deadline: Date;
  reportsUrl: string;
}): EmailMessage {
  const paragraphs = [
    `Petit rappel : ton ${input.reportTitle.toLowerCase()} beta (${input.period.toLowerCase()}) est à envoyer avant le ${dateLabel(input.deadline)}.`,
    "Il ne prend que quelques minutes, et sans lui ton accès Premium beta sera suspendu automatiquement.",
  ];
  return {
    to: input.to,
    subject: `Rappel : ton ${input.reportTitle.toLowerCase()} beta est attendu dans 2 jours`,
    html: layout({ paragraphs, button: { label: "Envoyer mon rapport", url: input.reportsUrl } }),
    text: `${paragraphs.join("\n\n")}\n\nEnvoyer mon rapport : ${input.reportsUrl}`,
  };
}

export function buildBetaSuspensionEmail(input: { to: string; reportTitle: string; period: string }): EmailMessage {
  const paragraphs = [
    `Ton ${input.reportTitle.toLowerCase()} beta (${input.period.toLowerCase()}) n'a pas été envoyé avant sa date limite.`,
    "Comme prévu dans les conditions du programme, ton accès beta et le Premium offert sont suspendus. Ton compte et tes données restent intacts : tu repasses simplement au plan gratuit.",
    "Si tu penses qu'il s'agit d'une erreur, réponds simplement à cet email.",
  ];
  return {
    to: input.to,
    subject: "Ton accès beta Applyfy est suspendu",
    html: layout({ paragraphs }),
    text: paragraphs.join("\n\n"),
  };
}

/** Message libre de l'équipe (tableau de bord admin), texte brut échappé. */
export function buildBetaMessageEmail(input: { to: string; subject: string; message: string }): EmailMessage {
  return {
    to: input.to,
    subject: input.subject,
    html: layout({ paragraphs: input.message.split(/\n{2,}/) }),
    text: input.message,
  };
}
