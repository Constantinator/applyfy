// Le coach écoute (lot « le coach écoute ») : questions directes, refus, arrêt des questions,
// clôture jamais redite, consignes fixes du prompt. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

const { asksToStop, isConfirmationQuestion, isNegative, isReadinessQuestion, listenText, listeningState } = await import("./coach-intent.ts");
const { coachSystem } = await import("./coach-prompt.ts");

test("intention : questions directes, refus et demande d'arrêt (FR et EN)", () => {
  for (const q of ["C'est prêt ?", "Est-ce que mon CV est prêt ?", "Peut-on valider ?", "Je peux l'envoyer ?", "Is it ready?", "Can we validate?"]) {
    assert.ok(isReadinessQuestion(q), q);
  }
  assert.ok(!isReadinessQuestion("Prêt pour la suite, quelle est la question ?"));
  assert.ok(isConfirmationQuestion("Peux-tu me confirmer que la puce est bien rédigée ?"));
  assert.ok(isConfirmationQuestion("Can you confirm the bullet is fine?"));
  for (const n of ["Non", "non pas linkedin", "Je ne sais pas", "jsp", "Je n'ai pas ce chiffre", "No", "I don't know", "Je préfère ne pas inventer."]) {
    assert.ok(isNegative(n), n);
  }
  for (const yes of ["J'en ai signé 12 par mois.", "Non, c'était 15 clients.", "Oui, une vingtaine"]) assert.ok(!isNegative(yes), yes);
  for (const s of ["Plus de questions s'il te plaît", "Arrête les questions", "No more questions", "stop asking questions"]) assert.ok(asksToStop(s), s);
});

test("intention : état de la session tiré de l'historique", () => {
  const h = (...users) => users.flatMap((u) => [{ role: "user", content: u }, { role: "assistant", content: "…" }]);
  assert.equal(listeningState(h("Je ne sais pas"), "Non").stopFigures, true, "deux refus de suite");
  assert.equal(listeningState(h("Je ne sais pas", "12 clients"), "Non").stopFigures, false, "refus séparés");
  assert.equal(listeningState(h("Je ne sais pas", "Non"), "Ah si : 12 clients").stopFigures, true, "reste arrêté");
  assert.equal(listeningState(h("Plus de questions"), "Raccourcis mon accroche").stopAll, true);
  const last = listeningState([], "C'est prêt ?");
  assert.deepEqual(last, { stopAll: false, stopFigures: false, readiness: true, confirmation: false, refusal: false, shorten: false });
  assert.equal(listeningState([], "Raccourcis mon accroche, elle est trop longue.").shorten, true);
  assert.equal(listeningState([], "Can you make my summary shorter?").shorten, true);
});

const none = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false };
const listen = (patch) =>
  listenText({ mode: "parcours", lang: "fr", score: 72, scoreBefore: 70, corrections: ["2 puces sans chiffre — Stage chez X", "Dates sans mois — Y", "C"], previousCoach: [], ...patch, listening: { ...none, ...patch.listening } });

test("arrêt : deux refus, seule la question de chiffre est retirée, le reste est gardé", () => {
  assert.equal(
    listen({ text: "C'est fait, j'ai modifié : Stage chez X (puce 1). Combien de clients suivais-tu ?", listening: { stopFigures: true } }),
    "C'est fait, j'ai modifié : Stage chez X (puce 1).",
  );
  // Question qui ne demande pas de chiffre : gardée.
  assert.equal(listen({ text: "Quel outil utilisais-tu ?", listening: { stopFigures: true } }), "Quel outil utilisais-tu ?");
  // Message qui n'est qu'une question de chiffre : résumé et proposition de conclure.
  assert.equal(
    listen({ text: "Combien de clients suivais-tu ?", listening: { stopFigures: true } }),
    "D'accord, j'arrête les questions. Ce qui reste, si tu veux y revenir : 2 puces sans chiffre — Stage chez X ; Dates sans mois — Y. Ton CV est à 72/100 : tu peux t'arrêter là, ou me demander une modification précise.",
  );
});

test("arrêt : « plus de questions » retire toute question de parcours, pas celles d'une demande", () => {
  assert.equal(listen({ text: "Bien noté. Quel outil utilisais-tu ?", listening: { stopAll: true } }), "Bien noté.");
  assert.equal(listen({ text: "Je continue avec ta formation ?", mode: "demande", listening: { stopAll: true } }), "Je continue avec ta formation ?");
});

test("refus : pas de relance « Je continue avec… ? »", () => {
  assert.equal(
    listen({ text: "C'est noté. Je continue avec ton expérience chez X ?", mode: "demande", listening: { refusal: true } }),
    "C'est noté.",
  );
});

