// Désinscription des e-mails : message libre, page honnête, en-têtes one-click, GET sans écriture,
// interrupteur du profil. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Corps d'une fonction (jusqu'à la première accolade fermante en début de ligne). */
const fn = (code, name) => new RegExp(`function ${name}\\b[\\s\\S]*?\\n\\}`).exec(code)?.[0] ?? "";

test("message libre : comptes désinscrits ignorés et comptés, lien de désinscription en HTML et en texte", () => {
  assert.match(source("lib/admin-metrics.ts"), /emailsUnsubscribed: isUnsubscribed\(u\.user_metadata\)/);
  const send = fn(source("lib/beta-admin.ts"), "sendBetaMessage");
  assert.match(send, /\.filter\(\(t\) => !t\.unsubscribed\)/);
  assert.match(send, /skipped = targeted\.length - recipients\.length/);
  assert.match(send, /buildBetaMessageEmail\(\{ to, subject, message, userId \}\)/);
  assert.match(source("app/actions/beta-admin.ts"), /ignoré\$\{skipped > 1 \? "s" : ""\} \(désinscrit/);

  const beta = source("lib/email/beta-emails.ts");
  const message = fn(beta, "buildBetaMessageEmail");
  assert.match(message, /html: layout\(\{[^\n]*, signed, unsubscribeLink \}\),/);
  assert.match(message, /text: `[^`]*Se désinscrire des emails : \$\{unsubscribeLink\}`/);
  assert.match(message, /unsubscribeUrl: oneClickUnsubscribeUrl\(input\.userId\)/);
  // Rappel et suspension : e-mails de service, sans lien ni en-tête.
  for (const name of ["buildBetaReminderEmail", "buildBetaSuspensionEmail"]) {
    assert.doesNotMatch(fn(beta, name), /unsubscribe/i, name);
  }
});

test("page de désinscription enregistrée : pas de promesse « plus aucun e-mail », e-mails de service mentionnés", () => {
  const page = source("app/unsubscribe/success/page.tsx");
  assert.doesNotMatch(page, /plus d'emails de notre part|plus aucun e-?mail/i);
  assert.match(page, /e-mails de service/);
  assert.match(page, /href="\/profil"/);
});

test("Brevo : en-têtes List-Unsubscribe et One-Click seulement pour bienvenue, activation, relance et message libre", () => {
  const brevo = source("lib/email/brevo.ts");
  assert.match(brevo, /headers: unsubscribeHeaders\(message\.unsubscribeUrl\)/);
  const headers = fn(brevo, "unsubscribeHeaders");
  assert.match(headers, /if \(!url\) return undefined;/);
  assert.match(headers, /"List-Unsubscribe": `<\$\{url\}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  for (const name of ["welcome-email", "activation-email", "reminder-email", "beta-emails"]) {
    assert.match(source(`lib/email/${name}.ts`), /unsubscribeUrl: oneClickUnsubscribeUrl\(input\.userId\)/, name);
  }
  // URL du one-click : /api/unsubscribe signée, jamais le repli /profil.
  const token = source("lib/email/unsubscribe-token.ts");
  assert.match(fn(token, "oneClickUnsubscribeUrl"), /if \(!isUnsubscribeConfigured\(\)\) return null;[\s\S]*\/api\/unsubscribe\?/);
});

test("/api/unsubscribe : le GET n'écrit rien, seul le POST désinscrit après vérification du jeton (365 jours)", () => {
  const route = source("app/api/unsubscribe/route.ts");
  const get = fn(route, "GET");
  assert.ok(get);
  assert.doesNotMatch(get, /updateUserById|unsubscribe\(|createAdminClient/);
  assert.match(get, /new URL\("\/unsubscribe", request\.url\)/);
  assert.match(fn(route, "POST"), /await unsubscribe\(/);
  const write = fn(route, "unsubscribe");
  assert.ok(write.indexOf("verifyUnsubscribeToken") >= 0 && write.indexOf("verifyUnsubscribeToken") < write.indexOf("updateUserById"));
  assert.match(source("lib/email/unsubscribe-token.ts"), /const MAX_AGE_DAYS = 365;/);

  const confirm = source("app/unsubscribe/page.tsx");
  assert.match(confirm, /<form method="post" action=\{action\}/);
  assert.match(confirm, /className="ui-btn-primary">\s*Confirmer ma désinscription/);
  assert.doesNotMatch(confirm, /updateUserById|createAdminClient/);
  // Accessible sans connexion.
  assert.doesNotMatch(/PROTECTED_PREFIXES = \[[^\]]*\]/.exec(source("proxy.ts"))?.[0] ?? "", /unsubscribe/);
});

test("profil : interrupteur dans les deux sens, compte connecté uniquement, cible de 44 px", () => {
  const action = fn(source("app/actions/profile.ts"), "setEmailsSubscribedAction");
  assert.match(action, /\{\n\s*await requireUser\(\);/);
  assert.match(source("lib/email-preferences.ts"), /emails_unsubscribed_at: subscribed \? null : new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(source("lib/email-preferences.ts"), /createAdminClient|service_role/);
  const toggle = source("components/profile/email-subscription-toggle.tsx");
  assert.match(toggle, /role="switch"/);
  assert.match(toggle, /aria-checked=\{on\}/);
  assert.match(toggle, /min-h-11/);
  assert.match(toggle, /on \? "bg-ink/);
  assert.match(source("app/(app)/profil/page.tsx"), /<EmailSubscriptionToggle initial=\{emailsSubscribed\} \/>/);
});
