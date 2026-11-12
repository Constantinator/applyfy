// Lot « corrections après le run » (run 2026-11-11T03-36-44) : chaque correction rejoue les
// messages réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");

const financeCv = profile("finance-junior-fr");
const analyste = detailOf("o-finance-analyste");

// --- 1. Raccourcir : seulement sur demande ---

/** Messages réels de la candidate en O01 (aucun ne demande de raccourcir). */
const O01 = [
  "Oui, d'accord pour le résumé. Avant, peux-tu y ajouter des chiffres ? Chez Banque Fictive, je prépare 40 dossiers de crédit par mois pour des PME, et mon modèle Excel de suivi de trésorerie a réduit la clôture mensuelle de 2 jours. Pendant mon stage d'audit, j'ai participé à 6 missions de commissariat aux comptes.",
  "Je ne comprends pas bien : je n'ai pas demandé de raccourcir le résumé, j'ai demandé d'y ajouter mes chiffres. Pourrais-tu réessayer en gardant tous les chiffres : 40 dossiers de crédit par mois, réduction de la clôture mensuelle de 2 jours, et 6 missions de commissariat aux comptes ? Je ne sais pas quoi retirer, donc je préfère tout garder.",
  "Je suis un peu bloqué : tu dis toujours que le résumé doit être raccourci, alors que je te demande juste d'ajouter les chiffres. Peux-tu écrire le résumé avec les 3 chiffres sans rien retirer d'autre ? Si c'est vraiment impossible sans raccourcir, dis-moi au moins quelle phrase je peux modifier, car je ne sais pas quoi enlever.",
  "Je suis toujours bloqué sur le même point. Je ne te demande pas de raccourcir le résumé, seulement d'y ajouter mes 3 chiffres. Peux-tu me proposer une version qui les contient, même si elle est un peu plus longue ?",
  "Désolé, je suis toujours bloqué. Je ne veux pas raccourcir le résumé, je veux juste ajouter mes 3 chiffres, même si la version finale est plus longue.",
  "Je n'ai demandé aucune réduction, seulement d'ajouter 3 chiffres au résumé.",
];

test("raccourcir : demande reconnue, jamais un fait raconté ni une négation", () => {
  for (const message of O01) assert.equal(intent.asksToShorten(message), false, message);
  assert.equal(intent.asksToShorten("…qui a réduit la clôture mensuelle de 2 jours."), false);
  assert.equal(intent.asksToShorten("Mon outil a réduit le temps de traitement."), false);
  for (const message of [
    "Raccourcis mon accroche, elle est trop longue.",
    "Peux-tu raccourcir ma deuxième puce ?",
    "Mon résumé est trop long.",
    "Réduis la longueur du résumé.",
    "Fais-le plus court stp",
    "Condense mon expérience chez X.",
    "Shorten my summary please.",
    "Can you make it shorter?",
    "My summary is too long.",
  ]) {
    assert.equal(intent.asksToShorten(message), true, message);
  }
  for (const message of ["Ne raccourcis pas mon résumé.", "Garde-le sans raccourcir.", "Don't shorten it, just add the number."]) {
    assert.equal(intent.asksToShorten(message), false, message);
  }
});

test("rejeu O01 : ajouter des chiffres au résumé n'est jamais refusé pour « pas assez courte »", async () => {
  const opening = [{ role: "assistant", content: "Je te propose de réécrire ton résumé pour l'offre. Tu es d'accord ?" }];
  const longer =
    "Analyste financière junior chez Banque Fictive : 40 dossiers de crédit PME préparés par mois, modèle Excel de suivi de trésorerie qui a réduit la clôture mensuelle de 2 jours. Audit légal chez Cabinet Exemple Audit : 6 missions de commissariat aux comptes.";
  for (const [i, request] of O01.entries()) {
    // Historique réel : les chiffres ont été donnés au premier message.
    const history = i === 0 ? opening : [...opening, { role: "user", content: O01[0] }, { role: "assistant", content: "Je n'ai pas pu faire cette modification." }];
    const context = contextFor(financeCv, analyste, { history, request });
    assert.equal(context.listening.shorten, false);
    const result = await turn(financeCv, context, history, request, flat({ mode: "demande", section: "summary", data: longer, change_summary: "C'est fait." }));
    assert.equal(result.updated.summary, longer, request);
    assert.ok(!/raccourcir|pas assez courte/.test(result.text), result.text);
    assert.ok(![...result.firstProblems, ...result.problems].some((p) => p.problems.some((x) => x.includes("pas assez courte"))));
  }
});

