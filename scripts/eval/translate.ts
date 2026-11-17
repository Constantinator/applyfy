// Banc d'essai de la traduction de tout le CV (lot traduction). Script LOCAL : jamais importé par
// l'application, jamais déployé, jamais lancé en CI.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/eval/register.mjs scripts/eval/translate.ts --dry
//   (même commande sans --dry : vrai run, avec EVAL_ANTHROPIC_API_KEY et EVAL_MAX_COST_EUR)
//   --only finance-junior-fr,tech-confirme-en     profils choisis (défaut : les 12)
//
// Chaque profil est traduit dans l'autre langue (aller), puis la copie est retraduite dans sa
// langue d'origine (retour), avec le vrai déroulé de l'application (runTranslation : contrôles,
// second essai, seuil de 30 %). Mesures : score avant / traduit / retour, secteur, champs refusés
// au premier essai et gardés à la fin, nombres du CV, appels, jetons, coût et durée.
// Vrai run : estimation affichée, confirmation demandée, arrêt dès que le plafond serait dépassé.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import type Anthropic from "@anthropic-ai/sdk";

import { modelFor } from "../../src/lib/claude-models.ts";
import { parseStructured } from "../../src/lib/claude-structured.ts";
import { CvDataSchema, type CvData, type CvLang } from "../../src/lib/cv-builder-types.ts";
import { cvLanguage } from "../../src/lib/cv-language.ts";
import { scoreCv } from "../../src/lib/cv-score.ts";
import { scoringContextFrom } from "../../src/lib/cv-scoring-context.ts";
import {
  numbersOf,
  runTranslation,
  translatableFields,
  translationMessage,
  translationSystem,
  TranslationOutputSchema,
  type TranslatableField,
  type TranslationRun,
} from "../../src/lib/cv-translate.ts";
import { BudgetExceeded, costEur, meteredClient, newBudget, type BudgetState, type ParseClient } from "./budget.ts";
import { ESTIMATE } from "./config.ts";
import { loadFixtures, type Fixtures } from "./fixtures.ts";

type Options = { dry: boolean; only: string[] | null };

function parseArgs(argv: string[]): Options {
  const options: Options = { dry: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry") options.dry = true;
    else if (arg === "--only") options.only = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else throw new Error(`Option inconnue : ${arg}`);
  }
  return options;
}

const MODEL = modelFor("translateCv");
/** Mêmes réglages que l'application (claude.ts, translateCvFields). */
const CALL_OPTIONS = { effort: "medium" as const, maxTokens: 16000 };
const OUT_ROOT = fileURLToPath(new URL("../../eval-runs/", import.meta.url));

// ---------------------------------------------------------------------------
// Faux traducteur (--dry) : traductions écrites à la main quand elles existent, sinon le texte
// d'origine (refusé au-delà de 6 mots : le seuil de 30 % et l'échec sont donc aussi exercés).
// ---------------------------------------------------------------------------

const HAND: Record<string, Record<string, string>> = {};
function handTranslations(fx: Fixtures) {
  const pairs: [string, string][] = [
    ["finance-junior-fr", "translated/finance-junior-en.json"],
    ["tech-confirme-en", "translated/tech-confirme-fr.json"],
  ];
  for (const [id, file] of pairs) {
    const profile = fx.profiles.get(id);
    if (!profile) continue;
    const translated = JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8")) as Partial<CvData>;
    const target = fieldsByPath(translatableFields(CvDataSchema.parse({ ...profile.cv, ...translated })));
    HAND[id] = Object.fromEntries(translatableFields(profile.cv).map((f) => [f.path, target.get(f.path) ?? f.text]));
  }
}
const fieldsByPath = (fields: TranslatableField[]) => new Map(fields.map((f) => [f.path, f.text]));

