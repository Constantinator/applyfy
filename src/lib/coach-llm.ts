import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { parseStructured } from "./claude-structured";
import { offerStageOf } from "./coach-offer";
import { coachSystem, coachUserText, isCvClosed, needsTargetQuestion, neutralizeCoachData, type CoachContext, type CoachRetry, type CoachTurn } from "./coach-prompt";
import { COACH_DATA_SCHEMAS, COACH_SECTIONS, type CoachMode, type CoachSection, type CoachUpdate } from "./coach-proposals";
import { formatSectorContext, getSectorContext } from "./cv-sector-context";
import { isLegacyStepMarker } from "./skipped-points";

// Appels du coach du CV Builder à Claude, sur le client donné : celui de claude.ts dans
// l'application (sa clé, côté serveur), celui du banc d'essai du coach
// (scripts/eval) sinon. Aucune lecture de clé ni de base ici.

/** Format attendu dans « data », section par section (décrit au modèle, validé par COACH_DATA_SCHEMAS). */
const COACH_DATA_FORMAT = `Ta modification de cette section. N'y mets que ce qui change. Longueurs maximales : puce 500 caractères, 12 puces par élément, dates 40, langues 60, accroche et description de projet 2000, autres champs 300. Une information qui dépasse va ailleurs : par exemple, une durée va dans une puce, pas dans une date.
- summary, interests : le nouveau texte lui-même.
- personal : JSON des seuls champs modifiés, parmi {"firstName","lastName","jobTitle","email","phone","city","linkedin","website","github"} ; jobTitle est le titre du CV.
- experience : JSON {"id": id de l'expérience, "bullets": [{"index": position de la puce remplacée (0 = première), ou -1 pour une nouvelle puce, "after": "la puce proposée"}], "bullets_to_remove": [positions des puces à supprimer]} ; seulement les puces modifiées, ajoutées ou supprimées. Supprimer l'expérience entière : {"id", "remove": true}. Nouvelle expérience : "id" vide, avec "position","company","startDate","endDate","current" (booléen),"location" et ses puces (index -1).
- education : JSON {"id", et les seuls champs modifiés parmi "school","degree","startDate","endDate","honors","bullets"} ; "bullets" est la liste complète des puces de la formation (cours suivis, classements…), ex. ["Cours : finance de marché","Classement : 3e sur 120"] ; supprimer la formation : {"id", "remove": true} ; nouvelle formation : "id" vide et tous les champs.
- projects : JSON d'UN projet {"id", et les seuls champs modifiés parmi "name","description","link"} ; supprimer le projet : {"id", "remove": true} ; nouveau projet : "id" vide et tous les champs.
- skills : JSON de la liste complète proposée [{"name","level"}], level parmi "", "debutant", "intermediaire", "avance", "expert". Chaque entrée est une ligne du CV (300 caractères maximum). Pour regrouper ou séparer des compétences, deux formats : une entrée par groupe, ex. [{"name":"Hard skills : Excel, SQL","level":""},{"name":"Soft skills : Écoute, Organisation","level":""}] ; ou, si le candidat veut l'intitulé sur sa propre ligne ou si la liste est longue, une entrée avec l'intitulé seul puis une entrée avec la liste dessous, ex. [{"name":"Hard skills :","level":""},{"name":"Excel, SQL","level":""},{"name":"Soft skills :","level":""},{"name":"Écoute, Organisation","level":""}].
- languages : JSON de la liste complète proposée [{"name","level"}].
- certifications : JSON de la liste complète proposée [{"name","issuer","date"}].`;

/**
 * Réponse du coach telle que demandée au modèle : schéma plat, sans champ nullable ni objet
 * imbriqué (la grammaire de la sortie structurée a une taille limitée) ; « data » est validé
 * côté serveur (COACH_DATA_SCHEMAS). « mode » vient en premier : le modèle le décide avant d'écrire.
 */
const MODE_DESCRIPTION =
  "« demande » : le dernier message du candidat demande explicitement une modification du CV, ou accepte ta proposition de continuer une demande en cours ; « parcours » : tous les autres cas (tu suis tes points à corriger, ou le candidat répond à ta question)";