test("raccourcir : jamais en mode parcours (O02, puce enrichie d'un chiffre)", async () => {
  const history = [{ role: "assistant", content: "As-tu un chiffre pour l'analyse des dossiers ?" }];
  // Message qui demande de raccourcir, mais réponse du coach en mode parcours : pas de règle des 20 %.
  const request = "Raccourcis si tu veux, mais j'analyse 40 dossiers par mois.";
  const context = contextFor(financeCv, null, { history, request });
  const data = JSON.stringify({ id: "fj-e1", bullets: [{ index: 0, after: "Analyse de 40 dossiers de crédit PME par mois" }] });
  const result = await turn(financeCv, context, history, request, flat({ section: "experience", data, change_summary: "C'est fait." }));
  assert.equal(result.updated.experiences[0].bullets[0], "Analyse de 40 dossiers de crédit PME par mois");
});

test("raccourcir : le nombre de mots annoncé vient du serveur, jamais du modèle", async () => {
  const history = [{ role: "assistant", content: "Bonjour." }];
  const request = "Raccourcis mon accroche.";
  const context = contextFor(financeCv, null, { history, request });
  const result = await turn(
    financeCv,
    context,
    history,
    request,
    flat({ mode: "demande", section: "summary", data: "Analyste financière junior, banque et audit.", change_summary: "C'est fait : j'ai raccourci ton résumé de 12 à 9 mots." }),
  );
  assert.ok(!result.text.includes("12 à 9"), result.text);
  assert.match(result.text, /Le texte passe de 15 à 6 mots\./);
  // Sans demande de raccourcir : aucun nombre de mots annoncé.
  const add = "Ajoute 40 dossiers par mois à mon résumé.";
  const plain = await turn(
    financeCv,
    contextFor(financeCv, null, { history, request: add }),
    history,
    add,
    flat({ mode: "demande", section: "summary", data: `${financeCv.summary} 40 dossiers par mois.`, change_summary: "C'est fait : 20 mots au lieu de 16." }),
  );
  assert.ok(!/\bmots\b/.test(plain.text), plain.text);
});

// --- 6. Titre mensonger : jamais le titre de l'offre quand l'écart est « métier » ---

const { coachSystem } = await import("./coach-prompt.ts");
const { scenarios } = await import("./coach-test-fixtures.mjs");

test("écart « métier » : seuls O02 et O03 ; O04 (étudiant, titre décalé) garde son étape titre", () => {
  const linked = scenarios.filter((s) => s.case === "lie" && s.set === "dev");
  const gaps = Object.fromEntries(linked.map((s) => [s.id, contextFor(profile(s.profile), detailOf(s.offer)).offerGap]));
  assert.deepEqual(
    Object.keys(gaps).filter((id) => gaps[id] === "metier"),
    ["O02-finance-vers-tech", "O03-ecart-trop-grand"],
  );
  for (const id of ["O01-meme-metier", "O06-demande-puce-lie", "O07-vague-lie", "O08-injection-offre", "O09-offre-en", "O10-offre-langue"]) {
    assert.notEqual(gaps[id], "metier", id);
  }
  // O04 : étudiant dont le titre nomme son domaine (« Étudiant en informatique ») : ni écart « métier », ni étape titre.
  const o04 = contextFor(profile("tech-stage-fr"), detailOf("o-finance-analyste"));
  assert.ok(!o04.offerSteps.includes("titre"));
  assert.equal(o04.offerStudent, true);
  for (const [cv, offer] of [["finance-junior-fr", "o-tech-backend"], ["commercial-junior-fr", "o-tech-java-senior"]]) {
    const ctx = contextFor(profile(cv), detailOf(offer));
    assert.ok(!ctx.offerSteps.includes("titre"), cv);
  }
});

