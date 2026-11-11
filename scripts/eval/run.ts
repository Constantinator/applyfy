// Banc d'essai du coach du CV Builder. Script LOCAL : jamais importé par l'application, jamais
// déployé, jamais lancé en CI. Voir scripts/eval/README.md.
//
//   npm run eval:coach -- --dry                 réponses simulées, aucun appel, 0 €
//   npm run eval:coach -- --repeat 1 --only L01-parcours-finance,O02-finance-vers-tech
//   npm run eval:coach -- --holdout             ajoute le jeu tenu à l'écart (agrégats seulement)
//
// Vrai run : EVAL_ANTHROPIC_API_KEY et EVAL_MAX_COST_EUR dans l'environnement local (rien d'autre
// n'est lu), estimation affichée, confirmation demandée, arrêt dès que le plafond serait dépassé.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

import { COACH_RULES } from "../../src/lib/coach-prompt.ts";
import { BudgetExceeded, meteredClient, newBudget, type ParseClient } from "./budget.ts";
import { DEFAULTS, MODELS } from "./config.ts";
import { runConversation, type Clients } from "./conversation.ts";
import { dryClients } from "./dry.ts";
import { estimateRun } from "./estimate.ts";
import { loadFixtures, type Scenario } from "./fixtures.ts";
import { computeMetrics } from "./metrics.ts";
import { writeReport, type Result, type RunMeta } from "./report.ts";

type Options = {
  dry: boolean;
  holdout: boolean;
  only: string[] | null;
  case: "libre" | "lie" | null;
  repeat: number;
  maxTurns: number;
  concurrency: number;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { dry: false, holdout: false, only: null, case: null, repeat: DEFAULTS.repeat, maxTurns: DEFAULTS.maxTurns, concurrency: 4 };
  const int = (value: string | undefined, name: string, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`--${name} : entier entre ${min} et ${max} attendu`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry") options.dry = true;
    else if (arg === "--holdout") options.holdout = true;
    else if (arg === "--only") options.only = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--case") {
      const value = argv[++i];
      if (value !== "libre" && value !== "lie") throw new Error("--case : libre ou lie");
      options.case = value;
    } else if (arg === "--repeat") options.repeat = int(argv[++i], "repeat", 1, 10);
    else if (arg === "--max-turns") options.maxTurns = int(argv[++i], "max-turns", 1, 20);
    else if (arg === "--concurrency") options.concurrency = int(argv[++i], "concurrency", 1, 8);
    else throw new Error(`Option inconnue : ${arg}`);
  }
  return options;
}

function select(scenarios: Scenario[], options: Options) {
  let list = scenarios.filter((s) => s.set === "dev" || options.holdout);
  if (options.case) list = list.filter((s) => s.case === options.case);
  if (options.only) {
    const unknown = options.only.filter((id) => !scenarios.some((s) => s.id === id));
    if (unknown.length) throw new Error(`Scénario(s) inconnu(s) : ${unknown.join(", ")}`);
    list = list.filter((s) => options.only!.includes(s.id));
  }
  return list;
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);
const commit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "?";
  }
};

/** Clients réels, sur la seule clé du banc d'essai ; jamais ANTHROPIC_API_KEY ni un autre jeton. */
async function realClients(budget: ReturnType<typeof newBudget>) {
  const apiKey = process.env.EVAL_ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("EVAL_ANTHROPIC_API_KEY absente de l'environnement local (ou utilise --dry).");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, authToken: null, baseURL: "https://api.anthropic.com", maxRetries: 2 }) as unknown as ParseClient;
  return {
    coach: meteredClient(client, budget, "coach"),
    simulator: meteredClient(client, budget, "simulator"),
    judge: meteredClient(client, budget, "judge"),
  };
}

