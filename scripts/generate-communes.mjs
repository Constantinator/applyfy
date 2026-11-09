// Génère src/lib/communes-fr.ts : noms officiels des communes, départements et régions, d'après
// l'API publique Découpage administratif (geo.api.gouv.fr, sans clé). Sert au nettoyage des lieux
// de la collecte (src/lib/offer-location.ts), pour afficher « Évreux » plutôt que « EVREUX » et
// reconnaître les régions et départements à retirer.
//
// À relancer à la main de temps en temps (fusions de communes), jamais pendant la collecte :
//   node scripts/generate-communes.mjs
import { writeFileSync } from "node:fs";

const API = "https://geo.api.gouv.fr";
const OUTPUT = new URL("../src/lib/communes-fr.ts", import.meta.url);

async function names(path, minimum) {
  const response = await fetch(`${API}${path}`, {
    headers: { "User-Agent": "ApplyfyBot/0.1 (+https://applyfy.fr)", Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${path} : HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < minimum) throw new Error(`${path} : réponse inattendue (${rows?.length} lignes)`);
  const list = [...new Set(rows.map((row) => String(row.nom).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  if (list.some((name) => /[\n`\\]|\$\{/.test(name))) throw new Error(`${path} : nom inattendu`);
  return { count: rows.length, list };
}

const communes = await names("/communes?fields=nom&format=json", 30_000);
const departments = await names("/departements?fields=nom", 100);
const regions = await names("/regions?fields=nom", 13);

const generatedAt = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ, date locale
writeFileSync(
  OUTPUT,
  `// Fichier généré par scripts/generate-communes.mjs le ${generatedAt} : ne pas modifier à la main.
// Source : ${API} (${communes.count} communes, ${communes.list.length} noms distincts ; ${departments.count} départements ; ${regions.count} régions).
// Utilisé uniquement par la collecte (cron et scripts), jamais importé par une page ni un composant.

/** Noms officiels des communes, un par ligne. */
export const COMMUNE_NAMES = \`${communes.list.join("\n")}\`;

export const DEPARTMENT_NAMES = ${JSON.stringify(departments.list)};

export const REGION_NAMES = ${JSON.stringify(regions.list)};
`,
);
console.log(`${communes.list.length} communes, ${departments.list.length} départements, ${regions.list.length} régions → ${OUTPUT.pathname}`);
