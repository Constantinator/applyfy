// Lot score (S3) : conséquences pour le coach du score sur les mots-clés de l'offre. CV lié : la
// correction « mots-clés » n'est donnée ni au coach ni à ses textes (bloc score, « Ce qui bloque
// surtout », clôture) ; le bloc des mots-clés de l'offre s'en charge. Premier message d'un CV lié
// réécrit (version de la clé) ; CV libre inchangé. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { correctionsForCoach } = await import("./cv-score.ts");
const { coachContentKey, coachSystem, OFFER_OPENING_VERSION } = await import("./coach-prompt.ts");
const { scoreCv } = await import("./cv-score.ts");

const commercial = profile("commercial-junior-fr");
const java = detailOf("o-tech-java-senior");

test("correctionsForCoach : sans la correction « mots-clés » pour un CV lié, toutes pour un CV libre", () => {
  const corrections = [{ category: "impact" }, { category: "keywords" }, { category: "form" }];
  assert.deepEqual(correctionsForCoach(corrections, { offerKeywords: [{ keyword: "Java", variants: [] }] }).map((c) => c.category), ["impact", "form"]);
  assert.equal(correctionsForCoach(corrections, {}).length, 3);
  assert.equal(correctionsForCoach(corrections, { offerKeywords: [] }).length, 3, "repli sur le secteur");
});

test("commercial face à une offre Java : le score compte Java, le coach ne reçoit pas de correction « mots-clés »", () => {
  const context = contextFor(commercial, java);
  const editor = scoreCv(commercial, context.scoring);
  assert.ok(editor.corrections.some((c) => c.message.startsWith("Mots-clés de l'offre : 0 sur ")), "l'éditeur garde la ligne");
  assert.ok(!context.score.corrections.some((c) => /mots-clés/i.test(c)), context.score.corrections.join("\n"));
  const system = coachSystem(context, "");
  const score = system.slice(system.indexOf("<score>"), system.indexOf("</score>"));
  assert.doesNotMatch(score, /Mots-clés de l'offre|Java/);
});

test("CV libre : la correction « mots-clés du métier » reste donnée au coach", () => {
  const context = contextFor(commercial, null);
  assert.ok(context.score.corrections.some((c) => /mots-clés du métier/.test(c)));
});

test("« C'est prêt ? » sur un CV lié : « Ce qui bloque surtout » ne cite pas les mots-clés de l'offre", async () => {
  const history = [{ role: "assistant", content: "Pour commencer, combien de contrats signes-tu par mois ?" }];
  const request = "C'est prêt ?";
  const result = await turn(commercial, contextFor(commercial, java, { history, request }), history, request, flat({ message: "Pas encore." }));
  assert.match(result.text, /Pas encore : ton CV est à \d+\/100/);
  assert.doesNotMatch(result.text, /Mots-clés de l'offre|Java|Spring/);
});

test("clé du premier message : version des CV liés seulement", () => {
  assert.equal(OFFER_OPENING_VERSION, "offre-v3");
  const offer = { position: "SE", company: "Google" };
  assert.notEqual(coachContentKey("{}", [], "tech", offer), coachContentKey("{}", [], "tech", null));
  // CV libre : la clé ne dépend d'aucune version (empreinte des CV libres inchangée, coach-libre.test).
  assert.equal(coachContentKey("{}", [], "tech", null), coachContentKey("{}", [], "tech", undefined));
});