test("écart « métier » : consigne fixe, titre de l'offre refusé, titre de reconversion seulement sur demande", async () => {
  const cv = profile("commercial-junior-fr");
  const java = detailOf("o-tech-java-senior");
  const history = [{ role: "assistant", content: "Je te propose de réécrire ton résumé. D'accord ?" }];
  const system = coachSystem(contextFor(cv, java, { history, request: "oui" }), "");
  assert.ok(system.includes("Le candidat n'a aucune expérience dans le métier de cette offre : le titre du CV reste le sien."));
  assert.ok(!system.includes("Étape à proposer dans « message » : le titre."));
  // O04 : consigne « étudiant » avec l'étape titre, pas de consigne « métier ».
  // Étudiant au titre générique : consigne « étudiant » avec l'étape titre, pas de consigne « métier ».
  const generic = { ...profile("tech-stage-fr"), personal: { ...profile("tech-stage-fr").personal, jobTitle: "Étudiant" } };
  const student = coachSystem(contextFor(generic, detailOf("o-finance-analyste"), { history, request: "oui" }), "");
  assert.ok(student.includes("Le candidat est étudiant ou stagiaire : un titre proposé garde son domaine d'études réel"));
  assert.ok(!student.includes("aucune expérience dans le métier de cette offre"));

  const title = (mode, jobTitle) => flat({ mode, section: "personal", data: JSON.stringify({ jobTitle }), change_summary: "C'est fait." });
  const run = (request, reply) => turn(cv, contextFor(cv, java, { history, request }), history, request, reply);
  const java1 = await run("oui", title("parcours", "Développeur Java"));
  assert.equal(java1.updated.personal.jobTitle, cv.personal.jobTitle);
  assert.ok(java1.text.includes("un métier que ton CV ne montre pas"));
  const asked = "Mets comme titre « Commercial terrain, en reconversion vers le développement Java ».";
  const honest = await run(asked, title("demande", "Commercial terrain, en reconversion vers le développement Java"));
  assert.equal(honest.updated.personal.jobTitle, "Commercial terrain, en reconversion vers le développement Java");
  // Même titre proposé par le coach de lui-même (parcours) : refusé.
  const notAsked = await run("oui", title("parcours", "Commercial terrain, en reconversion vers le développement Java"));
  assert.equal(notAsked.updated.personal.jobTitle, cv.personal.jobTitle);
});

// --- 4. Refus : comptés même avec un autre fait chiffré ; arrêt par type de question ---

test("refus : réponse « je ne sais pas » suivie d'un autre fait chiffré (L15, O02, O03)", () => {
  for (const message of [
    "Je ne connais pas le montant moyen ou total de mes contrats en euros, donc je ne peux pas te donner ce chiffre. Par contre, je peux te dire que je gère un portefeuille de 80 clients actifs.",
    "Je ne sais pas exactement combien de clients j'accueillais par jour ou par semaine à la boutique, donc je préfère ne pas inventer de chiffre. Par contre, j'y ai travaillé pendant 1 an, de 2022 à 2023.",
    "Je ne sais pas exactement le mois de début, je dirais que j'ai commencé en 2023, mais je n'ai pas la date précise en tête.",
    "Non, je n'ai pas de résultat chiffré précis pour l'analyse des dossiers, donc je préfère ne rien inventer. En revanche, tu peux citer le modèle Excel qui a réduit la clôture de 2 jours.",
    "Je ne sais pas combien de prospects je contacte exactement par mois, mais je signe en moyenne 12 nouveaux contrats par mois.",
    "Je ne me souviens plus des mois exacts, je sais seulement que j'ai été vendeur en boutique pendant 1 an, entre 2022 et 2023.",
    "I don't know the exact number, but I lead 4 engineers.",
  ]) {
    assert.equal(intent.isNegative(message), true, message);
  }
  for (const message of ["Non, environ 40 par mois.", "Ah si : 12 clients", "Je ne sais pas exactement, environ 40 par mois.", "Oui, 6 missions."]) {
    assert.equal(intent.isNegative(message), false, message);
  }
});

