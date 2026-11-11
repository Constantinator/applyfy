// Modèle de chaque fonction qui appelle Claude. Sans clé ni client : importé par claude.ts (côté
// serveur) et par les modules à client injecté (coach-llm.ts), utilisables hors de Next (banc
// d'essai du coach, scripts/eval).

// ---------------------------------------------------------------------------
// Modèle de chaque fonction
// ---------------------------------------------------------------------------

/** Trois niveaux de modèle, du moins cher au plus capable. */
export const CLAUDE_TIERS = {
  rapide: "claude-haiku-5-5",
  standard: "claude-sonnet-5-5",
  max: "claude-opus-5-5",
} as const;
export type ClaudeTier = keyof typeof CLAUDE_TIERS;

/**
 * Niveau de chaque fonction, et groupe dont la variable d'environnement CLAUDE_MODEL_<GROUPE>
 * remplace le modèle (nom de niveau ou identifiant de modèle, ex. « max » ou « claude-opus-5-5 ») :
 * revenir à Opus sans modifier le code (sur Vercel, la variable s'applique au déploiement suivant).
 */
export const CLAUDE_FUNCTIONS = {
  summarizeOffer: { tier: "rapide", group: "OFFER" },
  summarizeJobOffer: { tier: "rapide", group: "OFFER" },
  extractOfferFields: { tier: "rapide", group: "OFFER" },
  coachOpening: { tier: "standard", group: "COACH" },
  coachBuilderCv: { tier: "standard", group: "COACH" },
  // Panneau global de Lumeo : conseils sans action (CLAUDE_MODEL_LUMEO pour changer de modèle).
  answerLumeo: { tier: "standard", group: "LUMEO" },
  // « Améliorer ma relance » (lot 3a), même groupe que le panneau.
  improveLumeoRelance: { tier: "standard", group: "LUMEO" },
  suggestCvAdaptations: { tier: "standard", group: "CV" },
  extractOfferKeywords: { tier: "standard", group: "CV" },
  transcribeCv: { tier: "standard", group: "CV" },
  improveCvBullet: { tier: "standard", group: "CV" },
  generateCvSummary: { tier: "standard", group: "CV" },
  adaptCvToOffer: { tier: "standard", group: "CV" },
  generateCoverLetter: { tier: "standard", group: "LETTER" },
  transcribeLetter: { tier: "standard", group: "LETTER" },
  refineDocument: { tier: "standard", group: "REFINE" },
  extractCvContent: { tier: "max", group: "IMPORT" },
  analyseCv: { tier: "standard", group: "IMPORT_ANALYSIS" },
} as const satisfies Record<string, { tier: ClaudeTier; group: string }>;
export type ClaudeFunction = keyof typeof CLAUDE_FUNCTIONS;

const MODEL_ID = /^claude-[a-z0-9-]+$/;
const warnedOverrides = new Set<string>();

/** Modèle utilisé par une fonction : surcharge de son groupe si elle est valide, sinon son niveau. */
export function modelFor(fn: ClaudeFunction): string {
  const { tier, group } = CLAUDE_FUNCTIONS[fn];
  const variable = `CLAUDE_MODEL_${group}`;
  const override = process.env[variable]?.trim();
  if (override) {
    if (Object.hasOwn(CLAUDE_TIERS, override)) return CLAUDE_TIERS[override as ClaudeTier];
    if (MODEL_ID.test(override)) return override;
    if (!warnedOverrides.has(variable)) {
      warnedOverrides.add(variable);
      console.warn(`[claude] ${variable} ignorée : « ${override} » n'est ni un niveau (${Object.keys(CLAUDE_TIERS).join(", ")}) ni un modèle`);
    }
  }
  return CLAUDE_TIERS[tier];
}

/**
 * Repli côté serveur en cas de refus (beta server-side-fallback) : accepté par Opus, Sonnet et
 * Fable ; Haiku n'en a pas (le paramètre ne doit pas lui être envoyé).
 */
export function supportsServerFallback(model: string) {
  return /^claude-(opus|sonnet|fable)-/.test(model);
}
