/**
 * Textes de Lumeo, l'assistant du CV Builder (bandeau, chat, import d'un CV).
 * Provisoires : à remplacer ici, en une seule fois, par ceux de docs/lumeo-voix.md.
 */
export const LUMEO_TEXTS = {
  name: "Lumeo",
  /** Ligne d'accroche du bandeau du chat. */
  tagline: "Je t'aide à améliorer ton CV, une question à la fois.",
  /** Conversation vide. */
  empty: "Dis-moi ce que tu veux améliorer dans ton CV, ou pose-moi une question.",
  /** Réponse en cours. */
  pending: "Lumeo réfléchit…",
  /** Premier message en préparation. */
  reading: "Je lis ton CV…",
  /** Intro (chat complet, hors mode minimal). */
  intro: "Réponds à mes questions : j'intègre tes réponses directement dans ton CV.",
  /** Nom de la conversation pour les lecteurs d'écran. */
  log: "Conversation avec Lumeo",
  /** Import d'un CV : dernière étape et son erreur. */
  importStep: "Préparation de Lumeo",
  importError: "Lumeo n'a pas pu être préparé.",
  /** Import d'un CV : carte « Optimisations suggérées ». */
  optimizations: "Les priorités pour ton CV. Dans l'éditeur, je les traiterai avec toi une par une.",
  /** Contenu du CV : libellé du champ « Poste visé ». */
  targetJobLabel: "Poste visé (pour le score et Lumeo)",
  /** Nouveau CV : aide du champ « Poste visé ». */
  targetJobHelp: "Il sert de titre à ton CV et adapte le score et mes conseils à ton secteur.",
} as const;

/**
 * Bandeau de Lumeo sur le Tableau de bord (un message à la fois, cf. lib/lumeo-dashboard).
 * Tutoiement, jamais de reproche : Lumeo propose, l'utilisateur décide et envoie lui-même.
 */
export const LUMEO_DASHBOARD_TEXTS = {
  label: "LUMEO",
  later: "Plus tard",
  bienvenue: {
    title: "Bienvenue ! Je suis Lumeo. On commence par ton CV, ça prend 5 minutes.",
    detail: "Je t'accompagne ensuite pour chaque candidature.",
    primary: "Créer mon CV",
    secondary: "J'ai déjà un CV",
  },
  premiere: {
    title: "La première candidature est partie. Bravo. Je te rappelle de relancer dans 7 jours, si tu n'as pas de réponse.",
    detail: "Tu peux suivre sa réponse dans Candidatures.",
    primary: "Voir ma candidature",
  },
  objectif: {
    title: (sent: number) =>
      `${sent} candidature${sent > 1 ? "s" : ""} cette semaine, il t'en manque une pour ton objectif.`,
    detail: "Une offre qui te plaît suffit.",
    primary: "Trouver une offre",
  },
  relance: {
    title: (company: string, days: number) =>
      `${company} n'a pas répondu depuis ${days} jour${days > 1 ? "s" : ""} : tu peux la relancer.`,
    detail: "Un message court et poli suffit souvent.",
    primary: "Voir la relance",
  },
} as const;