async function confirm(question: string) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(o|oui|y|yes)$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fx = loadFixtures();
  const scenarios = select(fx.scenarios, options);
  if (!scenarios.length) throw new Error("Aucun scénario sélectionné.");

  const cap = Number(process.env.EVAL_MAX_COST_EUR);
  if (!options.dry && !(cap > 0)) throw new Error("EVAL_MAX_COST_EUR absent ou invalide (plafond en euros, ex. 35).");
  const budget = newBudget(options.dry ? (cap > 0 ? cap : 35) : cap);

  const estimate = estimateRun(fx, scenarios, options.repeat, options.maxTurns);
  const libre = scenarios.filter((s) => s.case === "libre").length;
  console.log(
    [
      `Banc d'essai du coach${options.dry ? " (--dry : réponses simulées, aucun appel, 0 €)" : ""}`,
      `Scénarios : ${scenarios.length} (${libre} CV libre, ${scenarios.length - libre} CV lié${options.holdout ? ", jeu tenu à l'écart compris" : ""}) × ${options.repeat} = ${estimate.conversations} conversations, ${options.maxTurns} messages au plus`,
      `Modèles : coach ${MODELS.coach}, faux candidat ${MODELS.simulator}, juge ${MODELS.judge}`,
      `Estimation ${options.dry ? "d'un vrai run équivalent" : "avant lancement"} : ${estimate.totalEur.toFixed(2)} € ` +
        `(coach ${estimate.eur.coach.toFixed(2)} € / ${Math.round(estimate.calls.coach)} appels, faux candidat ${estimate.eur.simulator.toFixed(2)} € / ${Math.round(estimate.calls.simulator)}, juge ${estimate.eur.judge.toFixed(2)} € / ${estimate.calls.judge})`,
      `Plafond : ${budget.capEur.toFixed(2)} €${estimate.totalEur > budget.capEur ? " — l'estimation dépasse le plafond : le run s'arrêtera avant la fin" : ""}`,
    ].join("\n"),
  );

  let shared: Awaited<ReturnType<typeof realClients>> | null = null;
  if (!options.dry) {
    shared = await realClients(budget);
    if (!(await confirm("Lancer ce run payant ? (o/N) "))) {
      console.log("Annulé : aucun appel.");
      return;
    }
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + (options.dry ? "-dry" : "");
  const meta: RunMeta = {
    runId,
    date: new Date().toISOString(),
    dry: options.dry,
    models: { ...MODELS },
    commit: commit(),
    fixturesHash: fx.hash,
    coachRulesHash: hash(COACH_RULES),
    repeat: options.repeat,
    maxTurns: options.maxTurns,
    holdout: options.holdout,
    interrupted: null,
  };

  // Conversations en parallèle (pool) ; arrêt de toutes dès que le plafond est atteint.
  const tasks = scenarios.flatMap((scenario) => Array.from({ length: options.repeat }, (_, repeat) => ({ scenario, repeat })));
  const results: Result[] = [];
  let next = 0;
  let stopped: string | null = null;
  const quiet = { warn: console.warn, error: console.error };
  // Journaux de l'échange (coach-turn, claude-structured) : coupés, ils sont dans le rapport.
  console.warn = () => {};
  console.error = () => {};
  const worker = async () => {
    while (!stopped && next < tasks.length) {
      const { scenario, repeat } = tasks[next++];
      // --dry : faux clients comptés comme les vrais (coût simulé, plafond testé).
      const dry = options.dry ? dryClients(scenario) : null;
      const clients: Clients = dry
        ? { coach: meteredClient(dry.coach, budget, "coach"), simulator: meteredClient(dry.simulator, budget, "simulator"), judge: meteredClient(dry.judge, budget, "judge") }
        : shared!;
      const record = await runConversation(fx, scenario, repeat, clients, options.maxTurns);
      const metrics = computeMetrics(record, scenario);
      results.push({ record, metrics });
      if (record.endReason === "plafond") stopped = record.error ?? new BudgetExceeded(budget.spentEur, budget.capEur).message;
      process.stdout.write(
        `${String(results.length).padStart(3)}/${tasks.length} ${scenario.id} #${repeat + 1} : ${record.startScore} → ${record.endScore}, ${record.turns.length} message(s), fin ${record.endReason}${record.error ? ` (${record.error})` : ""} — ${budget.spentEur.toFixed(2)} €\n`,
      );
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(options.concurrency, tasks.length) }, worker));
  } finally {
    console.warn = quiet.warn;
    console.error = quiet.error;
  }
  meta.interrupted = stopped;

  const outRoot = fileURLToPath(new URL("../../eval-runs/", import.meta.url));
  results.sort((a, b) => a.record.scenarioId.localeCompare(b.record.scenarioId) || a.record.repeat - b.record.repeat);
  const dir = writeReport(outRoot, meta, results, budget, estimate);
  console.log(`\nRapport : ${dir}\\report.md (et report.json)${stopped ? `\nInterrompu : ${stopped}` : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
