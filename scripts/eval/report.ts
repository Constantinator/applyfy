// Rapport du banc d'essai : Markdown (lecture) et JSON (comparaison). Deux rapports séparés, CV
// libre et CV lié ; pires conversations en entier ; jeu tenu à l'écart en agrégats seulement (ni
// transcription ni CV) ; comparaison avec le dernier run sur les mêmes fixtures. Les pistes sont
// des propositions : rien n'est modifié automatiquement.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chatContent } from "../../src/lib/cv-builder-types.ts";
import type { BudgetState } from "./budget.ts";
import type { ConversationRecord } from "./conversation.ts";
import type { Estimate } from "./estimate.ts";
import { JUDGE_CRITERIA, judgeMean } from "./judge.ts";
import type { ConversationMetrics } from "./metrics.ts";

export type Result = { record: ConversationRecord; metrics: ConversationMetrics };

export type RunMeta = {
  runId: string;
  date: string;
  dry: boolean;
  models: { coach: string; simulator: string; judge: string };
  commit: string;
  fixturesHash: string;
  coachRulesHash: string;
  repeat: number;
  maxTurns: number;
  holdout: boolean;
  interrupted: string | null;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (v: number | null, digits = 0) => (v === null ? "—" : v.toFixed(digits));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (values: (boolean | null)[]) => {
  const known = values.filter((v): v is boolean => v !== null);
  return known.length ? `${known.filter(Boolean).length}/${known.length}` : "—";
};
const merge = (list: Record<string, number>[]) => {
  const out: Record<string, number> = {};
  for (const r of list) for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v;
  return out;
};

export type ScenarioAggregate = {
  scenarioId: string;
  case: "libre" | "lie";
  set: "dev" | "holdout";
  type: string;
  runs: number;
  startScore: number | null;
  endScore: number | null;
  delta: number | null;
  deltaRange: [number, number];
  turnsTo80: number | null;
  reached80: string;
  closureViolations: number;
  refusalsFirst: Record<string, number>;
  refusalsFinal: Record<string, number>;
  retries: number;
  modelRefusals: number;
  errors: number;
  inventedRuns: number;
  unfaithfulClaims: number;
  directQuestionsIgnored: number;
  noMoreQuestionsThenQuestion: number;
  lapses: number;
  repeatedQuestions: number;
  languageMismatches: number;
  requestDone: string;
  titleProposalsMax: number | null;
  titleNoConsent: number;
  sectorOk: string;
  injectionFollowed: string;
  gapStated: string;
  judgeMean: number | null;
  judgeRange: [number, number] | null;
  judgeByCriterion: Record<string, number | null>;
  unstable: boolean;
};

export function aggregate(results: Result[]): ScenarioAggregate[] {
  const byScenario = new Map<string, Result[]>();
  for (const r of results) byScenario.set(r.record.scenarioId, [...(byScenario.get(r.record.scenarioId) ?? []), r]);
  return [...byScenario.values()].map((runs) => {
    const m = runs.map((r) => r.metrics);
    const first = runs[0].record;
    const deltas = m.map((x) => x.scoreDelta);
    const judged = runs.map((r) => r.record.judge).filter((j) => j !== null);
    const means = judged.map(judgeMean);
    const judgeRange: [number, number] | null = means.length ? [Math.min(...means), Math.max(...means)] : null;
    const deltaRange: [number, number] = [Math.min(...deltas), Math.max(...deltas)];
    const titles = m.map((x) => x.titleProposals).filter((v): v is number => v !== null);
    return {
      scenarioId: first.scenarioId,
      case: first.case,
      set: first.set,
      type: first.type,
      runs: runs.length,
      startScore: median(m.map((x) => x.startScore)),
      endScore: median(m.map((x) => x.endScore)),
      delta: median(deltas),
      deltaRange,
      turnsTo80: median(m.map((x) => x.turnsTo80).filter((v): v is number => v !== null)),
      reached80: `${m.filter((x) => x.turnsTo80 !== null).length}/${m.length}`,
      closureViolations: sum(m.map((x) => x.closureViolations)),
      refusalsFirst: merge(m.map((x) => x.refusalsFirst)),
      refusalsFinal: merge(m.map((x) => x.refusalsFinal)),
      retries: sum(m.map((x) => x.retries)),
      modelRefusals: sum(m.map((x) => x.modelRefusals)),
      errors: sum(m.map((x) => x.errors)),
      inventedRuns: m.filter((x) => x.inventedNumbers.length).length,
      unfaithfulClaims: sum(m.map((x) => x.unfaithfulClaims)),
      directQuestionsIgnored: sum(m.map((x) => x.directQuestionsIgnored)),
      noMoreQuestionsThenQuestion: sum(m.map((x) => x.noMoreQuestionsThenQuestion)),
      lapses: sum(m.map((x) => x.lapses)),
      repeatedQuestions: sum(m.map((x) => x.repeatedQuestions)),
      languageMismatches: sum(m.map((x) => x.languageMismatches)),
      requestDone: ratio(m.map((x) => x.requestDone)),
      titleProposalsMax: titles.length ? Math.max(...titles) : null,
      titleNoConsent: m.filter((x) => x.titleChangedWithoutConsent).length,
      sectorOk: ratio(m.map((x) => x.sectorOk)),
      injectionFollowed: ratio(m.map((x) => x.injectionFollowed)),
      gapStated: ratio(m.map((x) => x.gapStated)),
      judgeMean: median(means),
      judgeRange,
      judgeByCriterion: Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, median(judged.map((j) => j[k].note))])),
      unstable: (judgeRange !== null && judgeRange[1] - judgeRange[0] > 1) || deltaRange[1] - deltaRange[0] > 10,
    };
  });
}

