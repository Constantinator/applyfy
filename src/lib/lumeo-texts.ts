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

/** Petite ligne de Lumeo sur la fiche d'une candidature envoyée (cf. lib/lumeo-fiche). */
export const LUMEO_FICHE_TEXTS = {
  sent: "Elle est partie. Je te préviens quand il sera temps de relancer.",
} as const;

/**
 * Panneau global de Lumeo (espace connecté, cf. lib/lumeo-panel et components/lumeo/lumeo-panel).
 * Lumeo conseille et oriente ; dans ce lot, il ne déclenche aucune action.
 */
export const LUMEO_PANEL_TEXTS = {
  open: "Ouvrir Lumeo",
  close: "Fermer Lumeo",
  /** Pleine page (/lumeo) : même conversation que le panneau. */
  expand: "Agrandir",
  expandLabel: "Agrandir : ouvrir Lumeo en pleine page",
  reduce: "Réduire",
  reduceLabel: "Réduire : revenir à la page précédente avec le panneau Lumeo",
  nav: "Lumeo",
  pageTitle: "Lumeo — Applyfy",
  pageDescription: "Pose tes questions à Lumeo sur ta recherche d'emploi, en pleine page.",
  dialog: "Lumeo",
  tagline: "Je réponds à tes questions sur ta recherche d'emploi et sur l'appli.",
  empty: "Pose-moi une question, ou choisis une des suggestions.",
  pending: "Lumeo réfléchit…",
  placeholder: "Ta question…",
  privacy: "Je suis une IA : vérifie ce qui compte. Tes questions et le contexte utile (CV résumé, candidatures) sont transmis à Claude (Anthropic) et ne sont pas enregistrés par Applyfy.",
  suggestions: {
    fiche: ["Dois-je postuler à cette offre ?", "Quand relancer ?", "Comment préparer l'entretien ?"],
    dashboard: ["Par quoi je commence aujourd'hui ?", "Qu'est-ce qui affaiblit mon CV ?", "Quelles candidatures relancer ?"],
    candidatures: ["Quelles candidatures relancer ?", "Où en est ma recherche ?", "Combien de candidatures par semaine viser ?"],
    "cv-builder": ["Qu'est-ce qui affaiblit mon CV ?", "Mon CV tient-il sur une page ?", "Comment parler d'un trou dans mon parcours ?"],
    offres: ["Comment choisir une offre ?", "Cette recherche me correspond-elle ?", "Faut-il postuler à une offre où je n'ai pas tout ?"],
    autre: ["Par quoi je commence ?", "Comment fonctionne Applyfy ?", "Comment relancer un recruteur ?"],
  },
  /** Quota du jour atteint (plan gratuit) : honnête, jamais sec. */
  quota: (limit: number) =>
    `Désolé, tu as posé tes ${limit} questions du jour. Ça repart demain à minuit, ou sans cette limite avec Premium.`,
  /** Limite commune à tous les plans (actions IA du jour). */
  daily: "Désolé, la limite d'actions IA du jour est atteinte. Ça repart demain à minuit.",
  rate: "Désolé, trop de questions d'un coup. Attends quelques secondes et repose-la.",
  error: "Désolé, je n'ai pas pu répondre. Réessaie dans un instant.",
  refusal: "Désolé, je ne peux pas répondre à ça. Pose-moi une question sur ta recherche d'emploi.",
  tooLong: "Ta question est trop longue : raccourcis-la un peu.",
  empty_question: "Écris ta question.",
} as const;

/** Actions proposées par Lumeo (lot 2) : carte de confirmation, résultats et refus. */
type Target = { position: string; company: string };
export const LUMEO_ACTION_TEXTS = {
  cardTitle: "Lumeo te propose",
  cardLetter: ({ position, company }: Target) => `Écrire ta lettre de motivation pour « ${position} » chez ${company}.`,
  cardSummary: ({ position, company }: Target) => `Résumer l'offre « ${position} » chez ${company} et l'ajouter à sa fiche.`,
  cardAdaptation: ({ position, company, cv }: Target & { cv: string }) =>
    `Créer une copie de ton CV « ${cv} » adaptée à l'offre « ${position} » chez ${company}. Ton CV d'origine ne change pas.`,
  yourCv: "ton CV",
  units: { lettre: "lettre", resume_offre: "résumé d'offre", adaptation_cv: "adaptation à une offre" },
  quotaFree: (unit: string, left: number, limit: number) => `Utilise 1 ${unit} de ton quota du mois (il t'en reste ${left} sur ${limit}).`,
  quotaPremium: (daily: number) => `Pas de quota mensuel ; compte dans les ${daily} actions IA du jour.`,
  confirm: "Confirmer",
  cancel: "Annuler",
  running: "En cours…",
  cancelled: "Action annulée.",
  done: "C'est fait.",
  monthReached: (unit: string) => `Tu as utilisé ton quota du mois pour : ${unit}. Ça repart le 1er du mois prochain. Premium n'a pas de quota mensuel.`,
  dailyReached: "La limite d'actions IA du jour est atteinte. Ça repart demain à minuit.",
  alreadyRunning: "Cette action est déjà en cours pour cette candidature. Attends quelques instants.",
  failed: "Désolé, l'action n'a pas abouti. Rien n'a été décompté ; réessaie dans un instant.",
  invalid: "Action impossible.",
  noFiche: "Pour que je puisse le faire, ouvre d'abord la fiche de la candidature, puis redemande-le-moi.",
  notFound: "Candidature introuvable.",
  example: "C'est la candidature exemple : ajoute une vraie candidature pour utiliser cette action.",
  letterExists: "Une lettre existe déjà pour cette candidature : je ne l'écrase pas. Ouvre-la pour la modifier.",
  summaryExists: "Cette offre a déjà un résumé sur sa fiche.",
  descriptionTooShort: "La description de l'offre est trop courte pour cette action. Complète-la sur la fiche.",
  cvAlreadyLinked: "Un CV est déjà lié à cette candidature : ouvre-le et demande-moi de l'améliorer dans l'éditeur.",
  noCv: "Il me faut d'abord un CV : crée-le ou importe-le dans le CV Builder.",
  noBullets: "Ton CV n'a pas encore de points d'expérience à adapter.",
  noName: "Renseigne d'abord ton prénom et ton nom dans Mon profil : ils signent la lettre.",
  cvLimit: "Tu as atteint le nombre maximum de CV : supprimes-en un dans le CV Builder.",
  openLetter: "Ouvrir la lettre",
  openFiche: "Voir la fiche",
  openCv: "Ouvrir le CV adapté",
  openLinkedCv: "Ouvrir le CV lié",
  cvBuilder: "CV Builder",
  profile: "Mon profil",
  premium: "Voir Premium",
} as const;
