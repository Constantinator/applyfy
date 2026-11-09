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