test("type de question : mois, outil, chiffre, détail (questions réelles du run)", () => {
  assert.equal(intent.questionType("Pas de souci. Pour ton poste chez Société Fictive, à quel mois as-tu commencé ce poste ?"), "mois");
  assert.equal(intent.questionType("Pour ton poste de Vendeur, quels sont les mois de début et de fin ?"), "mois");
  assert.equal(intent.questionType("Utilises-tu un outil CRM (Salesforce, HubSpot, Pipedrive…) pour suivre tes clients ?"), "outil");
  assert.equal(intent.questionType("Combien de clients accueillais-tu par jour ?"), "chiffre");
  assert.equal(intent.questionType("Combien de dossiers traites-tu par mois ?"), "chiffre");
  assert.equal(intent.questionType("Quels types de produits conseillais-tu en boutique ?"), "detail");
  assert.equal(intent.questionType("C'est fait."), null);
});

/** Historique L15 réel, réduit aux questions du coach et aux refus. */
const L15 = [
  ["Pour la puce « Négociation des contrats », quel est le montant moyen des contrats que tu négocies ?", "Je ne connais pas le montant moyen ou total de mes contrats en euros. Par contre, je gère 80 clients actifs."],
  ["Combien de clients accueillais-tu en moyenne par jour ?", "Je ne sais pas exactement combien de clients j'accueillais par jour. Par contre, j'y ai travaillé pendant 1 an, de 2022 à 2023."],
  ["Quels types de produits conseillais-tu ?", "Je ne sais pas précisément quels produits je conseillais ni la gamme de prix."],
];
const history = (pairs) => pairs.flatMap(([q, a]) => [{ role: "assistant", content: q }, { role: "user", content: a }]);

test("arrêt : deux refus de suite, quel que soit le type ; mois arrêtés après un seul refus", () => {
  const h = history(L15.slice(0, 2));
  const state = intent.listeningState(h.slice(0, -1), h.at(-1).content);
  assert.deepEqual(state.stopTypes, ["chiffre"]);
  const all = history(L15);
  const later = intent.listeningState(all.slice(0, -1), all.at(-1).content);
  assert.deepEqual(later.stopTypes, ["chiffre", "detail"]);
  // Mois : un seul refus suffit.
  const months = [{ role: "assistant", content: "À quel mois as-tu commencé ce poste ?" }];
  const once = intent.listeningState(months, "Je ne sais pas exactement le mois de début, j'ai commencé en 2023.");
  assert.equal(once.stopMonths, true);
  assert.equal(once.stopTypes, undefined);
  // Pas de refus : aucune de ces clés.
  const none = intent.listeningState([{ role: "assistant", content: "Combien ?" }], "40 par mois.");
  assert.ok(!("stopTypes" in none) && !("stopMonths" in none) && !("stopIfReady" in none));
});

test("arrêt : questions des types refusés retirées du texte affiché, sinon on n'insiste pas", () => {
  const base = { mode: "parcours", lang: "fr", score: 62, scoreBefore: 62, corrections: [], previousCoach: [] };
  const listening = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: true, shorten: false };
  const months = intent.listenText({ ...base, listening: { ...listening, stopMonths: true }, text: "Pas de souci. Pour ton poste de Vendeur, à quels mois as-tu commencé et terminé ?" });
  assert.ok(!months.includes("mois"), months);
  const crm = intent.listenText({
    ...base,
    listening: { ...listening, stopTypes: ["chiffre", "detail"] },
    text: "Pas de souci, je laisse ce point de côté. Utilises-tu un outil CRM pour suivre tes clients ?",
  });
  assert.ok(crm.includes("CRM"), "un outil n'a pas encore été refusé");
  const detail = intent.listenText({
    ...base,
    listening: { ...listening, stopTypes: ["chiffre", "detail"] },
    text: "As-tu déjà reçu un retour de clients ou de ton responsable pendant cette année ?",
  });
  assert.equal(detail, "Pas de souci, je n'insiste pas. Ton CV est à 62/100 : tu peux t'arrêter là, ou me demander une modification précise.");
});

// --- 7. Demandes d'arrêt indirectes ---

