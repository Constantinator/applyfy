// Réponses simulées de Lumeo, pour tester l'interface en local sans appeler Claude
// (LUMEO_MOCK=1 sur la ligne de commande de `next dev`). Jamais actif en production ni sur Vercel.
// Le quota reste réellement consommé : la limite du jour se teste aussi en local.
import type { LumeoLocation } from "./lumeo-panel";

type Env = Record<string, string | undefined>;

export function lumeoMockEnabled(env: Env = process.env): boolean {
  return env.LUMEO_MOCK === "1" && env.NODE_ENV !== "production" && !env.VERCEL && !env.VERCEL_ENV;
}

const PREFIX = "(Réponse simulée, LUMEO_MOCK)";

/** Réponse simulée, choisie par mots-clés : le contenu réel est contrôlé sur la prévisualisation. */
export function mockLumeoReply(question: string, location: LumeoLocation): string {
  const q = question.toLowerCase();
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
