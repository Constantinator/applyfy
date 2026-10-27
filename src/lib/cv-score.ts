import type { CvData, CvExperience } from "./cv-builder-types";
import type { Sector } from "./cv-sector-context";
import { hasPhrase, matchKeywords, normalizeText } from "./keyword-match";

// Score du CV sur 100, calculé par le code à partir de son contenu (sans IA), dans l'éditeur du
// CV Builder (recalculé à chaque modification) et à l'import. Cinq catégories : impact 35,
// contenu 25, mots-clés 20, concision 10, forme 10. Chaque règle ratée produit une correction :
// message court, élément concerné, points à gagner et demande prête à envoyer au coach.

/** Données du secteur utiles au score (lues côté serveur dans la base de connaissance). */
export type ScoringContext = {
  sector: Sector;
  sectorName: string;
  atsKeywords: string[];
  actionVerbs: string[];
  avoid: string[];
  /** Mots-clés les plus fréquents des offres récentes du secteur (job_keywords), s'il y en a. */
  marketKeywords: string[];
};

export const SCORE_CATEGORIES = [
  { id: "impact", label: "Impact", max: 35 },
  { id: "content", label: "Contenu", max: 25 },
  { id: "keywords", label: "Mots-clés", max: 20 },
  { id: "concision", label: "Concision", max: 10 },
  { id: "form", label: "Forme", max: 10 },
] as const;
export type ScoreCategoryId = (typeof SCORE_CATEGORIES)[number]["id"];

export type CvCorrection = {
  category: ScoreCategoryId;
  /** Id de l'élément concerné (expérience, formation, projet), « summary », « personal » ou null. */
  elementId: string | null;
  message: string;
  /** Points gagnés en corrigeant ce point (arrondis, au moins 1). */
  points: number;
  /** Demande envoyée au coach d'un clic. */
  request: string;
};

export type CvScore = {
  score: number;
  categories: { id: ScoreCategoryId; label: string; max: number; score: number }[];
  /** Corrections, de celle qui rapporte le plus à celle qui rapporte le moins. */
  corrections: CvCorrection[];
};

/** Score à partir duquel le CV est prêt à postuler. */
export const READY_SCORE = 90;

/** Couleur du score : rouge sous 70, orange de 70 à 89, vert à partir de 90. */
export function scoreTone(score: number): "red" | "orange" | "green" {
  if (score >= READY_SCORE) return "green";
  return score >= 70 ? "orange" : "red";
}

/** Jargon vague refusé dans les points du CV (aussi interdit au coach, dans son prompt). */
export const GENERIC_JARGON = ["dynamique", "polyvalent", "force de proposition", "diverses missions"];

/** Verbes d'action courants (FR et EN), en plus de ceux du secteur. */
const GENERAL_VERBS = [
  "piloter", "gérer", "encadrer", "manager", "diriger", "créer", "concevoir", "développer", "lancer", "mettre en place",
  "mis en place", "conduire", "conduit", "réaliser", "organiser", "coordonner", "superviser", "optimiser", "améliorer",
  "augmenter", "réduire", "accroître", "accru", "générer", "négocier", "déployer", "implémenter", "automatiser",
  "analyser", "structurer", "former", "recruter", "accompagner", "conseiller", "rédiger", "présenter", "animer",
  "construire", "élaborer", "définir", "obtenir", "obtenu", "atteindre", "atteint", "dépasser", "remporter", "signer",
  "fidéliser", "prospecter", "vendre", "vendu", "produire", "produit", "refondre", "migrer", "intégrer", "sécuriser",
  "tester", "modéliser", "auditer", "planifier", "prioriser", "transformer", "moderniser", "standardiser", "digitaliser",
  "sélectionner",
  "lead", "led", "manage", "build", "built", "create", "design", "develop", "launch", "deliver", "drive", "drove",
  "increase", "reduce", "grow", "grew", "improve", "implement", "automate", "analyze", "analyse", "negotiate",
  "coordinate", "organize", "supervise", "own", "ship", "scale", "optimize", "generate", "close", "win", "won", "train",
  "mentor", "hire", "write", "wrote", "produce", "run", "ran",
];

