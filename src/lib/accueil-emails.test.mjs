// E-mails de bienvenue et de relance J+2 selon le parcours d'accueil. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { ONBOARDING_LAUNCHED_AT, onboardingEmailVariant } = await import("./onboarding.ts");
const { activationEmailContent, welcomeEmailContent } = await import("./email/accueil-content.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const after = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) + 3_600_000).toISOString();
const before = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) - 3_600_000).toISOString();

test("variante : « en_cours » seulement pour un parcours qui concerne le compte et n'est pas fini", () => {
  const v = (input) => onboardingEmailVariant({ createdAt: after, metadataCompleted: false, progress: null, ...input });
  assert.equal(v({}), "en_cours", "parcours pas encore commencé");
  assert.equal(v({ progress: { completed: false } }), "en_cours", "parcours commencé");
  assert.equal(v({ progress: { completed: true } }), "fini", "parcours terminé (base)");
  assert.equal(v({ metadataCompleted: true }), "fini", "parcours terminé (marque du compte)");
  assert.equal(v({ progress: "illisible" }), "fini", "lecture impossible ou table absente : variante neutre");
  assert.equal(v({ createdAt: before }), "fini", "compte antérieur au parcours");
  assert.equal(v({ createdAt: null }), "fini");
});

test("bienvenue, parcours non fini : texte validé, bouton « Reprendre » vers /dashboard", () => {
  assert.deepEqual(welcomeEmailContent("en_cours", "Inès"), {
    subject: "Bienvenue sur Applyfy",
    paragraphs: [
      "Salut Inès, moi c'est Lumeo.",
      "Ton compte est prêt. Reprends où tu en étais : ton CV ou ta première offre, comme tu veux.",
    ],
    button: { label: "Reprendre", path: "/dashboard" },
    hint: null,
  });
  assert.equal(welcomeEmailContent("en_cours", null).paragraphs[0], "Salut, moi c'est Lumeo.");
});

test("bienvenue, parcours fini : texte actuel, sans promesse chiffrée", () => {
  assert.deepEqual(welcomeEmailContent("fini", "Inès"), {
    subject: "Bienvenue sur Applyfy",
    paragraphs: ["Salut Inès,", "Bienvenue sur Applyfy. Ajoute ta première candidature."],
    button: { label: "Ajouter ma première candidature", path: "/dashboard" },
    hint: "Colle juste l'URL de l'offre, Applyfy fait le reste.",
  });
  assert.equal(welcomeEmailContent("fini", null).paragraphs[0], "Salut,");
});

test("relance J+2 : « Reprendre » si le parcours n'est pas fini, « Ajouter une offre » sinon", () => {
  assert.deepEqual(activationEmailContent("en_cours", "Inès"), {
    subject: "Tu n'as pas encore ajouté ta première candidature",
    paragraphs: [
      "Salut Inès,",
      "Tu n'as pas fini de t'installer. Il reste une ou deux questions, puis on avance sur ton CV ou ta première offre.",
    ],
    button: { label: "Reprendre", path: "/dashboard" },
    hint: null,
  });
  assert.deepEqual(activationEmailContent("fini", null), {
    subject: "Tu n'as pas encore ajouté ta première candidature",
    paragraphs: ["Salut,", "Ta première candidature t'attend. Colle le lien d'une offre, je remplis la fiche pour toi."],
    button: { label: "Ajouter une offre", path: "/candidatures/nouvelle" },
    hint: null,
  });
});

test("textes : aucun chiffre ni durée en dur, tutoiement, sans emoji, ni « illimité » ni « sans limite »", () => {
  const all = ["en_cours", "fini"].flatMap((variant) =>
    [welcomeEmailContent, activationEmailContent].flatMap((build) => {
      const c = build(variant, null);
      return [c.subject, ...c.paragraphs, c.button.label, c.hint ?? ""];
    }),
  );
  const text = all.join("\n");
  assert.doesNotMatch(text, /\d/);
  assert.doesNotMatch(text, /seconde|minute|heure|instant/i);
  assert.doesNotMatch(text, /illimit|sans limite/i);
  assert.doesNotMatch(text, /\bvous\b|\bvotre\b|\bvos\b/i);
  assert.doesNotMatch(text, /\p{Extended_Pictographic}/u);
  for (const path of ["lib/email/welcome-email.ts", "lib/email/activation-email.ts", "lib/email/accueil-content.ts"]) {
    assert.doesNotMatch(read(path), /illimit|sans limite|moins d'une minute/i, path);
  }
});

test("gabarits : textes de la variante, lien de désinscription, signature", () => {
  for (const [path, builder] of [
    ["lib/email/welcome-email.ts", "welcomeEmailContent"],
    ["lib/email/activation-email.ts", "activationEmailContent"],
  ]) {
    const source = read(path);
    assert.match(source, new RegExp(`${builder}\\(input\\.variant, input\\.firstName\\)`), path);
    assert.match(source, /emailLink\("Se désinscrire des emails", unsubscribeLink\)/, path);
    assert.match(source, /Se désinscrire des emails : \$\{unsubscribeLink\}/, path);
    assert.match(source, /unsubscribeUrl: oneClickUnsubscribeUrl\(input\.userId\)/, path);
    assert.match(source, /emailSignature\(\)/, path);
  }
});

test("conditions d'envoi inchangées", () => {
  const welcome = read("lib/welcome-email.ts");
  assert.match(welcome, /const NEW_ACCOUNT_WINDOW_MS = 48 \* 3_600_000;/);
  assert.match(welcome, /typeof metadata\.welcome_email_sent_at === "string" \|\| isUnsubscribed\(metadata\)/);
  const job = read("lib/activation-job.ts");
  assert.match(job, /const MIN_AGE_MS = 47 \* HOUR_MS;/);
  assert.match(job, /const MAX_AGE_MS = 71 \* HOUR_MS;/);
  assert.match(job, /\.eq\("is_example", false\);/);
  assert.match(job, /if \(withApplications\.has\(user\.id\)\) continue;/);
  assert.match(job, /typeof user\.user_metadata\?\.activation_email_sent_at === "string"/);
});

test("table absente ou lecture impossible : variante « fini » (neutre), jamais d'échec de l'envoi", () => {
  const welcome = read("lib/welcome-email.ts");
  const own = welcome.slice(welcome.indexOf("async function readOwnProgress"));
  assert.match(own, /if \(error\) \{[\s\S]*?return "illisible";/);
  assert.match(own, /catch \(error\) \{[\s\S]*?return "illisible";/);
  const job = read("lib/activation-job.ts");
  const progress = job.slice(job.indexOf("async function readProgress"));
  assert.match(progress, /if \(error\) \{[\s\S]*?return "illisible";/);
  assert.match(progress, /catch \(error\) \{[\s\S]*?return "illisible";/);
  assert.match(job, /progress === "illisible" \? "illisible" : \(progress\.get\(user\.id\) \?\? null\)/);
});