/** Gravité d'une conversation, pour choisir les pires : défauts mesurés, puis note du juge. */
function badness({ record, metrics: m }: Result) {
  return (
    m.closureViolations * 2 +
    m.inventedNumbers.length * 3 +
    m.repeatedQuestions +
    m.unfaithfulClaims * 2 +
    m.directQuestionsIgnored * 2 +
    m.noMoreQuestionsThenQuestion * 2 +
    m.lapses +
    m.languageMismatches +
    (m.requestDone === false ? 3 : 0) +
    (m.injectionFollowed ? 5 : 0) +
    (m.titleChangedWithoutConsent ? 3 : 0) +
    ((m.titleProposals ?? 0) > 1 ? 2 : 0) +
    (m.gapStated === false ? 2 : 0) +
    m.errors * 2 +
    (record.judge ? 5 - judgeMean(record.judge) : 0)
  );
}

function scenarioTable(rows: ScenarioAggregate[], linked: boolean) {
  const head = [
    "Scénario",
    "Score départ → fin",
    "Δ (min–max)",
    "Tours → 80",
    "Clôture (questions après 80)",
    "Refus 1er / final",
    "Seconds essais",
    "Nombres inventés",
    "Questions répétées",
    "Annonce non fidèle",
    "Questions directes ignorées",
    "« Plus de question » puis question",
    "Lapsus",
    "Langue ≠",
    "Demande exécutée",
    ...(linked ? ["Titre proposé (max)", "Titre changé sans accord"] : []),
    "Secteur OK",
    "Injection suivie",
    "Écart dit",
    "Juge (min–max)",
  ];
  const lines = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  for (const r of rows) {
    const first = sum(Object.values(r.refusalsFirst));
    const final = sum(Object.values(r.refusalsFinal));
    lines.push(
      `| ${[
        `${r.scenarioId}${r.unstable ? " ⚠ instable" : ""}`,
        `${fmt(r.startScore)} → ${fmt(r.endScore)}`,
        `${fmt(r.delta)} (${r.deltaRange[0]}–${r.deltaRange[1]})`,
        `${fmt(r.turnsTo80)} (${r.reached80})`,
        String(r.closureViolations),
        `${first} / ${final}`,
        String(r.retries),
        `${r.inventedRuns}/${r.runs}`,
        String(r.repeatedQuestions),
        String(r.unfaithfulClaims),
        String(r.directQuestionsIgnored),
        String(r.noMoreQuestionsThenQuestion),
        String(r.lapses),
        String(r.languageMismatches),
        r.requestDone,
        ...(linked ? [fmt(r.titleProposalsMax), String(r.titleNoConsent)] : []),
        r.sectorOk,
        r.injectionFollowed,
        r.gapStated,
        r.judgeMean === null ? "—" : `${fmt(r.judgeMean, 1)} (${fmt(r.judgeRange![0], 1)}–${fmt(r.judgeRange![1], 1)})`,
      ].join(" | ")} |`,
    );
  }
  return lines.join("\n");
}

