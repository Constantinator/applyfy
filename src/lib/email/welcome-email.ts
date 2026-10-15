// Email de bienvenue, envoyé une fois à l'inscription : sobre, compatible avec les clients mail (styles en ligne).
import type { EmailMessage } from "./brevo";
import { unsubscribeUrl } from "./unsubscribe-token";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWelcomeEmail(input: {
  to: string;
  firstName: string | null;
  dashboardUrl: string;
  userId: string;
}): EmailMessage {
  const { firstName, dashboardUrl } = input;
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const greeting = firstName ? `Salut ${firstName} !` : "Salut !";
  const intro = "Tu viens de rejoindre Applyfy. Maintenant, ajoute ta première candidature — ça prend 30 secondes.";
  const hint = "Colle juste l'URL de l'offre, Applyfy fait le reste.";
  const signature = "Constantin, fondateur d'Applyfy";
  const footer = "Tu reçois cet email car tu viens de créer ton compte Applyfy.";

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
          <tr><td style="font-size:16px;font-weight:bold;color:#1E40AF;padding-bottom:20px;">Applyfy</td></tr>
          <tr><td style="font-size:16px;line-height:1.6;padding-bottom:12px;">${escapeHtml(greeting)}</td></tr>
          <tr><td style="font-size:16px;line-height:1.6;padding-bottom:24px;">${escapeHtml(intro)}</td></tr>
          <tr><td style="padding-bottom:12px;">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#1E40AF;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">Ajouter ma première candidature</a>
          </td></tr>
          <tr><td style="font-size:14px;line-height:1.5;color:#64748b;padding-bottom:28px;">${escapeHtml(hint)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;padding-bottom:28px;">${escapeHtml(signature)}</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
            ${escapeHtml(footer)}
            <a href="${escapeHtml(unsubscribeLink)}" style="color:#64748b;">Se désinscrire des emails</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}\n\n${intro}\n\nAjouter ma première candidature : ${dashboardUrl}\n\n${hint}\n\n${signature}\n\n—\n${footer} Se désinscrire des emails : ${unsubscribeLink}`;

  return { to: input.to, subject: "Bienvenue sur Applyfy", html, text };
}