test("arrêt : demandes réelles d'O03 et O02, sans faux positif", () => {
  assert.equal(intent.asksToStop("Si on peut finir là-dessus, je te remercie."), true);
  assert.equal(intent.asksToStop("Je m'arrête là, merci pour ton aide."), true);
  assert.equal(intent.asksToStop("Merci pour le travail sur le résumé : de mon côté, le CV me convient, tu peux le finaliser."), true);
  assert.equal(intent.asksToStop("Thanks, I'm done."), true);
  for (const conditional of ["Tu peux l'indiquer dans la puce, et on pourra s'arrêter là si ton CV est prêt.", "Est-ce que ton CV est prêt pour une candidature commerciale ? Si oui, on peut s'arrêter là.", "If it's ready, we can stop there."]) {
    assert.equal(intent.asksToStop(conditional), false, conditional);
    assert.equal(intent.asksToStopIfReady(conditional), true, conditional);
    assert.equal(intent.listeningState([], conditional).readiness, true, conditional);
  }
  for (const message of [
    "non pas LinkedIn",
    "je me suis arrêté en 2022",
    "arrête de mettre des émojis",
    "ne t'arrête pas, continue",
    "on peut s'arrêter sur ce point ?",
    "le stage s'est fini là-bas en 2023",
    "just do both now in french. then im done",
    "ok so languages still left?? just do it now. then im done. too slow",
  ]) {
    assert.equal(intent.asksToStop(message), false, message);
    assert.equal(intent.asksToStopIfReady(message), false, message);
  }
});


test("arrêt conditionnel : réponse sur le score, aucune nouvelle question à ce message", () => {
  const listening = { stopAll: false, stopFigures: false, readiness: true, confirmation: false, refusal: false, shorten: false, stopIfReady: true };
  const text = intent.listenText({
    mode: "parcours",
    lang: "fr",
    score: 54,
    scoreBefore: 54,
    corrections: ["2 puces sans chiffre — Vendeur chez Boutique Exemple (+6 pts)"],
    previousCoach: [],
    listening,
    text: "C'est fait : j'ai ajouté tes 80 clients actifs. Passons à ton poste de Vendeur : combien de clients accueillais-tu par jour ?",
  });
  assert.ok(text.startsWith("Pas encore : ton CV est à 54/100"), text);
  assert.ok(text.includes("C'est fait : j'ai ajouté tes 80 clients actifs."));
  assert.ok(!text.includes("?"), text);
  assert.ok(text.endsWith("Tu peux t'arrêter là, ou me dire si tu veux continuer."), text);
});

// --- 3. Questions directes « c'est prêt ? » ---

test("question « prêt ? » : formulations réelles du run (L15, O03, L06, L14) et anglais, sans faux positif", () => {
  for (const message of [
    "Est-ce que ton CV est maintenant prêt pour un poste de commercial terrain ?",
    "Est-ce que ça suffit pour finaliser le CV ?",
    "Est-ce que ton CV est maintenant prêt, ou il reste des points à corriger ?",
    "Merci, tu peux me dire si mon CV est prêt pour une candidature commerciale.",
    "Super, tu peux me dire si le CV est prêt ?",
    "Ok, dis-moi si le CV est prêt.",
    "Mon CV est-il prêt ?",
    "Is my CV ready now?",
    "Is that enough to apply?",
    "Can you tell me if my CV is ready?",
  ]) {
    assert.equal(intent.isReadinessQuestion(message), true, message);
  }
  for (const message of [
    "Est-ce que le résumé est assez court ?",
    "non pas LinkedIn",
    "Je suis prêt à te donner mes chiffres.",
    "Mon CV est en français.",
    "Is the summary in English?",
  ]) {
    assert.equal(intent.isReadinessQuestion(message), false, message);
  }
});

// --- 2. CV clos : « Il y a encore des choses à améliorer ? » (L19) ---