function transcriptMd({ record, metrics }: Result) {
  const lines = [
    `#### ${record.scenarioId} (lancement ${record.repeat + 1}) — ${record.startScore} → ${record.endScore}, fin : ${record.endReason}${record.error ? ` (${record.error})` : ""}`,
    "",
    `Défauts mesurés : ${[
      metrics.closureViolations ? `${metrics.closureViolations} question(s) après 80` : null,
      metrics.inventedNumbers.length ? `nombres inventés ${metrics.inventedNumbers.join(", ")}` : null,
      metrics.repeatedQuestions ? `${metrics.repeatedQuestions} question(s) répétée(s)` : null,
      metrics.languageMismatches ? `${metrics.languageMismatches} message(s) dans une autre langue` : null,
      metrics.requestDone === false ? "demande non exécutée" : null,
      metrics.injectionFollowed ? "injection suivie" : null,
      metrics.unfaithfulClaims ? `${metrics.unfaithfulClaims} annonce(s) non fidèle(s)` : null,
      metrics.directQuestionsIgnored ? `${metrics.directQuestionsIgnored} question(s) directe(s) sans réponse` : null,
      metrics.noMoreQuestionsThenQuestion ? "« plus de question » puis question" : null,
      metrics.lapses ? `lapsus : ${metrics.lapseExamples.join(" / ")}` : null,
      metrics.titleChangedWithoutConsent ? "titre changé sans accord" : null,
      metrics.gapStated === false ? "écart non dit" : null,
    ]
      .filter(Boolean)
      .join(" ; ") || "aucun"}`,
    "",
  ];
  if (record.opening) lines.push(`> **Coach** : ${record.opening.replace(/\n/g, " ")}`, ">");
  for (const t of record.turns) {
    const detail = [t.mode, t.section, t.applied ? `${t.applied} changement(s)` : null, t.retried ? "second essai" : null, t.problems.length ? `${t.problems.length} texte(s) refusé(s)` : null, t.error]
      .filter(Boolean)
      .join(", ");
    lines.push(`> **Candidat** : ${t.user.replace(/\n/g, " ")}`, ">", `> **Coach** (${t.scoreBefore} → ${t.scoreAfter}${detail ? `, ${detail}` : ""}) : ${t.coachText.replace(/\n/g, " ")}`, ">");
    // Textes refusés en entier : emplacement, texte d'origine, texte proposé, causes.
    for (const p of t.firstProblems) {
      const final = t.problems.some((q) => q.proposed === p.proposed);
      lines.push(`> ↳ refusé${final ? "" : " puis corrigé ou retiré au second essai"} — ${p.label ?? "?"} : « ${p.original ?? "(ajout)"} » → « ${p.proposed} » (${p.causes.join(" ; ")})`, ">");
    }
    for (const q of t.problems.filter((q) => !t.firstProblems.some((p) => p.proposed === q.proposed))) {
      lines.push(`> ↳ refusé au second essai — ${q.label ?? "?"} : « ${q.original ?? "(ajout)"} » → « ${q.proposed} » (${q.causes.join(" ; ")})`, ">");
    }
  }
  if (record.judge) {
    lines.push("", `Juge : ${JUDGE_CRITERIA.map((k) => `${k} ${record.judge![k].note} (${record.judge![k].justification})`).join(" ; ")}`);
  }
  lines.push("", "<details><summary>CV avant / après</summary>", "", "```json", JSON.stringify(chatContent(record.startCv), null, 1), "```", "", "```json", JSON.stringify(chatContent(record.endCv), null, 1), "```", "</details>", "");
  return lines.join("\n");
}

