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
  /** Carte « À faire aujourd'hui » sans candidature (Lumeo « salue » à côté). */
  todoEmpty: "Ajoute l'offre qui t'intéresse. Je t'aide à adapter ton CV, écrire ta lettre et relancer au bon moment.",
  later: "Plus tard",
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
  /** Bouton de la boîte « Relancer » (lot 3a) : ouvre la carte de confirmation de Lumeo. */
  improveRelance: "Améliorer avec Lumeo",
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
  units: { lettre: "lettre", resume_offre: "résumé d'offre", adaptation_cv: "adaptation à une offre", relance: "question à Lumeo" },
  // Relance (lot 3a) : réécriture du message de la boîte « Relancer », jamais envoyée.
  cardRelance: ({ position, company }: Target) =>
    `Rendre ta relance pour « ${position} » chez ${company} plus chaleureuse et plus personnelle, sans rien inventer. Rien n'est envoyé : tu copies le texte.`,
  relanceQuotaPanel: (daily: number) => `Déjà comptée dans ta question à Lumeo ; compte dans les ${daily} actions IA du jour.`,
  relanceQuotaBox: (left: number, limit: number) => `Utilise 1 question à Lumeo (il t'en reste ${left} sur ${limit} aujourd'hui).`,
  relanceQuotaBoxPremium: (daily: number) => `Pas de limite de questions ; compte dans les ${daily} actions IA du jour.`,
  coachReached: (limit: number) => `Tu as posé tes ${limit} questions à Lumeo aujourd'hui. Ça repart demain à minuit.`,
  relanceStatus: "Une relance n'a de sens qu'une fois la candidature envoyée (statut Envoyée, En attente ou Relancée).",
  relanceNoDate: "Indique d'abord la date d'envoi de la candidature sur sa fiche.",
  relanceTooLong: (max: number) => `Ton message est trop long pour que je le retravaille (${max} caractères au plus). Raccourcis-le dans la boîte Relancer.`,
  relanceIntro: "Je peux retravailler ta relance pour qu'elle sonne plus naturelle, sans rien inventer. Confirme si tu veux.",
  relanceDone: "Voici ta relance retravaillée. Relis-la avant de l'envoyer toi-même.",
  draftLabel: "Relance retravaillée",
  copy: "Copier",
  copied: "Copié ✓",
  putInBox: "Mettre dans la boîte Relancer",
  putDone: "C'est dans la boîte Relancer. « Réinitialiser » ramène le message d'origine.",
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

/**
 * Bloc « Ton temps par candidature » de la page Beta testing (cf. lib/beta-time-saving).
 * Voix de Lumeo : tutoiement, phrases courtes, sans emoji. Aucun chiffre écrit ici : le gain
 * affiché est toujours calculé à partir des réponses.
 */
export const BETA_TIME_TEXTS = {
  title: "Ton temps par candidature",
  intro: "Deux questions. Tes réponses nous aident à mesurer ce qu'Applyfy te fait gagner.",
  help: "Compte tout : lire l'offre, adapter ton CV, écrire ta lettre, envoyer.",
  before: "Avant Applyfy, combien de temps te prenait une candidature ?",
  after: "Avec Applyfy, combien de temps te prend-elle ?",
  unit: "minutes",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "C'est noté. Tu peux modifier tes réponses quand tu veux.",
  gain: (percent: number) => `Tu gagnes environ ${percent} % de temps par candidature.`,
  noGain: "Pas encore de temps gagné. Dis-nous ce qui te ralentit dans les messages.",
  negative: "Applyfy te prend plus de temps qu'avant. Dis-nous pourquoi dans les messages.",
  needApplication: "Ajoute d'abord une candidature pour répondre.",
  addApplication: "Ajouter une candidature",
  error: "L'enregistrement a échoué. Réessaie dans un instant.",
} as const;

/**
 * Parcours d'accueil (/bienvenue, cf. lib/onboarding). Voix de Lumeo : tutoiement, phrases
 * courtes, sans emoji, aucun chiffre écrit ici (la note d'import lit AI_MONTHLY_LIMITS).
 */