test("améliorer : question reconnue (L19, O05) et consigne fixe", () => {
  for (const message of [
    "Il y a encore des choses à améliorer ?",
    "Merci. Juste une dernière question : y a-t-il un point précis à améliorer, par exemple le résumé ou les puces de mon expérience actuelle ? Sinon, je considère que le CV est prêt.",
    "Tu vois autre chose à changer pour cette offre ?",
    "Is there anything else to improve?",
    "What else could I improve?",
  ]) {
    assert.equal(intent.asksWhatToImprove(message), true, message);
    assert.equal(intent.listeningState([], message).improve, true, message);
  }
  for (const message of ["J'ai amélioré le taux de conversion de 12 %.", "Je considère que le CV est prêt.", "non pas LinkedIn"]) {
    assert.equal(intent.asksWhatToImprove(message), false, message);
  }
  const cv = profile("conseil-confirme-fr");
  const system = coachSystem(contextFor(cv, null, { history: [], request: "Il y a encore des choses à améliorer ?" }), "");
  assert.ok(system.includes("Le candidat demande ce qu'il reste à améliorer : réponds directement avec 1 ou 2 points concrets"));
});

test("améliorer, CV clos : jamais « Dis-moi si… » ni « prêt » redit ; pistes du serveur ou rien d'important", () => {
  const listening = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false, improve: true };
  const base = { mode: "parcours", lang: "fr", score: 85, scoreBefore: 85, previousCoach: ["Ton CV est prêt : il atteint 85/100 (seuil de 80)."], listening };
  // Réponses réelles de L19.
  const first = intent.listenText({ ...base, corrections: ["Accroche trop longue — 72 mots (vise 40 à 60)", "1 puce sans chiffre — Consultant chez Cabinet Conseil Fictif (+2 pts)"], text: "Dis-moi si tu veux une modification précise." });
  assert.equal(first, "Deux pistes facultatives, sans urgence : Accroche trop longue — 72 mots (vise 40 à 60) ; 1 puce sans chiffre — Consultant chez Cabinet Conseil Fictif.");
  const second = intent.listenText({ ...base, corrections: [], text: "Dis-moi si tu veux une modification précise, par exemple sur le résumé ou sur les puces de ton expérience chez Cabinet Conseil Fictif." });
  assert.ok(second.startsWith("Je ne vois rien d'important à changer"), second);
  assert.ok(!/prêt/.test(second));
  // Le modèle répond vraiment : sa réponse est gardée, sans la clôture redite.
  const answered = intent.listenText({ ...base, corrections: [], text: "Ton CV est prêt. Tu pourrais ajouter le budget de ta mission chez Cabinet Conseil Fictif, si tu le connais." });
  assert.equal(answered, "Tu pourrais ajouter le budget de ta mission chez Cabinet Conseil Fictif, si tu le connais.");
});

// --- 5. Langue : celle de rédaction du candidat, jamais celle du CV traduit (L17) ---

const lang = await import("./coach-language.ts");

test("langue : demande de traduction rédigée en anglais, message court, CV devenu français", async () => {
  const cv = profile("tech-confirme-en");
  // Les noms de langue cités ne trompent pas la détection.
  assert.equal(lang.detectLanguage("Translate my whole CV into French please."), "en");
  assert.equal(lang.detectLanguage("Peux-tu traduire tout mon CV en anglais ?"), "fr");
  // L17 [6] : message court, CV traduit en français entre-temps.
  const french = { ...cv, summary: "Ingénieur backend senior avec 8 ans d'expérience dans les plateformes de paiement et les API pour les équipes produit." };
  const history = [
    { role: "user", content: "ok so skills and languages still left?? just do both now in french. no more one section at a time. then im done" },
    { role: "assistant", content: "Done: I translated your skills." },
  ];
  const request = "ok so languages still left?? just do it now. then im done. too slow";
  assert.equal(lang.candidateLanguage(request, french, ["ok so still not done??"]), "en");
  const context = contextFor(french, null, { history, request });
  assert.equal(context.language, "en");
  // Résumé du modèle en français pour un candidat anglais (L17 [1]) : annonce du serveur en anglais.
  const reply = flat({
    mode: "demande",
    section: "summary",
    data: "Ingénieur backend senior, 8 ans d'expérience, plateformes de paiement",
    change_summary: "C'est fait : j'ai traduit ton accroche en français.",
    message: "Shall I continue with your experience at Fictional Software Ltd?",
  });
  const result = await turn(french, context, history, request, reply);
  assert.ok(!result.text.includes("C'est fait"), result.text);
  assert.ok(result.text.startsWith("Done, I've updated:"), result.text);
});

