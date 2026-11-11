// Comparaison d'un run avec un run de référence, sur les scénarios communs seulement : même
// identifiant ET mêmes fixtures (scénario, profil, offre, persona, mots-clés du marché). L'empreinte
// globale des fixtures change dès qu'un scénario est ajouté ; l'empreinte par scénario, non.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Lecture des fixtures : texte d'un fichier (chemin relatif à fixtures/), null s'il manque ; liste d'un dossier. */
export type FixtureReader = { read: (rel: string) => string | null; list: (dir: string) => string[] };

const FIXTURES_DIR = new URL("./fixtures/", import.meta.url);

/** Fixtures du dossier de travail. */
export const fsFixtureReader: FixtureReader = {
  read: (rel) => {
    const url = new URL(rel, FIXTURES_DIR);
    return existsSync(url) ? readFileSync(url, "utf8") : null;
  },
  list: (dir) => {
    const url = new URL(`${dir}/`, FIXTURES_DIR);
    return existsSync(url) ? readdirSync(url) : [];
  },
};

/** Fixtures telles qu'elles étaient à un commit (git, lecture seule) ; null si git ne le connaît pas. */
export function gitFixtureReader(commit: string): FixtureReader | null {
  if (!/^[0-9a-f]{7,40}$/i.test(commit)) return null;
  const git = (args: string[]) => {
    try {
      return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] }).toString();
    } catch {
      return null;
    }
  };
  if (git(["cat-file", "-e", `${commit}^{commit}`]) === null) return null;
  const base = "scripts/eval/fixtures";
  return {
    read: (rel) => git(["show", `${commit}:${base}/${rel}`]),
    list: (dir) => (git(["ls-tree", "--name-only", `${commit}:${base}/${dir}`]) ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
  };
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);
const parse = <T>(text: string | null, fallback: T): T => {
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

type RawScenario = { id: string; profile: string; offer?: string; persona: string };
type RawProfile = { id: string; sector?: string };
type RawOffer = { id: string; sector?: string };

/**
 * Empreinte de chaque scénario : le scénario, son profil, son offre, sa persona et les mots-clés
 * du marché de ses secteurs (JSON relu : la mise en forme des fichiers ne compte pas).
 */
export function scenarioFingerprints(reader: FixtureReader): Record<string, string> {
  const profiles = new Map<string, RawProfile>();
  for (const set of ["dev", "holdout"]) {
    for (const file of reader.list(`profiles/${set}`).filter((f) => f.endsWith(".json"))) {
      const p = parse<RawProfile | null>(reader.read(`profiles/${set}/${file}`), null);
      if (p?.id) profiles.set(p.id, p);
    }
  }
  const offers = new Map(parse<{ offers: RawOffer[] }>(reader.read("offers.json"), { offers: [] }).offers.map((o) => [o.id, o]));
  const personas = parse<Record<string, string>>(reader.read("personas.json"), {});
  const market = parse<Record<string, unknown>>(reader.read("market-keywords.json"), {});
  const scenarios = parse<{ scenarios: RawScenario[] }>(reader.read("scenarios.json"), { scenarios: [] }).scenarios;
  const out: Record<string, string> = {};
  for (const s of scenarios) {
    const profile = profiles.get(s.profile) ?? null;
    const offer = s.offer ? (offers.get(s.offer) ?? null) : null;
    out[s.id] = sha(
      JSON.stringify([
        s,
        profile,
        offer,
        personas[s.persona] ?? null,
        profile?.sector ? (market[profile.sector] ?? null) : null,
        offer?.sector ? (market[offer.sector] ?? null) : null,
      ]),
    );
  }
  return out;
}

/** Ce qu'un report.json garde d'un run, utile à la comparaison. */
export type ReferenceRun<A> = {
  meta: { runId: string; commit: string; coachRulesHash: string; dry: boolean; repeat: number; scenarioHashes?: Record<string, string> };
  aggregates: A[];
};

/**
 * Run de référence : celui demandé (`--compare <runId>`), sinon le dernier run complet du même
 * mode (vrai ou --dry), quelles que soient ses fixtures. null s'il n'y en a pas.
 */
export function findReference<A>(outRoot: string, current: { runId: string; dry: boolean }, wanted: string | null): ReferenceRun<A> | null {
  if (!existsSync(outRoot)) return null;
  const read = (dir: string) => {
    const file = join(outRoot, dir, "report.json");
    if (!existsSync(file)) return null;
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      return json.meta && Array.isArray(json.aggregates) ? (json as ReferenceRun<A> & { meta: { interrupted?: string | null } }) : null;
    } catch {
      return null;
    }
  };
  if (wanted) {
    const run = read(wanted);
    if (!run) throw new Error(`--compare : run ${wanted} introuvable ou illisible dans ${outRoot}`);
    return run;
  }
  for (const dir of readdirSync(outRoot).filter((d) => d !== current.runId).sort().reverse()) {
    const run = read(dir);
    if (run && run.meta.dry === current.dry && !run.meta.interrupted) return run;
  }
  return null;
}

export type ScenarioSplit = {
  compared: string[];
  /** Exclus, avec la raison. */
  excluded: { id: string; reason: string }[];
  /** Comment les fixtures du run de référence ont été retrouvées. */
  source: "empreintes enregistrées" | "fixtures relues au commit du run de référence" | "non vérifiées (commit introuvable)";
};

/** Scénarios comparables : présents dans les deux runs, avec les mêmes fixtures. */
export function splitScenarios(current: { ids: string[]; hashes: Record<string, string> }, reference: ReferenceRun<{ scenarioId: string }>): ScenarioSplit {
  let refHashes = reference.meta.scenarioHashes ?? null;
  let source: ScenarioSplit["source"] = "empreintes enregistrées";
  if (!refHashes) {
    const reader = gitFixtureReader(reference.meta.commit);
    refHashes = reader ? scenarioFingerprints(reader) : null;
    source = reader ? "fixtures relues au commit du run de référence" : "non vérifiées (commit introuvable)";
  }
  const refIds = new Set(reference.aggregates.map((a) => a.scenarioId));
  const compared: string[] = [];
  const excluded: ScenarioSplit["excluded"] = [];
  for (const id of current.ids) {
    if (!refIds.has(id)) excluded.push({ id, reason: "absent du run de référence" });
    else if (refHashes && refHashes[id] !== current.hashes[id]) excluded.push({ id, reason: "fixtures modifiées depuis le run de référence" });
    else compared.push(id);
  }
  for (const id of refIds) if (!current.ids.includes(id)) excluded.push({ id, reason: "absent de ce run" });
  return { compared, excluded, source };
}
