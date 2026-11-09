// Email d'activation (J+2) : compte créé sans aucune candidature. Gabarit commun : layout.ts.
import type { EmailMessage } from "./brevo";
import { SIGNATURE, emailButton, emailLink, emailParagraph, emailSignature, escapeHtml, renderEmail } from "./layout";
import { unsubscribeUrl } from "./unsubscribe-token";

export function buildActivationEmail(input: {
  to: string;
  firstName: string | null;
  dashboardUrl: string;
  userId: string;
}): EmailMessage {
  const { firstName, dashboardUrl } = input;
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const subject = "Tu n'as pas encore ajouté ta première candidature";
  const greeting = firstName ? `Salut ${firstName},` : "Salut,";
  const intro =
    "Ton espace Applyfy est prêt, il ne manque plus que ta première candidature. Ensuite, tu suis tout au même endroit : statuts, relances, CV et lettres.";
  // Import par lien : jusqu'à ~33 s de délais cumulés (offer-import.ts), d'où « moins d'une minute ».
  const hint = "Colle juste l'URL de l'offre, Applyfy fait le reste. Ça prend moins d'une minute.";
  const button = "Ajouter ma première candidature";
  const footer = "Tu reçois cet email car tu as créé ton compte Applyfy.";

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

  return { to: input.to, subject, html, text };
}