/** Pistes : causes mesurées les plus fréquentes, puis observations du juge les plus citées. */
function pistes(results: Result[], rows: ScenarioAggregate[]) {
  const out: string[] = [];
  const refusals = merge(rows.map((r) => r.refusalsFinal));
  const top = Object.entries(refusals).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [cause, n] of top) out.push(`Texte encore refusé après le second essai (${n} fois) : « ${cause} ».`);
  const violations = sum(rows.map((r) => r.closureViolations));
  if (violations) out.push(`${violations} question(s) de parcours posée(s) après le passage à 80.`);
  const invented = rows.filter((r) => r.inventedRuns).map((r) => r.scenarioId);
  if (invented.length) out.push(`Nombres absents des sources dans le CV final : ${invented.join(", ")}.`);
  const notDone = rows.filter((r) => r.requestDone.startsWith("0/") || (r.requestDone !== "—" && !r.requestDone.startsWith(`${r.runs}/`))).map((r) => `${r.scenarioId} (${r.requestDone})`);
  if (notDone.length) out.push(`Demandes explicites pas toujours exécutées : ${notDone.join(", ")}.`);
  const unfaithful = rows.filter((r) => r.unfaithfulClaims).map((r) => `${r.scenarioId} (${r.unfaithfulClaims})`);
  if (unfaithful.length) out.push(`« C'est fait » affiché alors qu'une partie a été refusée, que rien n'a changé ou qu'une puce citée est restée identique : ${unfaithful.join(", ")}.`);
  const ignored = rows.filter((r) => r.directQuestionsIgnored).map((r) => `${r.scenarioId} (${r.directQuestionsIgnored})`);
  if (ignored.length) out.push(`Questions directes du candidat restées sans réponse : ${ignored.join(", ")}.`);
  const noMore = rows.filter((r) => r.noMoreQuestionsThenQuestion).map((r) => r.scenarioId);
  const lapsed = rows.filter((r) => r.lapses).map((r) => `${r.scenarioId} (${r.lapses})`);
  if (lapsed.length) out.push(`Lapsus (le coach se reprend dans son message) : ${lapsed.join(", ")}.`);
  if (noMore.length) out.push(`« Je n'ai plus de question » puis une nouvelle question : ${noMore.join(", ")}.`);
  const repeated = rows.filter((r) => r.repeatedQuestions).map((r) => r.scenarioId);
  if (repeated.length) out.push(`Questions répétées : ${repeated.join(", ")}.`);
  const injected = rows.filter((r) => r.injectionFollowed !== "—" && !r.injectionFollowed.startsWith("0/")).map((r) => r.scenarioId);
  if (injected.length) out.push(`Injection suivie : ${injected.join(", ")}.`);
  const counts = new Map<string, number>();
  for (const r of results) for (const p of r.record.judge?.pistes ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
  for (const [p, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5)) out.push(`Juge (${n}×) : ${p}`);
  return out.length ? out.map((p) => `- ${p}`).join("\n") : "- Rien de saillant.";
}

/**
 * Textes refusés à la première vérification : encore refusés après le second essai d'abord, puis
 * ceux que le second essai a corrigés ou retirés (20 au plus). Les textes refusés au second essai
 * sans l'avoir été au premier sont dans la colonne « refusé » aussi.
 */
function refusedTable(results: Result[]) {
  const rows = results.flatMap(({ record }) =>
    record.turns.flatMap((t, i) => {
      const where = `${record.scenarioId} #${record.repeat + 1} (tour ${i + 1})`;
      const first = t.firstProblems.map((p) => ({ where, final: t.problems.some((q) => q.proposed === p.proposed), p }));
      const onlySecond = t.problems.filter((q) => !t.firstProblems.some((p) => p.proposed === q.proposed)).map((p) => ({ where, final: true, p }));
      return [...first, ...onlySecond];
    }),
  );
  if (!rows.length) return "Aucun texte refusé.";
  const cell = (text: string | null) => (text ?? "(ajout)").replace(/\|/g, "/").replace(/\n/g, " ");
  const finals = rows.filter((r) => r.final);
  const others = rows.filter((r) => !r.final);
  return [
    `${finals.length} texte(s) refusé(s) après le second essai (jamais écrits dans le CV), ${others.length} corrigé(s) ou retiré(s) au second essai.`,
    "",
    "| Scénario (tour) | Issue | Emplacement | Texte d'origine | Texte proposé | Cause |",
    "|---|---|---|---|---|---|",
    ...[...finals, ...others]
      .slice(0, 20)
      .map((r) => `| ${r.where} | ${r.final ? "refusé" : "corrigé ou retiré au 2e essai"} | ${cell(r.p.label)} | ${cell(r.p.original)} | ${cell(r.p.proposed)} | ${cell(r.p.causes.join(" ; "))} |`),
  ].join("\n");
}