export const ONBOARDING_TEXTS = {
  pageTitle: "Bienvenue",
  skip: "Passer",
  skipLabel: "Passer cet écran",
  progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
  lumeo: "Lumeo",
  accueil: {
    title: (firstName: string | null) => (firstName ? `Salut ${firstName}, moi c'est Lumeo.` : "Salut, moi c'est Lumeo."),
    question: "Tu cherches un job en ce moment ?",
    oui: { title: "Oui, je cherche", detail: "Je t'aide à postuler plus vite." },
    pasEncore: { title: "Pas encore", detail: "On prépare le terrain ensemble." },
    note: "Ça me sert à te proposer la bonne suite.",
  },
  apport: {
    title: "Applyfy t'aide à postuler sans te perdre.",
    items: [
      { key: "suivi", title: "Suivre tes candidatures", detail: "Toutes au même endroit, avec leur statut.", soon: false },
      { key: "cv", title: "Améliorer ton CV et tes lettres", detail: "Je te pose les bonnes questions, sans rien inventer.", soon: false },
      { key: "remplir", title: "Remplir tes candidatures", detail: "Une extension remplit les champs à ta place.", soon: true },
    ],
    soon: "Bientôt",
  },
  temps: {
    title: "Applyfy t'aide à gagner du temps sur chaque candidature.",
    detail: "Ton CV, tes lettres et ton suivi au même endroit.",
  },
  cv: {
    title: "Tu as déjà un CV ?",
    subtitle: "Je pars de lui pour te donner des conseils précis.",
    add: { title: "Ajouter mon CV", badge: "Conseillé", detail: "Import (PDF ou Word) ou création guidée." },
    later: { title: "Plus tard", detail: "On commence par une offre." },
    importNote: (imports: number) => `Gratuit : ${imports} import${imports > 1 ? "s" : ""} de CV par mois.`,
  },
  cheminCv: {
    title: "On part de ton CV.",
    subtitle: "Importe-le, ou on le construit ensemble, question par question.",
    import: { title: "Importer mon CV", detail: (maxSize: string) => `PDF ou Word, ${maxSize} max.` },
    zero: { title: "Le créer de zéro", detail: "Je te guide pas à pas." },
    note: "Tu pourras tout modifier ensuite.",
  },
  cheminOffre: {
    title: "Quelle offre t'intéresse ?",
    subtitle: "Colle le lien, je remplis la fiche pour toi.",
    label: "Lien de l'offre",
    placeholder: "https://…",
    submit: "Ajouter l'offre",
    empty: "Colle le lien de l'offre pour l'ajouter.",
    invalid: "Ce lien n'est pas valide. Il doit commencer par https://",
    searchIntro: "Pas d'offre sous la main ?",
    search: "Trouver une offre",
  },
  continue: "Continuer",
} as const;

/**
 * Écran de limite du coach (plan gratuit, cf. components/lumeo/coach-limit-screen). Voix de Lumeo :
 * tutoiement, phrases courtes, sans emoji ; le nombre de questions est lu dans CVB_COACH_DAILY_LIMIT.
 */
export const COACH_LIMIT_TEXTS = {
  title: (limit: number) => `Tu as utilisé tes ${limit} questions du jour.`,
  subtitle: "Ton quota quotidien est atteint. Il se renouvelle demain, ou tout de suite avec Premium.",
  later: "Plus tard, je continue sans",
  footer: "Pas de panique, ton CV t'attend.",
} as const;

/**
 * Phase guidée du CV Builder (chemin A du parcours d'accueil). Voix de Lumeo : tutoiement,
 * phrases courtes, sans emoji, aucun chiffre écrit ici.
 */
export const GUIDE_TEXTS = {
  stepsLabel: "Étapes de ton installation",
  steps: ["Améliore ton CV", "Ajoute une offre"],
  done: "fait",
  skip: "Passer",
  skipLabel: "Passer et aller au tableau de bord",
  suggestions: ["Améliorer mon profil", "Reformuler mes expériences", "Vérifier les mots-clés"],
  placeholder: "Pose ta question à Lumeo",
  /** Bouton noir de l'éditeur guidé : enregistre, puis écran « Bravo » (pas de PDF). */
  continue: "Continuer",
  saving: "Enregistrement…",
  saveError: "Ton CV n'a pas pu être enregistré. Réessaie dans un instant.",
  /** Écran « Bravo » (après « Continuer » dans l'éditeur, avant l'écran de l'offre). */
  bravo: {
    title: "Bravo, tu as fini ton premier CV.",
    subtitle: "Et si on cherchait ta première candidature ?",
    continue: "Continuer",
    note: "Ton CV est enregistré. Tu pourras le télécharger plus tard dans le CV Builder.",
  },
  /** Import pendant la phase guidée : le stepper de l'import, détail de l'étape 1. */
  importStepLabel: "Étape 1 · importer ton CV",
  /** Import impossible (quota du mois, erreur) : l'autre façon de faire, sans Premium. */
  createFromScratch: "Le créer de zéro",
  importLimit: "Ton import de CV du mois est déjà utilisé. Tu peux créer ton CV de zéro, je te guide pas à pas.",
  /** Écran de l'offre (étape 2) : titre, champ et liens repris du chemin B (ONBOARDING_TEXTS.cheminOffre). */
  offerNote: "Ensuite, on pourra adapter ton CV à cette offre.",
  offerLater: "Plus tard, aller au tableau de bord",
} as const;

/**
 * Bandeau de Lumeo sur la fiche de la candidature ajoutée pendant la phase guidée (une seule
 * fois). Le nombre d'adaptations est lu dans AI_MONTHLY_LIMITS.cvb_chat.
 */
export const GUIDE_BANNER_TEXTS = {
  label: "Lumeo",
  title: "Bien joué. Je peux adapter ton CV à cette offre, ou te préparer une lettre. Tu choisis.",
  adapt: "Adapter mon CV",
  letter: "Écrire ma lettre",
  later: "Plus tard",
  close: "Fermer",
  freeNote: (adaptations: number) => `Gratuit : ${adaptations} adaptation${adaptations > 1 ? "s" : ""} par mois.`,
} as const;

/** « Trouver une offre » : recommandations sans résultat, dernières offres affichées à la place (Lumeo « réfléchit »). */
export const OFFERS_LUMEO_TEXTS = {
  recoEmpty: "Je n'ai rien trouvé qui te corresponde pour l'instant. Voici les dernières offres publiées.",
} as const;