/**
 * Noms d'action courants en tête de puce, à la française (« Pilotage », « Gestion »,
 * « Reporting »…) : comptent comme des verbes d'action. Les formes régulières (« Pilotage »,
 * « Organisation ») sont déjà trouvées par le radical du verbe ; celles-ci ne le sont pas.
 */
const ACTION_NOUNS = [
  "gestion", "direction", "rédaction", "coordination", "conception", "création", "vente", "reporting", "suivi",
  "mise en place", "conseil", "pilotage", "organisation", "accompagnement", "encadrement", "management", "animation",
  "prospection", "négociation", "développement", "lancement", "analyse", "audit", "refonte", "migration", "déploiement",
  "optimisation", "automatisation", "supervision", "formation", "recrutement", "élaboration", "définition", "réalisation",
  "production", "construction", "réduction", "amélioration", "augmentation", "administration", "implémentation",
  "conduite", "veille", "budgétisation", "planification", "coaching", "mentorat", "tutorat",
];

/**
 * Formes nominales irrégulières d'un verbe (le radical ne les trouve pas) : « réduire » →
 * « réduction », « déployer » → « déploiement », « créer » → « création », « coordonner » →
 * « coordination », « sélectionner » → « sélection ».
 */
function nominalForms(verb: string): string[] {
  const w = firstWord(verb);
  if (w.endsWith("uire")) return [`${w.slice(0, -4)}uction`];
  if (w.endsWith("yer")) return [`${w.slice(0, -3)}iement`];
  if (w.endsWith("eer")) return [`${w.slice(0, -2)}ation`];
  if (w.endsWith("ionner")) return [w.slice(0, -3)];
  if (w.endsWith("onner")) return [`${w.slice(0, -5)}ination`];
  return [];
}

const POINTS = {
  figures: 20,
  verbs: 15,
  bulletCount: 8,
  pronouns: 5,
  jargon: 7,
  repeatedVerbs: 5,
  keywords: 20,
  words: 6,
  longBullets: 4,
  dates: 4,
  email: 3,
  essentials: 3,
};
/** Mots-clés à trouver dans le CV pour la note maximale. */
const KEYWORDS_TARGET = 10;
const WORDS_MIN = 400;
const WORDS_MAX = 1600;
const BULLET_MAX_WORDS = 30;

/** Texte sans la mise en forme de l'éditeur (**gras**, *italique*, __souligné__). */
const plain = (text: string) => text.replace(/\*\*|__|\*/g, "").trim();
const wordCount = (text: string) => plain(text).split(/\s+/).filter(Boolean).length;

/** Premier mot, normalisé (sans accents, minuscules). */
const firstWord = (text: string) => normalizeText(text).trim().split(/[ ,;:.()/-]/)[0] ?? "";

/** Radical d'un verbe : « Piloter » → « pilot » (trouve « Piloté », « Pilotage »), « Manage » → « manag ». */
function verbStem(verb: string) {
  const w = firstWord(verb);
  if (w.length > 4 && /(er|ir|re)$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) return w.slice(0, -1);
  return w;
}

/** Contient un chiffre (nombre, %, €, durée, effectif), sans compter une année seule. */
const hasFigure = (text: string) => /\d/.test(text.replace(/\b(19|20)\d{2}\b/g, ""));

const PRONOUNS = /(^| )(je|mon|ma|mes)( |$)|(^| )j'/;

const MONTHS: [RegExp, number][] = [
  [/^(janv|jan)/, 1], [/^(fevr|fev|feb)/, 2], [/^mar/, 3], [/^(avr|apr)/, 4], [/^(mai|may)/, 5], [/^(juin|jun)/, 6],
  [/^(juil|jul)/, 7], [/^(aout|aug)/, 8], [/^sep/, 9], [/^oct/, 10], [/^nov/, 11], [/^(dec)/, 12],
];

