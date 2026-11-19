import { CvDataSchema, type CvData, type CvLang } from "./cv-builder-types";
import type { AccountName } from "./person-name";

// Vignettes du sélecteur de modèle : le vrai CV de la personne, réduit à ce qui peut remplir la page 1,
// rendu en HTML dans le navigateur (jamais envoyé ailleurs), mis à jour 400 ms après la dernière
// modification qui change ce qui est dessiné.

/** Délai entre la dernière modification et la mise à jour des vignettes. */
export const THUMBNAIL_DELAY_MS = 400;

/**
 * Marque d'une barre grise (caractère d'usage privé, jamais saisi) : « xxxx » est dessiné par
 * l'aperçu HTML comme une barre grise de la largeur du mot, sans texte visible. Seulement dans les vignettes.
 */
export const PLACEHOLDER_MARK = "";

/** Barre grise de `words` mots (longueurs fixes : rien d'aléatoire, même rendu à chaque fois). */
const bars = (...lengths: number[]) => lengths.map((n) => PLACEHOLDER_MARK + "x".repeat(n)).join(" ");

/** Au plus ce qui peut tenir sur la page 1 (large : la page est toujours remplie, le reste est coupé). */
const PAGE_ONE = { experiences: 4, bullets: 4, bullet: 300, education: 3, skills: 12, languages: 5, certifications: 4, projects: 2, summary: 700, interests: 200, description: 300 };

const filled = (s: string) => s.trim().length > 0;

/** Rubriques remplies (résumé, expériences, formation, compétences, langues, certifications, projets, centres d'intérêt). */
function filledSections(data: CvData) {
  return [
    filled(data.summary),
    data.experiences.some((e) => filled(e.position) || filled(e.company) || e.bullets.some(filled)),
    data.education.some((e) => filled(e.school) || filled(e.degree)),
    data.skills.some((s) => filled(s.name)),
    data.languages.some((l) => filled(l.name)),
    data.certifications.some((c) => filled(c.name)),
    data.projects.some((p) => filled(p.name) || filled(p.description)),
    filled(data.interests),
  ].filter(Boolean).length;
}

/** Moins de 2 rubriques remplies : la vignette complète les rubriques vides par des barres grises. */
export const isNearlyEmpty = (data: CvData) => filledSections(data) < 2;

/** CV réduit à la page 1, débarrassé de ce qui n'est pas dessiné (analyse, coach, poste visé). */
function pageOne(data: CvData): CvData {
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
  return {
    ...data,
    summary: cut(data.summary, PAGE_ONE.summary),
    experiences: data.experiences
      .slice(0, PAGE_ONE.experiences)
      .map((e) => ({ ...e, bullets: e.bullets.slice(0, PAGE_ONE.bullets).map((b) => cut(b, PAGE_ONE.bullet)) })),
    education: data.education.slice(0, PAGE_ONE.education).map((e) => ({ ...e, bullets: e.bullets.slice(0, 2) })),
    skills: data.skills.slice(0, PAGE_ONE.skills),
    languages: data.languages.slice(0, PAGE_ONE.languages),
    certifications: data.certifications.slice(0, PAGE_ONE.certifications),
    projects: data.projects.slice(0, PAGE_ONE.projects).map((p) => ({ ...p, description: cut(p.description, PAGE_ONE.description) })),
    interests: cut(data.interests, PAGE_ONE.interests),
    analysis: null,
    coach: null,
    targetJob: "",
    origin: undefined,
  };
}

/** Rubriques vides remplacées par des barres grises ; nom, poste, coordonnées et photo : seulement les vrais. */
function withBars(data: CvData): CvData {
  const p = data.personal;
  const bullet = (i: number) => bars(...[[9, 6, 11, 7, 8], [7, 10, 5, 9], [10, 8, 6, 7, 5]][i % 3]);
  return {
    ...data,
    personal: {
      ...p,
      firstName: filled(p.firstName) || filled(p.lastName) ? p.firstName : bars(7),
      lastName: filled(p.firstName) || filled(p.lastName) ? p.lastName : bars(9),
      jobTitle: filled(p.jobTitle) ? p.jobTitle : bars(10, 8),
    },
    summary: filled(data.summary) ? data.summary : bars(8, 6, 10, 7, 9, 5, 8, 11, 6, 7, 9, 8, 6, 10),
    experiences: data.experiences.length
      ? data.experiences
      : [0, 1].map((i) => ({ id: `bar-x${i}`, position: bars(9, 7), company: bars(10), location: "", startDate: "", endDate: "", current: false, bullets: [0, 1, 2].map((j) => bullet(i + j)) })),
    education: data.education.length
      ? data.education
      : [{ id: "bar-e", school: bars(11), degree: bars(8, 9), startDate: "", endDate: "", honors: "", bullets: [] }],
    skills: data.skills.length ? data.skills : [6, 9, 5, 8, 7].map((n, i) => ({ id: `bar-s${i}`, name: bars(n), level: "" as const })),
    languages: data.languages.length ? data.languages : [7, 6].map((n, i) => ({ id: `bar-l${i}`, name: bars(n), level: "" })),
  };
}

/** Données d'une vignette : le CV réduit à la page 1 ; presque vide, complété par des barres grises. */
export function thumbnailData(data: CvData): CvData {
  const reduced = pageOne(data);
  return isNearlyEmpty(reduced) ? withBars(reduced) : reduced;
}

/**
 * CV des vignettes de « Créer un CV depuis zéro » : le prénom et le nom du compte (s'ils sont connus) et
 * le poste visé saisi à l'étape 1, comme dans le CV qui sera créé ; le reste en barres grises.
 */
export function newCvPreviewData(name: AccountName | null, targetJob: string): CvData {
  return CvDataSchema.parse({
    personal: { firstName: name?.firstName ?? "", lastName: name?.lastName ?? "", jobTitle: targetJob.trim() },
  });
}

/** Empreinte courte d'une chaîne (FNV-1a), pour la photo : la clé ne la recopie pas. */
function fingerprint(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Clé de ce qui est dessiné : elle ne change que si une vignette doit changer. */
export function thumbnailKey(data: CvData, language: CvLang) {
  const photo = data.personal.photo;
  return JSON.stringify([language, { ...data, personal: { ...data.personal, photo: photo ? fingerprint(photo) : null } }]);
}

/**
 * Carte visée par une touche dans le groupe de modèles (boutons radio) : flèches en boucle, Début, Fin ;
 * null pour les autres touches.
 */
export function radioKeyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Mise à jour différée : `push` (clé, valeur) à chaque modification ; `onCommit` n'est appelé que
 * `THUMBNAIL_DELAY_MS` après la dernière, et seulement si la clé diffère de celle affichée.
 */
export function createThumbnailScheduler<T>(initialKey: string, onCommit: (value: T) => void) {
  let shown = initialKey;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    push(key: string, value: T) {
      cancel();
      if (key === shown) return;
      timer = setTimeout(() => {
        timer = null;
        shown = key;
        onCommit(value);
      }, THUMBNAIL_DELAY_MS);
    },
    dispose: cancel,
  };
}