test("clôture : jamais redite une fois affichée", () => {
  const previousCoach = ["Ton CV est prêt : il atteint 85/100 (seuil de 80). Je n'ai plus de question à te poser."];
  assert.equal(
    listen({ text: "Ton CV est prêt et je n'ai plus de question à te poser. Si tu le souhaites, demande-moi une modification précise.", scoreBefore: 85, score: 85, previousCoach }),
    "Si tu le souhaites, demande-moi une modification précise.",
  );
  assert.equal(listen({ text: "Ton CV est prêt. Dis-moi si tu veux une modification précise.", scoreBefore: 85, score: 85, previousCoach: [] }), "Ton CV est prêt. Dis-moi si tu veux une modification précise.");
  assert.equal(listen({ text: "Ton CV est prêt.", scoreBefore: 85, score: 85, previousCoach }), "Dis-moi si tu veux une modification précise.");
});

test("question directe : réponse du serveur avant le reste", () => {
  assert.equal(
    listen({ text: "Il reste surtout tes dates.", listening: { readiness: true } }),
    "Pas encore : ton CV est à 72/100 (seuil de 80). Ce qui bloque surtout : 2 puces sans chiffre — Stage chez X ; Dates sans mois — Y. Il reste surtout tes dates.",
  );
  assert.equal(listen({ text: "Bonne chance !", score: 84, listening: { readiness: true } }), "Oui : ton CV est à 84/100, au-dessus du seuil de 80. Tu peux l'envoyer. Bonne chance !");
  assert.equal(listen({ text: "Some dates are missing.", lang: "en", listening: { readiness: true } }), "Not yet: your CV is at 72/100 (threshold 80). Some dates are missing.");
  // Le score est déjà dit : pas de doublon.
  assert.equal(listen({ text: "Ton CV est à 72/100.", listening: { readiness: true } }), "Ton CV est à 72/100.");
});

test("ton : formule déjà écrite mot pour mot retirée, constats du serveur et questions gardés", () => {
  const previousCoach = ["Pas de souci, je n'y reviens plus. Quel outil utilisais-tu ?", "Je n'ai pas pu modifier ton CV : il me manque un chiffre."];
  assert.equal(listen({ text: "Pas de souci, je n'y reviens plus. Passons à ta formation : quel diplôme ?", previousCoach }), "Passons à ta formation : quel diplôme ?");
  assert.equal(
    listen({ text: "Je n'ai pas pu modifier ton CV : il me manque un chiffre. Quel outil utilisais-tu ?", previousCoach }),
    "Je n'ai pas pu modifier ton CV : il me manque un chiffre. Quel outil utilisais-tu ?",
  );
  // Rien d'autre que la formule : gardée (jamais de message vide).
  assert.equal(listen({ text: "Pas de souci, je n'y reviens plus.", previousCoach }), "Pas de souci, je n'y reviens plus.");
});

test("prompt : règles des mots-clés de l'offre seulement pour un CV lié", () => {
  const base = { cvJson: "{}", score: { value: 60, corrections: [], banned: [] }, sector: "tech", marketKeywords: [], analysis: null };
  assert.ok(!coachSystem(base, "").includes("Mots-clés de l'offre absents du CV » (si cette liste"), "CV libre");
  const linked = coachSystem({ ...base, offer: { position: "Développeur", company: "X" }, offerKeywords: ["Docker"] }, "");
  const block = linked.slice(linked.indexOf("<mots_cles_offre>"), linked.indexOf("</mots_cles_offre>"));
  assert.ok(block.includes("- Docker\nRègles :\n- « Mots-clés de l'offre absents du CV »"));
  assert.ok(block.includes("La liste des mots-clés est recalculée"));
  assert.ok(base && coachSystem(base, "").includes("nomme chaque élément exactement comme dans le CV"));
});

test("sans intention détectée : texte inchangé", () => {
  const text = "C'est fait. Combien de clients ? Je continue avec ta formation ?";
  assert.equal(listen({ text }), text);
});

test("prompt : bloc « situation » en phrases fixes, absent sans intention", () => {
  const base = { cvJson: "{}", score: { value: 60, corrections: [], banned: [] }, sector: "tech", marketKeywords: [], analysis: null };
  assert.ok(!coachSystem({ ...base, listening: none }, "").includes("<situation>"));
  const all = { stopAll: true, stopFigures: true, readiness: true, confirmation: true, refusal: true, shorten: true };
  const system = coachSystem({ ...base, listening: all }, "");
  const block = system.slice(system.indexOf("<situation>"), system.indexOf("</situation>"));
  assert.equal(block.split("\n").filter(Boolean).length - 1, 6, "une phrase par intention, après la balise");
  assert.ok(block.includes("ne demande plus aucun chiffre"));
  assert.ok(block.includes("commence « message » par une réponse directe"));
});