const coachReplyFields = {
  change_summary: z
    .string()
    .describe(
      "Quand tu modifies le CV : une phrase courte qui dit ce que tu as modifié, suppressions comprises, en les nommant (ex. « C'est fait : j'ai ajouté tes résultats à ton stage chez X. », « C'est fait : j'ai supprimé la puce en doublon de ton stage chez X. ») ; sinon chaîne vide",
    ),
  message: z
    .string()
    .describe(
      "Ta question au candidat (tutoiement), 3 phrases maximum : une seule question précise, sur le même point ou sur le point suivant ; ou, si les conditions de clôture sont réunies, le message de clôture, sans question. N'y annonce jamais une modification (c'est le rôle de change_summary)",
    ),
  skipped_points: z
    .array(z.string())
    .describe(
      "Points que tu abandonnes dans cette réponse : le candidat ne sait pas ou ne veut pas répondre, ou tu as déjà posé la question 2 fois sans réponse directe. Pour chacun, nomme l'élément et l'information demandée (ex. « Stage chez X : nombre d'heures de tutorat ») ; liste vide sinon",
    ),
};
/** Nombre de mises à jour du repli à plat (COACH_UPDATES_FLAT=1). */
export const COACH_FLAT_UPDATES = 3;
/** Mises à jour de la réponse : une liste d'objets { section, data }. */
const updatesField = {
  updates: z
    .array(
      z.object({
        section: z.enum(COACH_SECTIONS).describe("La section que tu modifies"),
        data: z.string().describe(COACH_DATA_FORMAT),
      }),
    )
    .describe(
      "Tes modifications du CV : liste vide tant que tu n'as pas assez d'informations ; sinon une mise à jour par section modifiée (et par expérience, formation ou projet modifié)",
    ),
};
/**
 * Repli si l'API refusait la grammaire de la liste d'objets : COACH_FLAT_UPDATES couples
 * section_N / data_N à plat (« aucune » et chaîne vide pour une place libre), activé par
 * COACH_UPDATES_FLAT=1. Pas activé par défaut.
 */
const flatUpdatesFields: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Array.from({ length: COACH_FLAT_UPDATES }, (_, i) => i + 1).flatMap((n) => [
    [
      `section_${n}`,
      z
        .enum([...COACH_SECTIONS, "aucune"])
        .describe(
          n === 1
            ? "« aucune » tant que tu n'as pas assez d'informations ; sinon la première section que tu modifies"
            : `« aucune » si tu ne modifies pas de ${n}e section ; sinon la ${n}e section que tu modifies`,
        ),
    ],
    [`data_${n}`, z.string().describe(n === 1 ? `${COACH_DATA_FORMAT}
Chaîne vide si section_1 = « aucune ».` : `Comme data_1, pour section_${n} ; chaîne vide si section_${n} = « aucune »`)],
  ]),
);
const updateFields = () => (process.env.COACH_UPDATES_FLAT === "1" ? flatUpdatesFields : updatesField);
/** CV lié à une offre : écart avec l'offre, dit une fois quand le bloc « etape_offre » le demande. */
const offerFields = {
  ecart_offre: z
    .string()
    .describe(
      "Seulement si le bloc « etape_offre » te le demande : l'écart principal entre le CV et l'offre, dit honnêtement en une ou deux phrases, sans question ; sinon chaîne vide",
    ),
};
/**
 * Schéma de la réponse : CV lié ou non (champ « ecart_offre »), et replis par variable
 * d'environnement, aucun activé par défaut : COACH_MODE_BOOLEAN=1 (booléen à la place de
 * l'énumération « mode », si l'API la refusait) ; COACH_UPDATES_FLAT=1 (mises à jour à plat).
 */