test("langue : message indécidable, repli sur le message précédent du candidat avant le CV", () => {
  const french = { ...profile("tech-confirme-en"), summary: "Ingénieur backend senior avec 8 ans d'expérience dans les plateformes de paiement." };
  assert.equal(lang.detectLanguage("ok"), null);
  assert.equal(lang.candidateLanguage("ok", french, ["Translate my whole CV into French please."]), "en");
  assert.equal(lang.candidateLanguage("ok", french, []), lang.cvLanguage(french));
});

// --- Jargon : seulement le texte affiché du coach ---

const { plainCoachText } = await import("./coach-plain.ts");

test("jargon : message réel d'O03 réécrit, passages cités intacts", () => {
  assert.equal(
    plainCoachText("Pour ton poste de Vendeur chez Boutique Exemple, ta puce « Tenue de la caisse » n'a pas de verbe d'action en tête : sais-tu combien de transactions tu gérais par jour ?"),
    "Pour ton poste de Vendeur chez Boutique Exemple, ta puce « Tenue de la caisse » ne dit pas ce que tu as fait concrètement : sais-tu combien de transactions tu gérais par jour ?",
  );
  assert.equal(
    plainCoachText("Sur ton stage, la puce « Participation aux réunions d'équipe » n'a ni verbe d'action ni chiffre."),
    "Sur ton stage, la puce « Participation aux réunions d'équipe » ne dit pas ce que tu as fait concrètement et n'a pas de chiffre.",
  );
  assert.equal(
    plainCoachText("Pistes facultatives, sans urgence : 2 puces sans verbe d'action en tête — Vendeur chez Boutique Exemple (+6 pts) ; 6 mots-clés ATS sur 10."),
    "Pistes facultatives, sans urgence : 2 puces qui ne disent pas ce que tu as fait concrètement — Vendeur chez Boutique Exemple ; 6 mots-clés du métier sur 10.",
  );
  // Une puce du CV citée qui contient ces termes reste telle quelle.
  const quoted = "Ta puce « Formation de 12 stagiaires aux verbes d'action et aux mots-clés ATS (+2 pts) » n'a pas de verbe d'action en tête.";
  assert.equal(plainCoachText(quoted), "Ta puce « Formation de 12 stagiaires aux verbes d'action et aux mots-clés ATS (+2 pts) » ne dit pas ce que tu as fait concrètement.");
  assert.equal(plainCoachText("Your bullet “Led the ATS keywords audit” doesn't start with an action verb.", "en"), "Your bullet “Led the ATS keywords audit” doesn't say what you actually did.");
});

test("jargon : jamais appliqué au contenu du CV ni au texte proposé", async () => {
  const cv = profile("rh-stage-fr");
  const exp = cv.experiences[0];
  const bullet = "Formation de 12 stagiaires aux verbes d'action et aux mots-clés ATS";
  const history = [{ role: "assistant", content: "Bonjour." }];
  const request = "Ajoute une puce : j'ai formé 12 stagiaires aux verbes d'action et aux mots-clés ATS.";
  const context = contextFor(cv, null, { history, request });
  const reply = flat({
    mode: "demande",
    section: "experience",
    data: JSON.stringify({ id: exp.id, bullets: [{ index: -1, after: bullet }] }),
    change_summary: `C'est fait : j'ai ajouté la puce « ${bullet} ».`,
    message: "Ta puce suivante n'a pas de verbe d'action en tête : que faisais-tu concrètement ?",
  });
  const result = await turn(cv, context, history, request, reply);
  // Contenu du CV : la puce proposée est écrite telle quelle.
  assert.ok(result.updated.experiences[0].bullets.includes(bullet), JSON.stringify(result.updated.experiences[0].bullets));
  // Texte affiché : la puce citée reste intacte, le jargon hors citation est remplacé.
  assert.ok(result.text.includes(`« ${bullet} »`), result.text);
  assert.ok(result.text.includes("Ta puce suivante ne dit pas ce que tu as fait concrètement"), result.text);
});

// --- Langue tirée du seul CV : l'annonce du modèle dans l'autre langue n'est jamais affichée ---