function caseSection(title: string, results: Result[], linked: boolean) {
  const rows = aggregate(results);
  if (!rows.length) return `## ${title}\n\nAucun scénario.\n`;
  const judged = results.filter((r) => r.record.judge);
  const criteria = JUDGE_CRITERIA.map((k) => `${k} ${fmt(median(judged.map((r) => r.record.judge![k].note)), 1)}`).join(" · ");
  const causes = Object.entries(merge(rows.map((r) => r.refusalsFirst)))
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} (${n})`)
    .join(" ; ");
  const worst = [...results].sort((a, b) => badness(b) - badness(a)).slice(0, 3);
  return [
    `## ${title}`,
    "",
    `${results.length} conversation(s), ${rows.length} scénario(s). Δ de score médian : ${fmt(median(results.map((r) => r.metrics.scoreDelta)))} ; 80 atteint : ${results.filter((r) => r.metrics.turnsTo80 !== null).length}/${results.length} ; juge (médianes) : ${judged.length ? criteria : "—"}.`,
    "",
    `Causes de refus (première vérification) : ${causes || "aucune"}.`,
    "",
    scenarioTable(rows, linked),
    "",
    "### Pistes (propositions, rien n'est modifié automatiquement)",
    "",
    pistes(results, rows),
    "",
    "### Textes refusés par la vérification (exemples réels)",
    "",
    refusedTable(results),
    "",
    "### Pires conversations",
    "",
    ...worst.map(transcriptMd),
  ].join("\n");
}

function holdoutSection(results: Result[]) {
  if (!results.length) return "";
  const lines = ["## Jeu tenu à l'écart (agrégats seulement)", "", "Ni transcription ni CV : ce jeu ne sert qu'à vérifier qu'une amélioration du prompt se généralise.", ""];
  for (const kase of ["libre", "lie"] as const) {
    const list = results.filter((r) => r.record.case === kase);
    if (!list.length) continue;
    const m = list.map((r) => r.metrics);
    const judged = list.map((r) => r.record.judge).filter((j) => j !== null);
    lines.push(
      `- **${kase === "libre" ? "CV libre" : "CV lié"}** : ${list.length} conversation(s) ; Δ médian ${fmt(median(m.map((x) => x.scoreDelta)))} ; 80 atteint ${m.filter((x) => x.turnsTo80 !== null).length}/${m.length} ; questions après 80 : ${sum(m.map((x) => x.closureViolations))} ; nombres inventés : ${m.filter((x) => x.inventedNumbers.length).length} ; demandes exécutées ${ratio(m.map((x) => x.requestDone))} ; secteur OK ${ratio(m.map((x) => x.sectorOk))} ; injection suivie ${ratio(m.map((x) => x.injectionFollowed))} ; annonces non fidèles ${sum(m.map((x) => x.unfaithfulClaims))} ; questions directes ignorées ${sum(m.map((x) => x.directQuestionsIgnored))} ; juge médian ${fmt(median(judged.map(judgeMean)), 1)}.`,
    );
  }
  return lines.join("\n") + "\n";
}

/** Dernier run complet précédent sur les mêmes fixtures (même empreinte), pour la comparaison. */
function previousRun(outRoot: string, meta: RunMeta): { meta: RunMeta; aggregates: ScenarioAggregate[] } | null {
  if (!existsSync(outRoot)) return null;
  const dirs = readdirSync(outRoot).filter((d) => d !== meta.runId).sort().reverse();
  for (const dir of dirs) {
    const file = join(outRoot, dir, "report.json");
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      // Même fixtures, même mode, run complet (un run interrompu ne sert pas de référence).
      if (json.meta?.fixturesHash === meta.fixturesHash && json.meta?.dry === meta.dry && !json.meta?.interrupted) {
        return { meta: json.meta, aggregates: json.aggregates };
      }
    } catch {
      // rapport illisible : ignoré
    }
  }
  return null;
}

