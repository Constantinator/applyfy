// Email de rappel de relance : sobre, compatible avec les clients mail (styles en ligne).
import type { EmailMessage } from "./brevo";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReminderEmail(input: {
  to: string;
  company: string;
  position: string;
  daysSinceApplied: number;
  applicationUrl: string;
  settingsUrl: string;
}): EmailMessage {
  const { company, position, daysSinceApplied, applicationUrl, settingsUrl } = input;
  const days = `${daysSinceApplied} jour${daysSinceApplied > 1 ? "s" : ""}`;
  const sentence = `Tu as postulé chez ${company} pour le poste de ${position} il y a ${days}. C'est le bon moment pour relancer !`;

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
          <tr><td style="font-size:16px;font-weight:bold;color:#4f46e5;padding-bottom:20px;">Applyfy</td></tr>
          <tr><td style="font-size:16px;line-height:1.6;padding-bottom:24px;">
            Tu as postulé chez <strong>${escapeHtml(company)}</strong> pour le poste de
            <strong>${escapeHtml(position)}</strong> il y a ${days}. C'est le bon moment pour relancer !
          </td></tr>
          <tr><td style="padding-bottom:28px;">
            <a href="${escapeHtml(applicationUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">Voir ma candidature</a>
          </td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
            Tu reçois cet email car les rappels de relance sont activés.
            <a href="${escapeHtml(settingsUrl)}" style="color:#64748b;">Gérer mes rappels</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${sentence}\n\nVoir ma candidature : ${applicationUrl}\n\n—\nTu reçois cet email car les rappels de relance sont activés. Gérer mes rappels : ${settingsUrl}`;

  return { to: input.to, subject: `Il est temps de relancer ${company} 👋`, html, text };
}