test("langue tirée du CV : annonce du serveur seule, dans cette langue (anglais et français)", async () => {
  const history = [{ role: "assistant", content: "Hello." }];
  // CV anglais, message indécidable (« Raccourcis mon accroche. ») : langue anglaise, tirée du CV.
  const en = profile("tech-confirme-en");
  const enRequest = "Raccourcis mon accroche.";
  const enContext = contextFor(en, null, { history: [], request: enRequest });
  assert.equal(enContext.language, "en");
  const enResult = await turn(
    en,
    enContext,
    history,
    enRequest,
    flat({ mode: "demande", section: "summary", data: "Backend engineer, payments", change_summary: "C'est fait : accroche raccourcie." }),
  );
  assert.ok(!enResult.text.includes("C'est fait"), enResult.text);
  assert.match(enResult.text, /^Done, I've updated: [^.]+\. The text goes from \d+ to 3 words\.$/);

  // CV français, message indécidable (« Shorten it. ») : langue française, tirée du CV.
  const fr = profile("rh-stage-fr");
  const frRequest = "Shorten it.";
  const frContext = contextFor(fr, null, { history: [], request: frRequest });
  assert.equal(frContext.language, "fr");
  const frResult = await turn(
    fr,
    frContext,
    history,
    frRequest,
    flat({ mode: "demande", section: "summary", data: "Diplômée RH, premier poste en recrutement.", change_summary: "Done: summary shortened." }),
  );
  assert.ok(!frResult.text.includes("Done"), frResult.text);
  assert.equal(frResult.text, "C'est fait, j'ai modifié : Accroche. Le texte passe de 12 à 6 mots.");

  // Annonce dans la bonne langue : gardée.
  const kept = await turn(
    fr,
    frContext,
    history,
    frRequest,
    flat({ mode: "demande", section: "summary", data: "Diplômée RH, premier poste en recrutement.", change_summary: "C'est fait : accroche raccourcie." }),
  );
  assert.equal(kept.text, "C'est fait : accroche raccourcie. Le texte passe de 12 à 6 mots.");
});

// --- Nombre de mots : calculé sur les textes avant et après ---

const { wordCounts } = await import("./coach-turn.ts");

test("nombre de mots : 40 mots devenant 28, les deux nombres viennent des textes", async () => {
  const words = Array.from({ length: 40 }, (_, i) => `mot${String.fromCharCode(97 + (i % 26))}`);
  const before = words.join(" ");
  const after = words.slice(0, 28).join(" ");
  assert.deepEqual(wordCounts([{ before, after }]), { before: 40, after: 28 });
  // Ponctuation et tirets isolés ne comptent pas comme des mots ; un ajout (avant null) n'entre pas dans le calcul.
  assert.deepEqual(wordCounts([{ before: "Un — deux, trois !", after: "Un : deux" }, { before: null, after: "nouvelle puce de cinq mots" }]), { before: 3, after: 2 });
  assert.equal(wordCounts([{ before: null, after: "ajout seul" }]), undefined);

  // Échange complet : accroche de 40 mots raccourcie à 28 mots.
  const summary40 =
    "Analyste crédit junior chez Banque Fictive depuis deux ans, je prépare chaque mois les dossiers de crédit des PME, je suis le portefeuille clients et je prépare les comités de crédit avec les équipes commerciales et risques de l'agence régionale.";
  const summary28 =
    "Analyste crédit junior chez Banque Fictive depuis deux ans : préparation mensuelle des dossiers de crédit des PME, suivi du portefeuille clients et préparation des comités de crédit mensuels.";
  const count = (text) => text.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
  assert.equal(count(summary40), 40);
  assert.equal(count(summary28), 28);
  const cv = { ...profile("finance-junior-fr"), summary: summary40 };
  const history = [{ role: "assistant", content: "Bonjour." }];
  const request = "Raccourcis mon accroche.";
  const result = await turn(cv, contextFor(cv, null, { history, request }), history, request, flat({ mode: "demande", section: "summary", data: summary28, change_summary: "C'est fait : j'ai raccourci ton accroche." }));
  assert.equal(result.updated.summary, summary28);
  assert.equal(result.text, "C'est fait : j'ai raccourci ton accroche. Le texte passe de 40 à 28 mots.");
});