type ParsedDate = { year: number; month: number | null };

/** « Sept. 2021 », « 09/2021 », « 2021 » ; null si la date est absente ou illisible. */
function parseDate(value: string): ParsedDate | null {
  const text = normalizeText(value).trim();
  const year = text.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const numeric = text.match(/\b(0?[1-9]|1[0-2])\s*[/.-]\s*(19|20)\d{2}\b/);
  if (numeric) return { year: Number(year[0]), month: Number(numeric[1]) };
  const word = text.slice(0, year.index).trim().split(/\s+/).pop() ?? "";
  const month = MONTHS.find(([pattern]) => pattern.test(word))?.[1] ?? null;
  return { year: Number(year[0]), month };
}

const isOngoing = (value: string) => /aujourd|present|en cours|actuel|current|now|ce jour/.test(normalizeText(value));

function experienceLabel(e: CvExperience) {
  const position = plain(e.position);
  const company = plain(e.company);
  if (position && company) return `${position} chez ${company}`;
  return position || company || "sans intitulé";
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function scoreCv(data: CvData, context: ScoringContext): CvScore {
  const corrections: CvCorrection[] = [];
  const totals: Record<ScoreCategoryId, number> = { impact: 0, content: 0, keywords: 0, concision: 0, form: 0 };
  const lose = (category: ScoreCategoryId, points: number, correction: Omit<CvCorrection, "category" | "points">) => {
    if (points >= 0.5) corrections.push({ category, points: Math.max(1, Math.round(points)), ...correction });
  };

  const experiences = data.experiences.filter((e) => plain(e.position) || plain(e.company) || e.bullets.some((b) => plain(b)));
  const bullets = experiences.flatMap((e) => e.bullets.map(plain).filter(Boolean).map((text) => ({ experience: e, text })));

  // --- Impact (35) : chiffres, verbes d'action (ou noms d'action : « Pilotage », « Gestion ») ---
  const verbs = [...context.actionVerbs, ...GENERAL_VERBS];
  const stems = [
    ...new Set([...verbs, ...verbs.flatMap(nominalForms), ...ACTION_NOUNS].map(verbStem).filter((s) => s.length >= 3)),
  ];
  const isAction = (text: string) => {
    const word = firstWord(text);
    return stems.some((s) => word.startsWith(s) && (s.length >= 4 || word.length <= s.length + 3));
  };
  if (!bullets.length) {
    lose("impact", POINTS.figures + POINTS.verbs, {
      elementId: null,
      message: "Ajoute des expériences décrites en quelques puces",
      request: "Aide-moi à décrire mes expériences en puces orientées résultats",
    });
  } else {
    const perBullet = { figures: POINTS.figures / bullets.length, verbs: POINTS.verbs / bullets.length };
    totals.impact += perBullet.figures * bullets.filter((b) => hasFigure(b.text)).length;
    totals.impact += perBullet.verbs * bullets.filter((b) => isAction(b.text)).length;
    for (const e of experiences) {
      const own = bullets.filter((b) => b.experience === e);
      const noFigure = own.filter((b) => !hasFigure(b.text)).length;
      const noVerb = own.filter((b) => !isAction(b.text)).length;
      const label = experienceLabel(e);
      if (noFigure)
        lose("impact", noFigure * perBullet.figures, {
          elementId: e.id,
          message: `${plural(noFigure, "puce")} sans chiffre — ${label}`,
          request: `Aide-moi à ajouter des résultats chiffrés à mon expérience ${label}`,
        });
      if (noVerb)
        lose("impact", noVerb * perBullet.verbs, {
          elementId: e.id,
          message: `${plural(noVerb, "puce")} sans verbe d'action en tête — ${label}`,
          request: `Reformule les puces de mon expérience ${label} pour qu'elles commencent par un verbe d'action`,
        });
    }
  }

  // --- Contenu (25) : 3 à 6 puces, pas de « je », pas de jargon, verbes variés -----------------
  if (!experiences.length) {
    lose("content", POINTS.bulletCount, {
      elementId: null,
      message: "Ajoute au moins une expérience (stage, job, projet)",
      request: "Aide-moi à ajouter une expérience à mon CV",
    });
  } else {
    for (const e of experiences) {
      const count = e.bullets.map(plain).filter(Boolean).length;
      if (count >= 3 && count <= 6) totals.content += POINTS.bulletCount / experiences.length;
      else {
        const label = experienceLabel(e);
        lose("content", POINTS.bulletCount / experiences.length, {
          elementId: e.id,
          message: count < 3 ? `${plural(count, "puce")} seulement (vise 3 à 6) — ${label}` : `${count} puces (6 maximum) — ${label}`,
          request:
            count < 3
              ? `Aide-moi à compléter mon expérience ${label} avec 3 à 6 puces`
              : `Resserre mon expérience ${label} en 6 puces maximum`,
        });
      }
    }
  }

  // Textes rédigés : accroche, puces de chaque expérience, projets.
  const texts = [
    { id: "summary", where: "mon accroche", text: plain(data.summary) },
    ...experiences.map((e) => ({ id: e.id, where: `mon expérience ${experienceLabel(e)}`, text: e.bullets.map(plain).join("\n") })),
    ...data.projects.map((p) => ({ id: p.id, where: `mon projet ${plain(p.name)}`, text: plain(p.description) })),
  ].filter((t) => t.text);

  // Règles « sans défaut » : points accordés seulement s'il y a du texte (un CV vide n'a rien de bon).
  const withPronouns = texts.filter((t) => PRONOUNS.test(normalizeText(t.text)));
  const pronounPenalty = Math.min(POINTS.pronouns, 2 * withPronouns.length);
  if (texts.length) totals.content += POINTS.pronouns - pronounPenalty;
  for (const t of withPronouns)
    lose("content", pronounPenalty / withPronouns.length, {
      elementId: t.id,
      message: `« je / mon / mes » dans ${t.where.replace(/^mon |^ma /, "ton ")}`,
      request: `Retire « je », « mon » et « mes » de ${t.where}`,
    });

  const banned = [...new Set([...context.avoid, ...GENERIC_JARGON])];
  const jargon = texts.flatMap((t) => {
    const normalized = normalizeText(t.text);
    const found = banned.filter((phrase) => hasPhrase(normalized, phrase));
    return found.length ? [{ ...t, found }] : [];
  });
  const jargonCount = jargon.reduce((n, t) => n + t.found.length, 0);
  const jargonPenalty = Math.min(POINTS.jargon, 2 * jargonCount);
  if (texts.length) totals.content += POINTS.jargon - jargonPenalty;
  for (const t of jargon)
    lose("content", (jargonPenalty * t.found.length) / jargonCount, {
      elementId: t.id,
      message: `Formule creuse « ${t.found[0]} » dans ${t.where.replace(/^mon |^ma /, "ton ")}`,
      request: `Remplace ${t.found.map((f) => `« ${f} »`).join(", ")} par des faits concrets dans ${t.where}`,
    });

  // Même verbe en tête de puce plus de 2 fois : radical commun (« Piloté », « Pilotage »).
  const starts = new Map<string, { word: string; count: number }>();
  for (const b of bullets) {
    const word = firstWord(b.text);
    if (word.length < 3) continue;
    const key = word.slice(0, 6);
    starts.set(key, { word: starts.get(key)?.word ?? plain(b.text).split(/\s+/)[0], count: (starts.get(key)?.count ?? 0) + 1 });
  }
  const repeated = [...starts.values()].filter((s) => s.count > 2);
  const excess = repeated.reduce((n, s) => n + s.count - 2, 0);
  const repeatPenalty = Math.min(POINTS.repeatedVerbs, 1.5 * excess);
  if (bullets.length) totals.content += POINTS.repeatedVerbs - repeatPenalty;
  for (const s of repeated)
    lose("content", (repeatPenalty * (s.count - 2)) / excess, {
      elementId: null,
      message: `« ${s.word} » commence ${s.count} puces (2 maximum)`,
      request: `Varie les verbes en début de puce : « ${s.word} » revient ${s.count} fois`,
    });

  // --- Mots-clés (20) : base sectorielle et offres récentes ------------------------------------
  const cvText = [
    data.personal.jobTitle,
    data.summary,
    ...data.experiences.flatMap((e) => [e.position, ...e.bullets]),
    ...data.education.map((e) => `${e.degree} ${e.school}`),
    ...data.skills.map((s) => s.name),
    ...data.certifications.map((c) => c.name),
    ...data.projects.map((p) => `${p.name} ${p.description}`),
  ]
    .map(plain)
    .join("\n");
  const seen = new Set<string>();
  const keywords = [...context.marketKeywords, ...context.atsKeywords].filter((k) => {
    const key = normalizeText(k).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const found = new Set(matchKeywords(cvText, keywords, context.sector).map((k) => normalizeText(k).trim()));
  totals.keywords += POINTS.keywords * Math.min(1, found.size / KEYWORDS_TARGET);
  if (found.size < KEYWORDS_TARGET) {
    const missing = keywords.filter((k) => !found.has(normalizeText(k).trim())).slice(0, 5);
    lose("keywords", POINTS.keywords - totals.keywords, {
      elementId: null,
      message: `${found.size} ${found.size > 1 ? "mots-clés" : "mot-clé"} du métier sur ${KEYWORDS_TARGET} visés (${context.sectorName})`,
      request: `Ajoute à mon CV les mots-clés du métier que je maîtrise vraiment, par exemple : ${missing.join(", ")}`,
    });
  }

  // --- Concision (10) : 400 à 1 600 mots, puces courtes -----------------------------------------
  const words = wordCount(
    [
      data.personal.jobTitle,
      data.summary,
      ...data.experiences.flatMap((e) => [e.position, e.company, ...e.bullets]),
      ...data.education.flatMap((e) => [e.degree, e.school, e.honors]),
      ...data.skills.map((s) => s.name),
      ...data.languages.map((l) => `${l.name} ${l.level}`),
      ...data.certifications.map((c) => c.name),
      ...data.projects.map((p) => `${p.name} ${p.description}`),
      data.interests,
    ].join(" "),
  );
  const wordRatio = words < WORDS_MIN ? words / WORDS_MIN : words > WORDS_MAX ? WORDS_MAX / words : 1;
  totals.concision += POINTS.words * wordRatio;
  if (wordRatio < 1)
    lose("concision", POINTS.words * (1 - wordRatio), {
      elementId: null,
      message: `${words} mots : ${words < WORDS_MIN ? "trop court" : "trop long"} (vise ${WORDS_MIN} à 1 600)`,
      request: words < WORDS_MIN ? "Mon CV est trop court : aide-moi à le développer" : "Mon CV est trop long : aide-moi à le raccourcir",
    });

  const longBullets = bullets.filter((b) => wordCount(b.text) > BULLET_MAX_WORDS);
  if (bullets.length) totals.concision += POINTS.longBullets * (1 - longBullets.length / bullets.length);
  for (const e of experiences) {
    const count = longBullets.filter((b) => b.experience === e).length;
    if (count)
      lose("concision", (POINTS.longBullets * count) / bullets.length, {
        elementId: e.id,
        message: `${plural(count, "puce")} de plus de ${BULLET_MAX_WORDS} mots — ${experienceLabel(e)}`,
        request: `Raccourcis les puces trop longues de mon expérience ${experienceLabel(e)}`,
      });
  }

  // --- Forme (10) : dates, email, rubriques essentielles ----------------------------------------
  // Expériences : mois et année exigés ; formations : l'année seule suffit (usage français).
  const dated = [
    ...experiences.map((e) => {
      const start = parseDate(e.startDate);
      const ongoing = e.current || isOngoing(e.endDate);
      const end = ongoing ? null : parseDate(e.endDate);
      const precise = Boolean(start?.month && (ongoing || end?.month));
      const ordered = !start || !end || start.year * 12 + (start.month ?? 1) <= end.year * 12 + (end.month ?? 12);
      const label = experienceLabel(e);
      return {
        id: e.id,
        ok: precise && ordered,
        message: !precise ? `Dates sans mois ou incomplètes — ${label}` : `Date de fin avant la date de début — ${label}`,
        request: !precise
          ? `Précise le mois et l'année de début et de fin de mon expérience ${label}`
          : `Corrige les dates de mon expérience ${label} : la fin est avant le début`,
      };
    }),
    ...data.education
      .filter((e) => plain(e.degree) || plain(e.school))
      .map((e) => {
        const start = parseDate(e.startDate);
        const end = parseDate(e.endDate);
        const label = plain(e.degree) || plain(e.school);
        const ordered = !start || !end || start.year <= end.year;
        return {
          id: e.id,
          ok: Boolean(start || end) && ordered,
          message: !(start || end) ? `Formation sans date — ${label}` : `Dates dans le désordre — ${label}`,
          request: `Ajoute ou corrige l'année de ma formation ${label}`,
        };
      }),
  ];
  if (dated.length) {
    const perItem = POINTS.dates / dated.length;
    for (const d of dated) {
      if (d.ok) totals.form += perItem;
      else lose("form", perItem, { elementId: d.id, message: d.message, request: d.request });
    }
  }

  const email = data.personal.email.trim();
  const local = normalizeText(email.split("@")[0] ?? "").replace(/[^a-z]/g, "");
  const names = [data.personal.firstName, data.personal.lastName]
    .map((n) => normalizeText(n).replace(/[^a-z]/g, ""))
    .filter((n) => n.length >= 2);
  const validEmail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  if (validEmail && (!names.length || names.some((n) => local.includes(n)))) totals.form += POINTS.email;
  else
    lose("form", POINTS.email, {
      elementId: "personal",
      message: !email ? "Ajoute ton adresse email" : validEmail ? "Email peu professionnel : utilise ton prénom et ton nom" : "Adresse email invalide",
      request: "Aide-moi à mettre une adresse email professionnelle (prénom.nom) sur mon CV",
    });

  const essentials = [
    { ok: Boolean(plain(data.personal.firstName) || plain(data.personal.lastName)), name: "ton nom", request: "Ajoute mon nom en haut du CV" },
    { ok: Boolean(email || data.personal.phone.trim()), name: "un contact (email ou téléphone)", request: "Ajoute mes coordonnées à mon CV" },
    { ok: Boolean(plain(data.personal.jobTitle)), name: "un titre de CV (poste visé)", request: "Propose un titre de CV adapté au poste que je vise" },
    { ok: experiences.length > 0 || data.education.length > 0, name: "une expérience ou une formation", request: "Aide-moi à ajouter mes expériences et ma formation" },
    { ok: data.skills.some((s) => plain(s.name)), name: "des compétences", request: "Aide-moi à ajouter une rubrique compétences à mon CV" },
  ];
  const perEssential = POINTS.essentials / essentials.length;
  for (const e of essentials) {
    if (e.ok) totals.form += perEssential;
    else lose("form", perEssential, { elementId: "personal", message: `Rubrique manquante : ${e.name}`, request: e.request });
  }

  const categories = SCORE_CATEGORIES.map((c) => ({ ...c, score: Math.round(Math.min(c.max, totals[c.id])) }));
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return {
    score: Math.max(0, Math.min(100, Math.round(total))),
    categories,
    corrections: corrections.sort((a, b) => b.points - a.points),
  };
}