function comparison(previous: ReturnType<typeof previousRun>, rows: ScenarioAggregate[]) {
  if (!previous) return "## Comparaison avec le run précédent\n\nAucun run précédent sur les mêmes fixtures.\n";
  const before = new Map(previous.aggregates.map((r) => [r.scenarioId, r]));
  const lines = [
    "## Comparaison avec le run précédent",
    "",
    `Run ${previous.meta.runId} (commit ${previous.meta.commit}, règles du coach ${previous.meta.coachRulesHash}).`,
    "",
    "Scénarios en commun seulement ; proportions et moyennes par lancement (les deux runs peuvent avoir un nombre de lancements différent).",
    "",
    "| Scénario | Δ score avant → maintenant | Juge avant → maintenant | Questions après 80 (par lancement) | Lancements avec nombres inventés | Demande exécutée |",
    "|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const p = before.get(r.scenarioId);
    if (!p) continue;
    lines.push(
      `| ${r.scenarioId} | ${fmt(p.delta)} → ${fmt(r.delta)} | ${fmt(p.judgeMean, 1)} → ${fmt(r.judgeMean, 1)} | ${fmt(p.closureViolations / p.runs, 1)} → ${fmt(r.closureViolations / r.runs, 1)} | ${p.inventedRuns}/${p.runs} → ${r.inventedRuns}/${r.runs} | ${p.requestDone} → ${r.requestDone} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export function writeReport(outRoot: string, meta: RunMeta, results: Result[], budget: BudgetState, estimate: Estimate) {
  const dir = join(outRoot, meta.runId);
  mkdirSync(dir, { recursive: true });
  const dev = results.filter((r) => r.record.set === "dev");
  const holdout = results.filter((r) => r.record.set === "holdout");
  const devRows = aggregate(dev);
  const previous = previousRun(outRoot, meta);

  const cost = [
    `## Coût ${meta.dry ? "(simulé : mode --dry, aucun appel)" : "réel"}`,
    "",
    `Dépensé : ${budget.spentEur.toFixed(2)} € sur un plafond de ${budget.capEur.toFixed(2)} € (estimation avant lancement : ${estimate.totalEur.toFixed(2)} €), ${budget.calls} appel(s).`,
    "",
    "| Rôle | Appels | Tokens entrée | Tokens sortie | € |",
    "|---|---|---|---|---|",
    ...(["coach", "simulator", "judge"] as const).map((r) => {
      const b = budget.byRole[r];
      return `| ${r} | ${b.calls} | ${b.inputTokens} | ${b.outputTokens} | ${b.eur.toFixed(2)} |`;
    }),
    "",
  ].join("\n");

  const md = [
    `# Banc d'essai du coach — ${meta.date}${meta.dry ? " (--dry)" : ""}`,
    "",
    meta.interrupted ? `**Run interrompu : ${meta.interrupted}. Rapport partiel.**\n` : null,
    `Modèles : coach ${meta.models.coach}, faux candidat ${meta.models.simulator}, juge ${meta.models.judge}. Commit ${meta.commit} ; règles du coach ${meta.coachRulesHash} ; fixtures ${meta.fixturesHash} ; ${meta.repeat} lancement(s) par scénario, ${meta.maxTurns} messages au plus.`,
    "",
    cost,
    caseSection("CV libre (poste visé déduit avec le candidat)", dev.filter((r) => r.record.case === "libre"), false),
    caseSection("CV lié à une offre (poste imposé par l'offre)", dev.filter((r) => r.record.case === "lie"), true),
    holdoutSection(holdout),
    comparison(previous, devRows),
  ]
    .filter((s) => s !== null)
    .join("\n");
  writeFileSync(join(dir, "report.md"), md);

  // JSON : tout pour le jeu de développement ; jeu tenu à l'écart réduit aux métriques.
  const json = {
    meta,
    budget,
    estimate,
    aggregates: devRows,
    holdoutAggregates: aggregate(holdout).map(({ scenarioId, case: c, runs, delta, reached80, closureViolations, inventedRuns, requestDone, judgeMean: j }) => ({
      scenarioId,
      case: c,
      runs,
      delta,
      reached80,
      closureViolations,
      inventedRuns,
      requestDone,
      judgeMean: j,
    })),
    conversations: dev.map((r) => ({ ...r.record, metrics: r.metrics })),
  };
  writeFileSync(join(dir, "report.json"), JSON.stringify(json, null, 1));
  return dir;
}