function coachReplySchema(linked: boolean, boolean: boolean) {
  const mode = boolean
    ? { demande_explicite: z.boolean().describe(`true = mode « demande », false = mode « parcours ». ${MODE_DESCRIPTION}`) }
    : { mode: z.enum(["demande", "parcours"]).describe(MODE_DESCRIPTION) };
  return z.object({ ...mode, ...coachReplyFields, ...updateFields(), ...(linked ? offerFields : {}) });
}
type CoachReplyFlat = {
  mode: CoachMode;
  change_summary: string;
  message: string;
  skipped_points: string[];
  ecart_offre?: string;
  updates?: { section: CoachSection; data: string }[];
} & Record<string, unknown>;

/** Mises à jour écrites par le modèle (liste, ou repli à plat sans ses places libres). */
function rawUpdates(flat: CoachReplyFlat): RawUpdate[] {
  if (Array.isArray(flat.updates)) return flat.updates.map((u) => ({ section: u.section, data: u.data }));
  const list: RawUpdate[] = [];
  for (let n = 1; n <= COACH_FLAT_UPDATES; n++) {
    const section = flat[`section_${n}`];
    if (typeof section === "string" && section !== "aucune") list.push({ section: section as CoachSection, data: String(flat[`data_${n}`] ?? "") });
  }
  return list;
}

/** Mise à jour telle qu'écrite par le modèle (nouvel essai) ; `invalid` : contenu illisible ou invalide. */
export type RawUpdate = { section: CoachSection; data: string; invalid?: true };

/**
 * Réponse du coach. `updates` : modifications proposées, validées (une par section ou élément) ;
 * `invalid` : au moins une mise à jour avait un contenu illisible ou invalide ; `raw` : les mises
 * à jour telles qu'écrites (nouvel essai), vide si aucune.
 */
export type CoachReply = {
  /** « demande » : réponse à une demande explicite du candidat ; « parcours » : suite des points à corriger. */
  mode: CoachMode;
  /** Question ou réponse au candidat. */
  message: string;
  /** Ce que l'IA dit avoir modifié : affiché seulement si un changement a vraiment été appliqué. */
  changeSummary: string;
  /** Points abandonnés dans cette réponse (le candidat ne sait pas ou ne veut pas répondre). */
  skippedPoints: string[];
  /** CV lié : écart avec l'offre dit dans cette réponse (vide sinon) ; absent pour un CV libre. */
  gap?: string;
  updates: CoachUpdate[];
  invalid: boolean;
  raw: RawUpdate[];
};

const TEXT_SECTIONS = new Set<CoachSection>(["summary", "interests"]);

/** Contenu de « data » validé pour sa section ; null s'il est illisible ou invalide (journalisé). */
function readCoachData(section: CoachSection, data: string): CoachUpdate | null {
  let value: unknown = data.trim();
  if (!TEXT_SECTIONS.has(section)) {
    try {
      value = JSON.parse(data);
    } catch {
      console.error(`[cv-builder coach] data illisible (${section})`, data.slice(0, 200));
      return null;
    }
  }
  const parsed = COACH_DATA_SCHEMAS[section].safeParse(value);
  if (!parsed.success) console.error(`[cv-builder coach] data invalide (${section})`, parsed.error.issues.slice(0, 3));
  return parsed.success ? ({ section, data: parsed.data } as CoachUpdate) : null;
}

function toCoachReply(flat: CoachReplyFlat): CoachReply {
  const reply = {
    mode: flat.mode,
    message: flat.message.trim(),
    changeSummary: flat.change_summary.trim(),
    // Textes seulement : un « offre:… » écrit par le modèle ne valide jamais une étape de l'offre.
    skippedPoints: flat.skipped_points.map((p) => p.trim()).filter((p) => p && !isLegacyStepMarker(p)),
    ...(flat.ecart_offre !== undefined ? { gap: flat.ecart_offre.trim() } : {}),
  };
  // Chaque mise à jour est lue seule : un contenu invalide n'écarte que la sienne.
  const updates: CoachUpdate[] = [];
  const raw = rawUpdates(flat).map((r): RawUpdate => {
    const update = readCoachData(r.section, r.data);
    if (update) updates.push(update);
    return update ? r : { ...r, invalid: true };
  });
  return { ...reply, updates, invalid: raw.some((r) => r.invalid), raw };
}

