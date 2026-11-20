// Email de bienvenue, envoyé une fois à l'inscription. Gabarit commun : layout.ts ; textes selon
// l'état du parcours d'accueil : accueil-content.ts.
import { welcomeEmailContent, type OnboardingEmailVariant } from "./accueil-content";
import type { EmailMessage } from "./brevo";
import { SIGNATURE, emailButton, emailLink, emailParagraph, emailSignature, escapeHtml, renderEmail } from "./layout";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./unsubscribe-token";

export function buildWelcomeEmail(input: {
  to: string;
  firstName: string | null;
  /** Adresse du site (sans « / » final) : le bouton y ajoute sa page. */
  baseUrl: string;
  userId: string;
  variant: OnboardingEmailVariant;
}): EmailMessage {
  const content = welcomeEmailContent(input.variant, input.firstName);
  const buttonUrl = `${input.baseUrl}${content.button.path}`;
  const unsubscribeLink = unsubscribeUrl(input.userId);
  const { subject } = content;
  const footer = "Tu reçois cet email car tu viens de créer ton compte Applyfy.";

  const html = renderEmail({
    title: subject,
    rows: [
      ...content.paragraphs.map((paragraph) => emailParagraph(escapeHtml(paragraph))),
      emailButton(content.button.label, buttonUrl),
      ...(content.hint ? [emailParagraph(escapeHtml(content.hint), { muted: true })] : []),
      emailSignature(),
    ],
    footer: `${escapeHtml(footer)} ${emailLink("Se désinscrire des emails", unsubscribeLink)}`,
  });

  const text = [
    ...content.paragraphs,
    `${content.button.label} : ${buttonUrl}`,
    ...(content.hint ? [content.hint] : []),
    SIGNATURE,
    `—\n${footer} Se désinscrire des emails : ${unsubscribeLink}`,
  ].join("\n\n");

  return { to: input.to, subject, html, text, unsubscribeUrl: oneClickUnsubscribeUrl(input.userId) };
}
