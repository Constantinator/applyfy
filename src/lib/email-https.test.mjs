// Aucune URL d'e-mail en http:// (sauf localhost en développement). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { EMAIL_LOGO_URL, emailButton, emailLink, renderEmail } from "./email/layout.ts";
import { normalizeAppUrl } from "./url-scheme.ts";

const source = (path) => readFileSync(new URL(`./${path}`, import.meta.url), "utf8");

test("appUrl : https forcé ou ajouté pour tout domaine autre que localhost", () => {
  assert.equal(normalizeAppUrl("http://www.applyfy.fr"), "https://www.applyfy.fr");
  assert.equal(normalizeAppUrl("www.applyfy.fr"), "https://www.applyfy.fr");
  assert.equal(normalizeAppUrl("applyfy.fr/"), "https://applyfy.fr");
  assert.equal(normalizeAppUrl(" HTTP://www.applyfy.fr// "), "https://www.applyfy.fr");
  assert.equal(normalizeAppUrl("https://www.applyfy.fr/"), "https://www.applyfy.fr");
  // Un domaine qui commence par « localhost » n'est pas local.
  assert.equal(normalizeAppUrl("http://localhost.evil.fr"), "https://localhost.evil.fr");
  assert.equal(normalizeAppUrl("http://localhost:3000"), "http://localhost:3000");
  assert.equal(normalizeAppUrl("localhost:3000"), "http://localhost:3000");
  assert.equal(normalizeAppUrl("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
});

test("appUrl : APP_URL et VERCEL_PROJECT_PRODUCTION_URL passent par la normalisation", () => {
  const code = source("app-url.ts");
  assert.match(code, /return normalizeAppUrl\(process\.env\.APP_URL\);/);
  assert.match(code, /return normalizeAppUrl\(process\.env\.VERCEL_PROJECT_PRODUCTION_URL\);/);
  // Seul http:// autorisé : le repli localhost.
  assert.deepEqual(code.match(/http:\/\/[^"`\s]*/g), ["http://localhost:3000"]);
});

test("e-mails : aucune URL en http:// dans les gabarits ni dans le rendu", () => {
  for (const name of readdirSync(new URL("./email/", import.meta.url)).filter((f) => f.endsWith(".ts"))) {
    assert.doesNotMatch(source(`email/${name}`), /http:\/\//, name);
  }
  assert.match(EMAIL_LOGO_URL, /^https:\/\//);
  const html = renderEmail({
    title: "Test",
    rows: [emailButton("Ouvrir", `${normalizeAppUrl("www.applyfy.fr")}/dashboard`)],
    footer: emailLink("Se désinscrire", `${normalizeAppUrl("http://www.applyfy.fr")}/api/unsubscribe?token=t&uid=u`),
  });
  assert.doesNotMatch(html, /(?:href|src)="http:\/\//);
  assert.equal((html.match(/(?:href|src)="https:\/\//g) ?? []).length, 3);
});
