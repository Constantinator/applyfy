// Gabarit commun des emails, design « noir + bleu » : mise en page en tableaux, styles en
// ligne, police système, aucune ombre ni dégradé, pas de flex/grid (clients mail).
// Mode sombre : aucune règle dédiée. Les couleurs restent lisibles si le client les inverse
// (bouton noir/blanc, liens #2563EB) et le logo garde sa plaque blanche arrondie.
// Sans import : réutilisable tel quel par les tests (node --test).

/** Logo « A » en chevron noir et point bleu (copie de src/app/icon.png), en PNG hébergé. */
export const EMAIL_LOGO_URL = "https://www.applyfy.fr/images/email/applyfy-mark.png";

export const SIGNATURE = "Constantin, fondateur d'Applyfy";

const INK = "#0A0A0A";
const MUTED = "#6B6B6B";
const LINE = "#ECECEC";
const LINK = "#2563EB";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Paragraphe (HTML déjà échappé). `muted` : texte secondaire plus petit. */
export function emailParagraph(html: string, { muted = false } = {}) {
  const size = muted ? "font-size:14px;line-height:1.5;" : "font-size:16px;line-height:1.6;";
  return `<tr><td style="padding:0 0 16px 0;font-family:${FONT};${size}color:${muted ? MUTED : INK};">${html}</td></tr>`;
}

/** Bouton en pilule, noir et texte blanc, 44 px de haut (14 + 16 + 14). Outlook : coins carrés. */
export function emailButton(label: string, url: string) {
  return `<tr><td style="padding:8px 0 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;">
                <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;line-height:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
              </td>
            </tr></table>
          </td></tr>`;
}

/** Signature du fondateur, en fin de carte. */
export function emailSignature() {
  return `<tr><td style="padding:8px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(SIGNATURE)}</td></tr>`;
}

/** Lien dans le texte (désinscription, etc.). */
export function emailLink(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="color:${LINK};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/**
 * Page complète : logo, carte (rayon 24 px, bordure #ECECEC) contenant `rows`, puis pied de page.
 * `label` s'ajoute au nom (« Applyfy · Beta ») ; `footer` est du HTML déjà échappé.
 */
export function renderEmail({ title, rows, footer, label }: { title: string; rows: string[]; footer: string; label?: string }) {
  const brand = label ? `Applyfy <span style="font-weight:normal;color:${MUTED};">· ${escapeHtml(label)}</span>` : "Applyfy";
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#FFFFFF;color:${INK};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr><td style="padding:0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle"><img src="${EMAIL_LOGO_URL}" width="40" height="40" alt="Applyfy" style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;"></td>
              <td valign="middle" style="padding:0 0 0 10px;font-family:${FONT};font-size:20px;line-height:24px;font-weight:bold;color:${INK};">${brand}</td>
            </tr></table>
          </td></tr>
          <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${LINE};border-radius:24px;padding:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rows.join("\n          ")}
            </table>
          </td></tr>
          <tr><td style="padding:20px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">
            ${footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Le message se termine déjà par une signature : « Constantin », « L'équipe Applyfy »,
 * une ligne « -- » / « — », ou une formule de politesse suivie d'un nom court.
 */
export function endsWithSignature(message: string) {
  const lines = message.trim().split(/\n/).map((line) => line.trim()).filter(Boolean);
  const tail = lines.slice(-3);
  if (tail.some((line) => /\bconstantin\b|l['’]équipe applyfy/i.test(line))) return true;
  if (tail.some((line) => /^(?:--|—|–)(?:\s|$)/.test(line))) return true;
  const signOff = /^(?:cordialement|bien à (?:toi|vous)|à (?:très )?bientôt|merci(?: encore)?|bises|belle journée|bonne journée)\b/i;
  const before = lines.at(-2) ?? "";
  return signOff.test(before) && (lines.at(-1) ?? "").length <= 40;
}
