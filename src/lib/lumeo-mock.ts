// Réponses simulées de Lumeo, pour tester l'interface en local sans appeler Claude
// (LUMEO_MOCK=1 sur la ligne de commande de `next dev`). Jamais actif en production ni sur Vercel.
// Le quota reste réellement consommé : la limite du jour se teste aussi en local.
import type { LumeoModelAction } from "./lumeo-actions";
import type { LumeoLocation } from "./lumeo-panel";

type Env = Record<string, string | undefined>;

export function lumeoMockEnabled(env: Env = process.env): boolean {
  return env.LUMEO_MOCK === "1" && env.NODE_ENV !== "production" && !env.VERCEL && !env.VERCEL_ENV;
}

const PREFIX = "(Réponse simulée, LUMEO_MOCK)";

/**
 * Réponse simulée, choisie par mots-clés : le contenu réel est contrôlé sur la prévisualisation.
 * Les mots « lettre », « résume » et « adapte » simulent une proposition d'action (lot 2) : le
 * serveur la vérifie et affiche la carte comme pour une vraie réponse ; rien n'est exécuté.
 */
export function mockLumeoReply(question: string, location: LumeoLocation): { reply: string; action: LumeoModelAction } {
  const q = question.toLowerCase();
  if (/supprim|envoie|e-?mail/.test(q)) {
    return { reply: `${PREFIX} Je ne peux ni supprimer, ni envoyer quoi que ce soit : fais-le toi-même depuis la fiche.`, action: "aucune" };
  }
  if (/lettre/.test(q)) return { reply: `${PREFIX} Je te propose d'écrire ta lettre pour cette candidature : confirme si tu veux.`, action: "lettre" };
  if (/résum|resum/.test(q)) return { reply: `${PREFIX} Je te propose de résumer cette offre : confirme si tu veux.`, action: "resume_offre" };
  if (/adapt/.test(q)) return { reply: `${PREFIX} Je te propose une copie de ton CV adaptée à cette offre : confirme si tu veux.`, action: "adaptation_cv" };
  if (/relanc/.test(q) && /amélior|amelior|retravaill|réécri|reecri|rédige|redige|écri|aide/.test(q)) {
    return { reply: `${PREFIX} Je te propose de retravailler ta relance : confirme si tu veux.`, action: "relance" };
  }
  return { reply: mockText(q, location), action: "aucune" };
}

function mockText(q: string, location: LumeoLocation): string {
  if (/recette|lasagne|météo|football|blague/.test(q)) {
    return `${PREFIX} Je ne peux pas t'aider pour ça. Je suis là pour ta recherche d'emploi, ton CV et tes candidatures.`;
  }
  if (/licenci|contrat|légal|prud|rupture/.test(q)) {
    return `${PREFIX} Je ne peux pas te donner d'avis juridique. Parle-en à un avocat, à un syndicat ou à l'inspection du travail.`;
  }
  if (/postuler/.test(q) && location.page === "fiche") {
    return `${PREFIX} D'après ton CV, l'écart avec cette offre est important : je te la déconseille, mais c'est toi qui décides.\n\n- **Fait** : l'offre demande une expérience que ton CV ne montre pas.\n- **Avis** : vise plutôt des offres proches de ton poste actuel.\n\nSi tu postules quand même, passe-la en Envoyée sur la [fiche](/candidatures/${location.applicationId}).`;
  }
  if (/relanc/.test(q)) {
    return `${PREFIX} Après 7 jours sans réponse, une relance courte est raisonnable. Tu vois celles en retard dans [À relancer](/candidatures?filtre=a_relancer).`;
  }
  return `${PREFIX} Bonne question. Je ne peux pas encore te répondre en local : la vraie réponse se teste sur la prévisualisation. En attendant, regarde tes [candidatures](/candidatures). Lien externe ignoré : [site](https://example.com).`;
}

/**
 * Relance retravaillée simulée (lot 3a) : le texte masqué (repères {{…}} compris), avec deux
 * formules plus naturelles. Passe les mêmes contrôles qu'une vraie réponse.
 */
export function mockLumeoRelance(masked: string): string {
  const text = masked
    .replace(/Je me permets de revenir (de nouveau )?vers vous au sujet de/, "Je reviens vers vous au sujet de")
    .replace(/m'intéresse toujours vivement/, "m'intéresse toujours beaucoup")
    .replace(/je serais ravi·e d'échanger/, "j'aimerais beaucoup échanger");
  return `(Brouillon simulé, LUMEO_MOCK)

${text}`;
}
