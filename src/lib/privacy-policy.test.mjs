// Garde-fou de la politique de confidentialité : ce qu'elle dit de Lumeo et du coach du CV Builder
// doit rester vrai (cf. lib/lumeo-panel : contexte envoyé, rien d'enregistré). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../app/(legal)/politique-confidentialite/page.tsx", import.meta.url), "utf8");
// Texte lisible : apostrophes JSX décodées, sauts de ligne et espaces regroupés.
const text = source.replace(/&apos;/g, "'").replace(/\s+/g, " ");

test("Lumeo est cité parmi les usages de l'IA et le rôle d'Anthropic", () => {
  assert.match(text, /réponses de Lumeo à tes questions, uniquement à ta demande/);
  assert.match(text, /coach du CV Builder et réponses de Lumeo à tes questions/);
});

test("les conversations avec Lumeo ne sont pas conservées", () => {
  assert.match(text, /conversations avec Lumeo ne sont pas conservées par Applyfy/);
  assert.match(text, /disparaissent quand tu la recharges ou la fermes/);
});

test("ce que reçoit Lumeo est listé, sans email, téléphone, contacts ni notes", () => {
  for (const part of [
    "ta question",
    "ton prénom",
    "un résumé de ton CV",
    "un résumé de tes candidatures",
    "ton plan (gratuit, Premium ou beta) et tes quotas restants",
    "l'offre correspondante",
  ]) {
    assert.ok(text.includes(part), part);
  }
  assert.match(text, /Lumeo ne reçoit jamais ton email, ton téléphone, les contacts recruteurs ni tes notes/);
  assert.match(
    text,
    /À ta demande et après ta confirmation, Lumeo peut lancer la rédaction d'une lettre, le résumé d'une offre, l'adaptation de ton CV ou la réécriture de ta relance ; ces actions utilisent les mêmes données que les fonctions correspondantes\./,
  );
});

test("l'historique du coach du CV Builder est mentionné, avec sa durée de conservation", () => {
  assert.match(text, /Conversations avec le coach du CV Builder/);
  assert.match(text, /enregistrés avec le CV concerné/);
  assert.match(text, /coach du CV Builder sont supprimés avec le CV concerné ou avec ton compte/);
});

test("le stockage local cite les messages de Lumeo", () => {
  assert.match(text, /messages de Lumeo déjà vus ou remis à plus tard/);
});

test("date de mise à jour au format « 10 novembre 2026 »", () => {
  assert.match(source, /updatedOn="\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{4}"/);
});
