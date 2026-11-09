// Email de bienvenue, envoyé une fois à l'inscription. Gabarit commun : layout.ts.
import type { EmailMessage } from "./brevo";
import { SIGNATURE, emailButton, emailLink, emailParagraph, emailSignature, escapeHtml, renderEmail } from "./layout";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./unsubscribe-token";

export function buildWelcomeEmail(input: {
  to: string;
  firstName: string | null;
  dashboardUrl: string;
  userId: string;
}): EmailMessage {
  const { firstName, dashboardUrl } = input;
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const subject = "Bienvenue sur Applyfy";
  const greeting = firstName ? `Salut ${firstName},` : "Salut,";
  // Import par lien : jusqu'à ~33 s de délais cumulés (offer-import.ts), d'où « moins d'une minute ».
  const intro = "Bienvenue sur Applyfy. Ajoute ta première candidature, ça prend moins d'une minute.";
  const hint = "Colle juste l'URL de l'offre, Applyfy fait le reste.";
  const button = "Ajouter ma première candidature";
  const footer = "Tu reçois cet email car tu viens de créer ton compte Applyfy.";

  const html = renderEmail({
    title: subject,
    rows: [
      emailParagraph(escapeHtml(greeting)),
      emailParagraph(escapeHtml(intro)),
      emailButton(button, dashboardUrl),
      emailParagraph(escapeHtml(hint), { muted: true }),
      emailSignature(),
    ],
    footer: `${escapeHtml(footer)} ${emailLink("Se désinscrire des emails", unsubscribeLink)}`,
  });

  const text = `${greeting}\n\n${intro}\n\n${button} : ${dashboardUrl}\n\n${hint}\n\n${SIGNATURE}\n\n—\n${footer} Se désinscrire des emails : ${unsubscribeLink}`;

  return { to: input.to, subject, html, text, unsubscribeUrl: oneClickUnsubscribeUrl(input.userId) };
}
