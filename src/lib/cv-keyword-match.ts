import type { Sector } from "./cv-sector-context";
import type { CvSuggestions, KeywordGroup, OfferKeyword } from "./cv-types";
import { isExcludedKeyword, matchKeywords, normalizeText } from "./keyword-match";

// « Adapter mon CV » : poids des mots-clés de l'offre (à l'analyse) et comparaison avec le
// texte du CV, sans IA. Utilisable dans le navigateur (éditeur du CV, recalcul en direct).

/** Mot-clé tel que renvoyé par l'IA, avant pondération. */
export type ExtractedKeyword = { keyword: string; group: KeywordGroup; variants: string[] };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nombre d'occurrences d'une expression (mots entiers) dans un texte normalisé. */
function countPhrase(normalizedText: string, phrase: string) {
  const p = normalizeText(phrase).trim();
  if (!p) return 0;
  return normalizedText.match(new RegExp(`(?<=[^a-z0-9])${escape(p)}(?=[^a-z0-9])`, "g"))?.length ?? 0;
}

/** Clé de comparaison d'un mot-clé (doublons, mots-clés ignorés). */
export function keywordKey(keyword: string) {
  return normalizeText(keyword).trim();
}

/**
 * Poids des mots-clés : 1, +1 s'il revient au moins deux fois dans la partie utile de l'offre,
 * +1 de plus à partir de trois fois, +2 s'il figure dans l'intitulé du poste. Doublons et nom
 * de l'entreprise retirés ; les plus importants d'abord.
 */
export function weighKeywords(
  extracted: ExtractedKeyword[],
  { usefulText, position, company }: { usefulText: string; position: string; company: string },
): OfferKeyword[] {
  const text = normalizeText(usefulText);
  const title = normalizeText(position);
  const seen = new Set<string>();
  const keywords: OfferKeyword[] = [];
  for (const k of extracted) {
    const keyword = k.keyword.trim();
    const key = keywordKey(keyword);
    if (!key || seen.has(key) || isExcludedKeyword(keyword, [company])) continue;
    seen.add(key);
    const forms = [keyword, ...k.variants];
    const occurrences = Math.max(...forms.map((form) => countPhrase(text, form)));
    const inTitle = forms.some((form) => countPhrase(title, form) > 0);
    const weight = 1 + (occurrences >= 2 ? 1 : 0) + (occurrences >= 3 ? 1 : 0) + (inTitle ? 2 : 0);
    const variants = [...new Set(k.variants.map((v) => v.trim()).filter((v) => v && keywordKey(v) !== key))];
    keywords.push({ keyword, group: k.group, variants, weight });
  }
  return keywords.sort((a, b) => b.weight - a.weight);
}

export type KeywordMatchRow = OfferKeyword & { present: boolean; ignored: boolean };

export type KeywordMatch = {
  rows: KeywordMatchRow[];
  /** Taux de correspondance pondéré, en % ; null sans texte de CV ou sans mot-clé retenu. */
  rate: number | null;
};

/**
 * Mots-clés de l'offre présents dans le CV (mot-clé ou une de ses variantes, règles de contexte
 * du secteur comprises) et taux de correspondance, pondéré, hors mots-clés ignorés.
 */
export function matchCvKeywords(
  analysis: Pick<CvSuggestions, "keywords" | "ignored">,
  cvText: string | null,
  sector: Sector,
): KeywordMatch {
  const ignored = new Set(analysis.ignored.map(keywordKey));
  const rows = analysis.keywords.map((k) => ({
    ...k,
    present: Boolean(cvText) && matchKeywords(cvText ?? "", [k.keyword, ...k.variants], sector).length > 0,
    ignored: ignored.has(keywordKey(k.keyword)),
  }));
  const counted = rows.filter((r) => !r.ignored);
  const total = counted.reduce((sum, r) => sum + r.weight, 0);
  const found = counted.filter((r) => r.present).reduce((sum, r) => sum + r.weight, 0);
  return { rows, rate: cvText && total > 0 ? Math.round((found / total) * 100) : null };
}
