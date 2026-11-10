// Message de relance pré-écrit (lot 3b) : variantes selon le délai, salutation, titre, objet, et
// compatibilité avec « Améliorer avec Lumeo » (lot 3a). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { buildFollowUpMessage, buildFollowUpSubject, followUpGreeting, followUpVariant } = await import("./follow-up-message.ts");
const { atPosition, cleanPosition, positionArticle } = await import("./position-title.ts");
const { checkRelanceOutput, prepareRelanceCall } = await import("./lumeo-relance.ts");

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const NOW = new Date("2026-11-20T10:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

function app(overrides = {}) {
  return {
    position: "Analyste financier (H/F)",
    company: "Acme",
    applied_at: "2026-11-03",
    last_contact_at: null,
    status: "envoyee",
    contact_name: "Marie Dupont",
    ...overrides,
  };
}

// --- textes exacts validés ------------------------------------------------------------

test("J+5 à 6 (et avant) : variante courte, texte exact", () => {
  assert.equal(
    buildFollowUpMessage(app({ applied_at: daysAgo(5) }), "Camille Testeur", NOW),
    [
      "Bonjour Marie,",
      "",
      `Je voulais m'assurer que ma candidature au poste d'Analyste financier chez Acme, envoyée le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(daysAgo(5)))}, vous est bien parvenue.`,
      "",
      "Pourriez-vous me confirmer qu'elle est bien en cours d'examen ?",
      "",
      "Bien cordialement,",
      "Camille Testeur",
    ].join("\n"),
  );
});

test("J+7 à 10 : intérêt et vraie question, texte exact", () => {
  const msg = buildFollowUpMessage(app({ applied_at: "2026-11-11" }), "Camille Testeur", NOW); // 9 jours
  assert.equal(
    msg,
    [
      "Bonjour Marie,",
      "",
      "Je reviens vers vous au sujet de ma candidature au poste d'Analyste financier chez Acme, envoyée le 11 novembre. Le poste m'intéresse toujours et j'aimerais en parler avec vous.",
      "",
      "Où en est le processus de recrutement ?",
      "",
      "Bien cordialement,",
      "Camille Testeur",
    ].join("\n"),
  );
  assert.equal((msg.match(/beaucoup/g) ?? []).length, 0);
});

test("J+11 et plus : court échange, texte exact", () => {
  assert.equal(
    buildFollowUpMessage(app(), "Camille Testeur", NOW), // 17 jours
    [
      "Bonjour Marie,",
      "",
      "Ma candidature au poste d'Analyste financier chez Acme, envoyée le 3 novembre, est toujours d'actualité : ce poste m'intéresse vraiment.",
      "",
      "Auriez-vous un moment dans les prochains jours pour un court échange, par téléphone ou en visio ?",
      "",
      "Bien cordialement,",
      "Camille Testeur",
    ].join("\n"),
  );
});

test("2e relance (statut relancée) : 3 lignes avec sortie élégante, texte exact", () => {
  assert.equal(
    buildFollowUpMessage(app({ status: "relancee", last_contact_at: daysAgo(2) }), "Camille Testeur", NOW),
    [
      "Bonjour Marie,",
      "",
      "Je reviens vers vous au sujet de ma candidature au poste d'Analyste financier chez Acme.",
      "Si le poste est déjà pourvu, un mot me suffira. Sinon, auriez-vous un moment pour en parler ?",
      "",
      "Bien cordialement,",
      "Camille Testeur",
    ].join("\n"),
  );
});

test("objet : « petit suivi », « nouveau suivi » en 2e relance, « chez Acme » sans titre", () => {
  assert.equal(buildFollowUpSubject(app(), NOW), "Candidature Analyste financier — petit suivi");
  assert.equal(buildFollowUpSubject(app({ status: "relancee" }), NOW), "Candidature Analyste financier — nouveau suivi");
  assert.equal(buildFollowUpSubject(app({ position: "H/F" }), NOW), "Candidature chez Acme — petit suivi");
  assert.equal(buildFollowUpSubject(app({ position: "" }), NOW), "Candidature chez Acme — petit suivi");
});

// --- seuils ------------------------------------------------------------------------------

test("seuils : moins de 7 jours ou date inconnue = courte, 7 à 10 = intérêt, 11 et plus = échange", () => {
  for (const [days, variant] of [[0, "courte"], [4, "courte"], [6, "courte"], [7, "interet"], [10, "interet"], [11, "echange"], [40, "echange"]]) {
    assert.equal(followUpVariant(app({ applied_at: daysAgo(days) }), NOW), variant, `${days} jours`);
  }
  assert.equal(followUpVariant(app({ applied_at: null }), NOW), "courte");
  // Délai compté depuis la dernière relance si elle existe ; statut relancée = 2e relance.
  assert.equal(followUpVariant(app({ applied_at: daysAgo(30), last_contact_at: daysAgo(3) }), NOW), "courte");
  assert.equal(followUpVariant(app({ status: "relancee", last_contact_at: daysAgo(30) }), NOW), "deuxieme");
});

test("premier du mois : « 1er novembre », jamais « 1 novembre » ; « 11 novembre » intact", () => {
  assert.match(buildFollowUpMessage(app({ applied_at: "2026-11-01" }), null, NOW), /envoyée le 1er novembre,/);
  assert.doesNotMatch(buildFollowUpMessage(app({ applied_at: "2026-11-01" }), null, NOW), /le 1 novembre/);
  assert.match(buildFollowUpMessage(app({ applied_at: "2026-11-11" }), null, NOW), /envoyée le 11 novembre\./);
  // Le « 1 » de « 1er » figure dans les données envoyées à Lumeo : le contrôle des nombres passe.
  const a = app({ applied_at: "2026-11-01" });
  const source = buildFollowUpMessage(a, "Camille Testeur", NOW);
  const { mask, content } = prepareRelanceCall({ facts: a, offerSummary: null, contactName: a.contact_name, signer: "Camille Testeur", source, now: NOW });
  assert.equal(checkRelanceOutput(mask.text, mask, content).ok, true);
});

test("date d'envoi seulement si connue (pas de virgules orphelines)", () => {
  for (const days of [3, 8, 20]) {
    const msg = buildFollowUpMessage(app({ applied_at: null, last_contact_at: daysAgo(days) }), "Camille Testeur", NOW);
    assert.ok(!msg.includes("envoyée"), msg);
    assert.ok(!/ ,|,,|, vous|, est/.test(msg), msg);
  }
  assert.match(buildFollowUpMessage(app({ applied_at: null }), null, NOW), /que ma candidature au poste d'Analyste financier chez Acme vous est bien parvenue\./);
});

// --- formules ------------------------------------------------------------------------------

test("plus de formules toutes faites, ni écriture inclusive, ni « Je reste disponible » ; une question à la fin", () => {
  const variants = [app({ applied_at: daysAgo(5) }), app({ applied_at: daysAgo(8) }), app(), app({ status: "relancee" })];
  for (const a of variants) {
    const msg = buildFollowUpMessage(a, "Camille Testeur", NOW);
    for (const banned of [/je me permets/i, /vivement/i, /·/, /ravi/i, /je reste disponible/i, /heureux|heureuse/i]) assert.doesNotMatch(msg, banned);
    const body = msg.split("\n\nBien cordialement,")[0];
    assert.ok(body.trim().endsWith("?"), body);
  }
});

// --- salutation, signature -----------------------------------------------------------------

test("salutation : prénom seulement s'il est connu, civilité gardée, sinon « Bonjour, »", () => {
  assert.equal(followUpGreeting("Marie Dupont"), "Bonjour Marie,");
  assert.equal(followUpGreeting("Hélène Lefèvre"), "Bonjour Hélène,");
  assert.equal(followUpGreeting("Jean-Pierre Dubois-Martin"), "Bonjour Jean-Pierre,");
  assert.equal(followUpGreeting("Mme Dupont"), "Bonjour Madame Dupont,");
  assert.equal(followUpGreeting("M. Martin"), "Bonjour Monsieur Martin,");
  for (const none of [null, "", "   ", "Dupont", "J. Dupont", "Service RH", "Équipe recrutement", "Contact RH"]) {
    assert.equal(followUpGreeting(none), "Bonjour,", String(none));
  }
  assert.ok(buildFollowUpMessage(app({ contact_name: null }), "Camille Testeur", NOW).startsWith("Bonjour,\n"));
});

test("compte sans nom : repère « [Prénom Nom] » à compléter", () => {
  for (const signer of [null, undefined, "", "  "]) assert.ok(buildFollowUpMessage(app(), signer, NOW).endsWith("\nBien cordialement,\n[Prénom Nom]"));
});

// --- titre du poste --------------------------------------------------------------------------

test("titre nettoyé : H/F, F/H, durée, tirets ; le titre enregistré ne change pas", () => {
  assert.equal(cleanPosition("Analyste financier (H/F)"), "Analyste financier");
  assert.equal(cleanPosition("Stage - Chargé de marketing - 6 mois"), "Stage - Chargé de marketing");
  assert.equal(cleanPosition("Ingénieur logiciel F/H (6 mois)"), "Ingénieur logiciel");
  assert.equal(cleanPosition("Développeur H/F/X – 2 ans"), "Développeur");
  assert.equal(cleanPosition("H/F"), "");
  assert.equal(cleanPosition(" - "), "");
  const a = app({ position: "Chargé de marketing H/F - 6 mois" });
  const msg = buildFollowUpMessage(a, null, NOW);
  assert.match(msg, /au poste de Chargé de marketing chez Acme/);
  assert.doesNotMatch(msg + buildFollowUpSubject(a, NOW), /H\/F|6 mois/);
  assert.equal(a.position, "Chargé de marketing H/F - 6 mois");
});

test("article : « d' » devant voyelle, accent ou h muet, « de » sinon", () => {
  assert.equal(atPosition("Analyste"), "au poste d'Analyste");
  assert.equal(atPosition("Ingénieur"), "au poste d'Ingénieur");
  assert.equal(atPosition("Économiste"), "au poste d'Économiste");
  assert.equal(atPosition("Chargé de clientèle"), "au poste de Chargé de clientèle");
  assert.equal(atPosition("Stagiaire"), "au poste de Stagiaire");
  assert.equal(atPosition("Hôtesse d'accueil"), "au poste d'Hôtesse d'accueil");
  assert.equal(atPosition("Huissier"), "au poste d'Huissier");
  assert.equal(atPosition("Handballeur"), "au poste de Handballeur");
  for (const t of ["Éditeur", "Èbe", "Êtreur", "Àgent", "Âgent", "Îlotier", "Ôpérateur", "Ûrbaniste", "assistant", "yogi"]) assert.equal(positionArticle(t), "d'", t);
  assert.equal(atPosition(""), "");
  assert.equal(atPosition("H/F"), "");
});

test("poste vide ou seulement « H/F » : « ma candidature chez Acme », sans « au poste de »", () => {
  for (const position of ["", "H/F", "(F/H)"]) {
    for (const a of [app({ position, applied_at: daysAgo(5) }), app({ position, applied_at: daysAgo(8) }), app({ position }), app({ position, status: "relancee" })]) {
      const msg = buildFollowUpMessage(a, "Camille Testeur", NOW);
      assert.match(msg, /[mM]a candidature chez Acme/, msg);
      assert.doesNotMatch(msg, /au poste/);
    }
  }
});

// --- compatibilité avec le lot 3a --------------------------------------------------------------

test("chaque variante passe les contrôles du lot 3a, sans aucun nom en clair vers Lumeo", () => {
  const cases = [
    app({ applied_at: daysAgo(5) }),
    app({ applied_at: daysAgo(8), contact_name: "Hélène Lefèvre", position: "Économiste (H/F) - 6 mois" }),
    app({ contact_name: null, position: "H/F" }),
    app({ status: "relancee", contact_name: "Mme Dupont" }),
    app({ applied_at: null }),
  ];
  for (const a of cases) {
    for (const signer of ["Camille Testeur", null]) {
      const source = buildFollowUpMessage(a, signer, NOW);
      const { mask, content } = prepareRelanceCall({ facts: a, offerSummary: null, contactName: a.contact_name, signer, source, now: NOW });
      // Le texte de départ lui-même (masqué) passe les contrôles d'un brouillon : ni e-mail, ni lien,
      // ni nombre absent des données, repères connus.
      assert.equal(checkRelanceOutput(mask.text, mask, content).ok, true, mask.text);
      for (const name of ["Marie", "Dupont", "Hélène", "Lefèvre", "Camille", "Testeur"]) {
        assert.ok(!content.replace(/\{\{[a-z0-9_]+\}\}/g, " ").includes(name), `${name} : ${content}`);
      }
    }
  }
});

test("fiche : objet et message pré-écrits passés à la boîte ; « Réinitialiser » ramène ce message", () => {
  const page = read("../app/(app)/candidatures/[id]/page.tsx");
  assert.match(page, /defaultMessage=\{buildFollowUpMessage\(app, /);
  assert.match(page, /subject=\{buildFollowUpSubject\(app\)\}/);
  const box = read("../components/application/follow-up-box.tsx");
  assert.match(box, /onClick=\{\(\) => setMessage\(defaultMessage\)\}/);
  // « Améliorer avec Lumeo » part toujours du texte de la boîte.
  assert.match(box, /read: \(\) => messageRef\.current/);
});
