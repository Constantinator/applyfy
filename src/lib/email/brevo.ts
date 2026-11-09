import "server-only";

// Envoi d'emails transactionnels via l'API Brevo (https://developers.brevo.com).
// Variables : BREVO_API_KEY (secrète), BREVO_SENDER_EMAIL (expéditeur vérifié dans Brevo),
// BREVO_SENDER_NAME (optionnel).

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * URL signée de /api/unsubscribe (POST one-click, RFC 8058) : ajoute les en-têtes
   * List-Unsubscribe et List-Unsubscribe-Post. Absente pour les e-mails de service.
   */
  unsubscribeUrl?: string | null;
};

/** En-têtes de désinscription en un clic (Gmail, Yahoo, Apple Mail). */
export function unsubscribeHeaders(url: string | null | undefined): Record<string, string> | undefined {
  if (!url) return undefined;
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export async function sendEmail(message: EmailMessage): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) throw new Error("Brevo n'est pas configuré (BREVO_API_KEY, BREVO_SENDER_EMAIL).");

  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || "Applyfy" },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      headers: unsubscribeHeaders(message.unsubscribeUrl),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo ${response.status} : ${detail.slice(0, 300)}`);
  }
  const data = (await response.json().catch(() => ({}))) as { messageId?: string };
  return { messageId: data.messageId ?? "" };
}