function dryClient(): ParseClient {
  return {
    beta: {
      messages: {
        parse: async (params) => {
          const content = String((params.messages as { content: string }[])[0]?.content ?? "");
          const json = content.slice(content.indexOf("<champs>") + 8, content.lastIndexOf("</champs>"));
          const items = JSON.parse(json) as { path: string; text: string }[];
          const hand = Object.values(HAND).find((map) => items.every((i) => i.path in map));
          const fields = items.map((i) => ({ path: i.path, text: hand?.[i.path] ?? i.text }));
          const chars = JSON.stringify(params.system ?? "").length + content.length;
          return {
            stop_reason: "end_turn",
            stop_details: null,
            model: params.model,
            parsed_output: { fields },
            usage: { input_tokens: Math.round(chars / ESTIMATE.charsPerToken), output_tokens: Math.round(content.length / ESTIMATE.charsPerToken) },
          };
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

type Leg = {
  from: CvLang;
  to: CvLang;
  ok: boolean;
  reason: string | null;
  fields: number;
  refusedFirst: number;
  kept: number;
  calls: number;
  numbersChanged: boolean;
  scoreAfter: number | null;
  sectorAfter: string | null;
  eur: number;
  ms: number;
  keptLabels: string[];
};
type Row = { profile: string; sector: string; language: CvLang; scoreBefore: number; sectorBefore: string; aller: Leg; retour: Leg | null };

function scoreOf(cv: CvData, marketKeywords: string[]) {
  const context = scoringContextFrom(cv, null, marketKeywords);
  return { score: scoreCv(cv, context).score, sector: context.sector };
}

const allNumbers = (cv: CvData) => numbersOf(translatableFields(cv).map((f) => f.text).join("\n")).join(",");

async function leg(source: CvData, from: CvLang, to: CvLang, client: Anthropic, budget: BudgetState, marketKeywords: string[]): Promise<{ leg: Leg; data: CvData | null }> {
  const spent = budget.spentEur;
  const started = Date.now();
  const calls: number[] = [];
  let run: TranslationRun;
  let reason: string | null = null;
  try {
    run = await runTranslation(source, from, to, (fields, problems) => {
      calls.push(fields.length);
      return parseStructured(client, "translateCv", TranslationOutputSchema, translationSystem(to), translationMessage(fields, problems), CALL_OPTIONS);
    });
  } catch (error) {
    if (error instanceof BudgetExceeded) throw error;
    reason = error instanceof Error ? error.message : String(error);
    run = { ok: false, reason: "model", kept: [], total: translatableFields(source).length };
  }
  const data = run.ok ? run.data : null;
  const after = data ? scoreOf(data, marketKeywords) : null;
  return {
    data,
    leg: {
      from,
      to,
      ok: run.ok,
      reason: run.ok ? null : (reason ?? run.reason),
      fields: run.total,
      refusedFirst: calls[1] ?? 0,
      kept: run.kept.length,
      calls: calls.length,
      numbersChanged: data ? allNumbers(data) !== allNumbers(source) : false,
      scoreAfter: after?.score ?? null,
      sectorAfter: after?.sector ?? null,
      eur: budget.spentEur - spent,
      ms: Date.now() - started,
      keptLabels: run.kept.map((k) => `${k.label} : ${k.problems.join(" ; ")}`),
    },
  };
}

// ---------------------------------------------------------------------------
// Lancement
// ---------------------------------------------------------------------------

async function confirm(question: string) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(o|oui|y|yes)$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

/** Estimation d'un vrai run : aller et retour par profil, un second essai sur ESTIMATE.retryRate des appels. */
function estimate(cvs: CvData[]) {
  const calls = cvs.length * 2 * (1 + ESTIMATE.retryRate);
  const eur = cvs.reduce((sum, cv) => {
    const fields = translatableFields(cv);
    const input = (translationSystem("en").length + translationMessage(fields).length) / ESTIMATE.charsPerToken;
    const output = (JSON.stringify(fields.map((f) => ({ path: f.path, text: f.text }))).length * 1.1) / ESTIMATE.charsPerToken + 1500;
    return sum + 2 * (1 + ESTIMATE.retryRate) * costEur(MODEL, input, output);
  }, 0);
  return { calls, eur };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fx = loadFixtures();
  const profiles = [...fx.profiles.values()].filter((p) => !options.only || options.only.includes(p.id));
  if (options.only) {
    const unknown = options.only.filter((id) => !fx.profiles.has(id));
    if (unknown.length) throw new Error(`Profil(s) inconnu(s) : ${unknown.join(", ")}`);
  }
  if (!profiles.length) throw new Error("Aucun profil sélectionné.");

  const cap = Number(process.env.EVAL_MAX_COST_EUR);
  if (!options.dry && !(cap > 0)) throw new Error("EVAL_MAX_COST_EUR absent ou invalide (plafond en euros, ex. 3).");
  const budget = newBudget(options.dry ? (cap > 0 ? cap : 5) : cap);
  const planned = estimate(profiles.map((p) => p.cv));
  console.log(
    [
      `Banc d'essai de la traduction du CV${options.dry ? " (--dry : traductions simulées, aucun appel, 0 €)" : ""}`,
      `Profils : ${profiles.length} × aller et retour, modèle ${MODEL}`,
      `Estimation ${options.dry ? "d'un vrai run équivalent" : "avant lancement"} : ${planned.eur.toFixed(2)} € (${Math.round(planned.calls)} appels)`,
      `Plafond : ${budget.capEur.toFixed(2)} €${planned.eur > budget.capEur ? " — l'estimation dépasse le plafond : le run s'arrêtera avant la fin" : ""}`,
    ].join("\n"),
  );

  let client: Anthropic;
  if (options.dry) {
    handTranslations(fx);
    client = meteredClient(dryClient(), budget, "coach") as unknown as Anthropic;
  } else {
    // Seule la clé du banc d'essai est lue ; jamais ANTHROPIC_API_KEY ni un autre jeton.
    const apiKey = process.env.EVAL_ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("EVAL_ANTHROPIC_API_KEY absente de l'environnement local (ou utilise --dry).");
    if (!(await confirm("Lancer ce run payant ? (o/N) "))) {
      console.log("Annulé : aucun appel.");
      return;
    }
    const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
    const real = new AnthropicSdk({ apiKey, authToken: null, baseURL: "https://api.anthropic.com", maxRetries: 2 }) as unknown as ParseClient;
    client = meteredClient(real, budget, "coach") as unknown as Anthropic;
  }

  const rows: Row[] = [];
  let stopped: string | null = null;
  const quiet = console.error;
  console.error = () => {}; // journaux de claude-structured et du second essai : dans le rapport
  try {
    for (const profile of profiles) {
      const keywords = fx.marketKeywords[profile.sector] ?? [];
      const before = scoreOf(profile.cv, keywords);
      const from = cvLanguage(profile.cv);
      const to: CvLang = from === "fr" ? "en" : "fr";
      try {
        const aller = await leg(profile.cv, from, to, client, budget, keywords);
        const retour = aller.data ? (await leg(aller.data, to, from, client, budget, keywords)).leg : null;
        rows.push({ profile: profile.id, sector: profile.sector, language: from, scoreBefore: before.score, sectorBefore: before.sector, aller: aller.leg, retour });
        process.stdout.write(
          `${profile.id} : ${before.score} → ${aller.leg.scoreAfter ?? "échec"} → ${retour?.scoreAfter ?? "—"} ; gardés ${aller.leg.kept}/${aller.leg.fields} — ${budget.spentEur.toFixed(2)} €\n`,
        );
      } catch (error) {
        if (!(error instanceof BudgetExceeded)) throw error;
        stopped = error.message;
        break;
      }
    }
  } finally {
    console.error = quiet;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "-translate" + (options.dry ? "-dry" : "");
  const dir = `${OUT_ROOT}${runId}`;
  mkdirSync(dir, { recursive: true });
  const cell = (l: Leg | null) => (l ? (l.ok ? `${l.scoreAfter}` : `échec (${l.reason})`) : "—");
  const md = [
    `# Traduction du CV — ${runId}`,
    "",
    `Modèle ${MODEL}${options.dry ? " (--dry : traductions simulées)" : ""} ; dépense ${budget.spentEur.toFixed(2)} € sur ${budget.capEur.toFixed(2)} € ; ${budget.calls} appels${stopped ? ` ; interrompu : ${stopped}` : ""}.`,
    "",
    "| Profil | Sens | Secteur avant → traduit | Score avant → traduit → retour | Δ aller | Δ aller-retour | Champs | Refusés au 1er essai | Gardés (aller / retour) | Nombres ≠ | Appels | € | Durée |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => {
      const a = r.aller;
      const delta = (v: number | null) => (v === null ? "—" : `${v - r.scoreBefore >= 0 ? "+" : ""}${v - r.scoreBefore}`);
      return `| ${r.profile} | ${a.from} → ${a.to} | ${r.sectorBefore} → ${a.sectorAfter ?? "—"} | ${r.scoreBefore} → ${cell(a)} → ${cell(r.retour)} | ${delta(a.scoreAfter)} | ${delta(r.retour?.scoreAfter ?? null)} | ${a.fields} | ${a.refusedFirst} | ${a.kept} / ${r.retour?.kept ?? "—"} | ${a.numbersChanged || r.retour?.numbersChanged ? "oui" : "non"} | ${a.calls + (r.retour?.calls ?? 0)} | ${(a.eur + (r.retour?.eur ?? 0)).toFixed(3)} | ${Math.round((a.ms + (r.retour?.ms ?? 0)) / 1000)} s |`;
    }),
    "",
    "## Champs gardés dans la langue d'origine",
    "",
    ...rows.flatMap((r) => [...r.aller.keptLabels.map((k) => `- ${r.profile} (aller) — ${k}`), ...(r.retour?.keptLabels ?? []).map((k) => `- ${r.profile} (retour) — ${k}`)]),
    "",
  ].join("\n");
  writeFileSync(`${dir}/report.md`, md);
  writeFileSync(`${dir}/report.json`, JSON.stringify({ runId, model: MODEL, dry: options.dry, budget, stopped, rows }, null, 1));
  console.log(`\nRapport : ${dir}/report.md (et report.json)${stopped ? `\nInterrompu : ${stopped}` : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
