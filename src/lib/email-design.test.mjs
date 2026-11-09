// Design « noir + bleu » des emails (src/lib/email). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { EMAIL_LOGO_URL, emailButton, endsWithSignature, renderEmail } from "./email/layout.ts";

const TEMPLATES = ["welcome-email.ts", "activation-email.ts", "reminder-email.ts", "beta-emails.ts"];
const FILES = ["layout.ts", ...TEMPLATES];
const source = (name) => readFileSync(new URL(`./email/${name}`, import.meta.url), "utf8");
const page = renderEmail({ title: "Test", rows: [emailButton("Ouvrir", "https://example.com")], footer: "Pied" });

test("emails : plus aucune ancienne couleur", () => {
  const old = /#1e40af|#0f172a|#64748b|#e2e8f0|#f8fafc/i;
  assert.deepEqual(FILES.filter((name) => old.test(source(name))), []);
});

test("emails : pas de CSS moderne, d'ombre, de dégradé ni de police web", () => {
  const banned = /display:\s*(?:flex|grid)|box-shadow|gradient|@import|@font-face|fonts\.googleapis|<link\b/i;
  assert.deepEqual(FILES.filter((name) => banned.test(source(name))), []);
});

test("emails : tous les gabarits passent par le gabarit commun et sont signés", () => {
  for (const name of TEMPLATES) {
    assert.match(source(name), /renderEmail\(|layout\(\{/, name);
    assert.doesNotMatch(source(name), /<!doctype|<table/i, name);
    assert.match(source(name), /emailSignature\(\)/, name);
    assert.match(source(name), /SIGNATURE/, `${name} : signature dans le texte brut`);
  }
});

test("gabarit : fond blanc, carte de 560 px, rayon 24 px, bordure #ECECEC, tableaux", () => {
  assert.match(page, /<body style="[^"]*background:#FFFFFF;/);
  assert.match(page, /max-width:560px/);
  assert.match(page, /border:1px solid #ECECEC;border-radius:24px;/);
  assert.match(page, /role="presentation"/);
});

test("gabarit : logo PNG hébergé en production, avec texte alternatif", () => {
  assert.equal(EMAIL_LOGO_URL, "https://www.applyfy.fr/images/email/applyfy-mark.png");
  assert.match(page, new RegExp(`<img src="${EMAIL_LOGO_URL}"[^>]* alt="Applyfy"`));
  const logo = readFileSync(new URL("../../public/images/email/applyfy-mark.png", import.meta.url));
  assert.ok(logo.equals(readFileSync(new URL("../app/icon.png", import.meta.url))), "même logo que src/app/icon.png");
});

test("bouton : pilule noire, texte blanc, 44 px de haut", () => {
  const button = emailButton("Ouvrir", "https://example.com");
  assert.match(button, /bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:999px;"/);
  assert.match(button, /padding:14px 28px;[^"]*line-height:16px;[^"]*color:#FFFFFF;/);
});

test("relance : nombre de jours réel, accordé, objet sans emoji, ton encourageant", () => {
  const reminder = source("reminder-email.ts");
  assert.match(reminder, /`\$\{daysSinceApplied\} jour\$\{daysSinceApplied > 1 \? "s" : ""\}`/);
  assert.doesNotMatch(reminder, /Ça fait \d/);
  assert.match(reminder, /Un petit message peut tout changer\./);
  assert.doesNotMatch(reminder, /\p{Extended_Pictographic}/u);
});

test("message libre : signature ajoutée seulement si le texte n'est pas déjà signé", () => {
  assert.equal(endsWithSignature("Salut,\n\nMerci pour ton retour."), false);
  assert.equal(endsWithSignature("Merci pour ton retour.\n\nConstantin"), true);
  assert.equal(endsWithSignature("Merci.\n\nL'équipe Applyfy"), true);
  assert.equal(endsWithSignature("Merci.\n\n--\nC."), true);
  assert.equal(endsWithSignature("Voici le point.\n\nÀ bientôt,\nC. V."), true);
});
