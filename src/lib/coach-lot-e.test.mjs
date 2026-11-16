// Lot E du coach (run 2026-11-16T05-00-26) : suppression acceptée puis refusée (L02, tour 9), puce
// sans chiffre refusée après une réponse partielle (L11, tour 4). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");

// --- 1. Suppression : pronom avant le verbe, interjection avant « oui », dernière question du coach ---

/** L02 tour 8 (run 2026-11-16T05-00-26) : le coach propose la suppression. */
const L02_COACH_8 =
  "C'est fait : j'ai passé Git au niveau intermédiaire dans tes compétences. Pour ta puce « Participation aux réunions d'équipe » chez Startup Exemple, je ne la supprime pas sans ton accord : elle apporte peu sans résultat concret, donc je te conseille de la retirer. Veux-tu que je la supprime ?";
/** L02 tour 9 : le candidat accepte, pronom avant le verbe, « Ah oui » en tête. */
const L02_USER_9 =
  "Ah oui, je pense que tu as raison, cette puce ne sert pas à grand-chose sans chiffre ni résultat. Tu peux la supprimer, pas de souci, je préfère une liste plus courte que quelque chose de flou. Par contre, j'ai encore deux points à vérifier dans le repo ce soir : le covoiturage en React Native et TypeScript sur les 2 pages du stage. Une fois que j'aurai les réponses, je te les envoie et on finira ça ensemble.";
const proposal = [{ role: "assistant", content: L02_COACH_8 }];
const unrelated = [{ role: "assistant", content: "Combien de bugs as-tu corrigés pendant ton stage ?" }];
const doubleQuestion = [
  { role: "assistant", content: "Veux-tu que je supprime la puce « Participation aux réunions d'équipe » ? Et à quel mois as-tu commencé ton stage ?" },
];

test("suppression : déclenchement (L02 tour 9 réel, « Oh oui, vas-y », « Supprime-la », « Peux-tu les retirer ? »)", () => {
  assert.equal(intent.removalAllowed(proposal, L02_USER_9), true, "L02 tour 9");
  assert.equal(intent.asksToRemove(L02_USER_9), true, "1a : « Tu peux la supprimer » est une demande");
  assert.equal(intent.removalAllowed(proposal, "Oh oui, vas-y."), true, "1b : interjection avant « oui »");
  assert.equal(intent.removalAllowed(proposal, "Ah oui"), true, "1b");
  for (const ask of ["Supprime-la.", "Peux-tu les retirer ?", "Tu peux la supprimer.", "Tu pourrais l'enlever ?", "N'hésite pas à la retirer."]) {
    assert.equal(intent.removalAllowed(unrelated, ask), true, ask);
  }
});

test("suppression : non-déclenchement (« oui » à une autre question, question double, refus)", () => {
  assert.equal(intent.removalAllowed(unrelated, "Oui, environ 20."), false, "« oui » à une question de chiffre");
  // 1c : la dernière question du coach porte sur le mois, le « oui » ne vaut pas accord de suppression.
  assert.equal(intent.removalAllowed(doubleQuestion, "Oui, en mars."), false, "question double : suppression puis mois");
  assert.equal(intent.removalAllowed(doubleQuestion, "Ah oui, en mars."), false, "question double, avec interjection");
  for (const no of ["Non, garde-la.", "Je ne veux pas la supprimer.", "Ah non, laisse-la.", "Ne la supprime pas, elle compte pour moi.", "Ok, garde-la finalement."]) {
    assert.equal(intent.removalAllowed(proposal, no), false, no);
  }
  // Une question de suppression qui n'est pas la dernière n'autorise pas un « oui » seul.
  const removalThenTool = [{ role: "assistant", content: "Veux-tu que je retire la puce sur les réunions ? Quels outils utilisais-tu ?" }];
  assert.equal(intent.removalAllowed(removalThenTool, "Oui, surtout Git."), false);
  // Une question de suppression dernière, après une autre question : accord accepté.
  const toolThenRemoval = [{ role: "assistant", content: "Quels outils utilisais-tu ? Et veux-tu que je retire la puce sur les réunions ?" }];
  assert.equal(intent.removalAllowed(toolThenRemoval, "Oui."), true);
  // Faits racontés et pronom sans verbe de suppression : pas des demandes.
  assert.equal(intent.removalAllowed(unrelated, "Tu peux la reformuler ?"), false);
  assert.equal(intent.removalAllowed(unrelated, "Je retire 40 dossiers par mois du coffre."), false);
});

const cv = profile("tech-stage-fr");
const exp = cv.experiences[0];
const removalReply = flat({
  section: "experience",
  data: JSON.stringify({ id: exp.id, bullets_to_remove: [1] }),
  change_summary: "C'est fait : j'ai supprimé la puce « Participation aux réunions d'équipe ».",
});
const play = (history, request) => turn(cv, contextFor(cv, null, { history, request }), history, request, removalReply);

test("suppression : rejeu L02 tours 8 et 9, la puce est supprimée", async () => {
  assert.equal(exp.bullets[1], "Participation aux réunions d'équipe");
  const result = await play(proposal, L02_USER_9);
  assert.equal(result.applied, 1, JSON.stringify(result.problems));
  assert.ok(!result.updated.experiences[0].bullets.includes("Participation aux réunions d'équipe"));
});

test("suppression : rejeu L02 tour 8 puis « Non, garde-la » ou « oui » au mois, rien n'est supprimé", async () => {
  for (const [history, request] of [
    [proposal, "Non, garde-la."],
    [doubleQuestion, "Oui, en mars."],
    [unrelated, "Oui, une vingtaine."],
  ]) {
    const result = await play(history, request);
    assert.equal(result.applied, 0, request);
    assert.ok(result.updated.experiences[0].bullets.includes("Participation aux réunions d'équipe"), request);
  }
});