/**
 * Contexte sectoriel du coach : secteur du score (celui de l'offre pour un CV lié, cf.
 * loadScoringContext), jamais redétecté ici, et mots-clés relevés dans les offres récentes du
 * secteur quand il y en a (ceux du score, lus par l'appelant : coach-context.ts).
 */
function coachSectorContext({ sector, marketKeywords }: CoachContext) {
  return formatSectorContext(getSectorContext(sector), marketKeywords.map(neutralizeCoachData));
}

const OPENING_INSTRUCTION =
  "Écris ton premier message au candidat : annonce que tu vas l'aider à corriger les points de son CV un par un, en commençant par le premier dans l'ordre de traitement fixé par tes règles, et pose une seule question précise pour obtenir les informations qui te manquent sur ce point. Ne modifie rien.";
/** CV lié avec une étape de l'offre à proposer : le premier message commence par elle. */
const OFFER_OPENING_INSTRUCTION =
  "Écris ton premier message au candidat : dis en une phrase que tu vas adapter son CV à cette offre, puis fais la proposition de l'étape indiquée dans « etape_offre », avec une seule question. Ne modifie rien.";

/**
 * Contexte d'un CV lié pour cet échange : premier message du coach ou non (l'étape de l'offre en
 * dépend). Mode libre : le contexte tel quel.
 */
function withOpening(context: CoachContext, opening: boolean): CoachContext {
  return context.offerSteps ? { ...context, opening } : context;
}

/** Premier message du coach : le premier point dans l'ordre de traitement (ou l'étape de l'offre) et une première question. */
export async function coachOpening(client: Anthropic, context: CoachContext): Promise<string | null> {
  const opening = withOpening(context, true);
  // CV libre sans poste visé : la question du poste visé, dans ce premier message seulement (C1).
  const ctx = needsTargetQuestion(opening) ? { ...opening, targetQuestion: true } : opening;
  const offerFirst = !isCvClosed(ctx.score.value) && Boolean(offerStageOf(ctx, true)?.propose);
  const result = await parseStructured(
    client,
    "coachOpening",
    z.object({ message: z.string().describe("Le premier message, 4 phrases maximum") }),
    coachSystem(ctx, coachSectorContext(ctx)),
    offerFirst ? OFFER_OPENING_INSTRUCTION : OPENING_INSTRUCTION,
    { effort: "low", maxTokens: 4000 },
  );
  return result?.message.trim() || null;
}

/** Réponse du coach au dernier message du candidat (question de suivi ou section mise à jour). */
export async function coachBuilderCv(
  client: Anthropic,
  context: CoachContext,
  history: CoachTurn[],
  message: string,
  retry?: CoachRetry,
): Promise<CoachReply | null> {
  const text = coachUserText(history, message, retry);
  // Sans message du coach dans l'historique, rien n'a encore été proposé (étape de l'offre).
  const ctx = withOpening(context, !history.some((turn) => turn.role === "assistant"));
  const system = coachSystem(ctx, coachSectorContext(ctx));
  // 16 000 tokens : la réflexion du modèle compte dans la limite.
  const options = { effort: "low", maxTokens: 16000 } as const;
  // CV lié : schéma avec le champ « ecart_offre » ; CV libre : sans.
  const linked = Boolean(context.offerSteps);
  if (process.env.COACH_MODE_BOOLEAN === "1") {
    const reply = (await parseStructured(client, "coachBuilderCv", coachReplySchema(linked, true), system, text, options)) as
      | ({ demande_explicite: boolean } & Record<string, unknown>)
      | null;
    if (!reply) return null;
    const { demande_explicite, ...fields } = reply;
    return toCoachReply({ mode: demande_explicite ? "demande" : "parcours", ...fields } as CoachReplyFlat);
  }
  const flat = (await parseStructured(client, "coachBuilderCv", coachReplySchema(linked, false), system, text, options)) as CoachReplyFlat | null;
  return flat && toCoachReply(flat);
}
