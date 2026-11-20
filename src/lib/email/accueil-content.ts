// Textes des e-mails de bienvenue et de relance J+2, selon l'état du parcours d'accueil (fonctions
// pures, testables). Signés par Constantin : tutoiement, phrases courtes, pas de première personne
// de Lumeo, sans emoji, aucun chiffre ni durée non mesurés. Mise en page et lien de désinscription :
// gabarits.

/** « en_cours » : parcours d'accueil commencé ou pas encore ouvert ; « fini » : terminé, ou sans objet. */
export type OnboardingEmailVariant = "en_cours" | "fini";

export type AccueilEmailContent = {
  subject: string;
  /** Paragraphes avant le bouton (le premier est la salutation). */
  paragraphs: string[];
  button: { label: string; path: "/dashboard" | "/candidatures/nouvelle" };
  /** Ligne grisée sous le bouton, ou null. */
  hint: string | null;
};

const hello = (firstName: string | null) => (firstName ? `Salut ${firstName},` : "Salut,");

/** E-mail de bienvenue (envoyé une fois, dès que le compte est utilisable). */
export function welcomeEmailContent(variant: OnboardingEmailVariant, firstName: string | null): AccueilEmailContent {
  if (variant === "en_cours") {
    return {
      subject: "Bienvenue sur Applyfy",
      paragraphs: [
        `${firstName ? `Salut ${firstName}` : "Salut"}, ton compte est prêt. Tu peux reprendre où tu en étais : ton CV ou ta première offre, comme tu veux.`,
      ],
      // /dashboard renvoie au parcours tant qu'il n'est pas fini.
      button: { label: "Reprendre", path: "/dashboard" },
      hint: null,
    };
  }
  return {
    subject: "Bienvenue sur Applyfy",
    paragraphs: [hello(firstName), "Bienvenue sur Applyfy. Ajoute ta première candidature."],
    button: { label: "Ajouter ma première candidature", path: "/dashboard" },
    hint: "Colle juste l'URL de l'offre, Applyfy fait le reste.",
  };
}

/** Relance J+2 (compte sans aucune vraie candidature). */
export function activationEmailContent(variant: OnboardingEmailVariant, firstName: string | null): AccueilEmailContent {
  if (variant === "en_cours") {
    return {
      subject: "Ton parcours Applyfy t'attend",
      paragraphs: [
        hello(firstName),
        "Ton installation est presque terminée. Il reste une ou deux questions, puis on avance sur ton CV ou ta première offre.",
      ],
      button: { label: "Reprendre", path: "/dashboard" },
      hint: null,
    };
  }
  return {
    subject: "Tu n'as pas encore ajouté ta première candidature",
    paragraphs: [hello(firstName), "Ta première candidature t'attend. Colle le lien d'une offre, Applyfy remplit la fiche pour toi."],
    button: { label: "Ajouter une offre", path: "/candidatures/nouvelle" },
    hint: null,
  };
}
