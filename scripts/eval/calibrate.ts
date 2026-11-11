// Score de départ et secteur détecté de chaque profil (mode libre), pour calibrer les fixtures.
// Usage : node --import ./scripts/eval/register.mjs scripts/eval/calibrate.ts [--detail]
import { readdirSync, readFileSync } from "node:fs";

import { chatContent, CvDataSchema, targetJobOf } from "../../src/lib/cv-builder-types.ts";
import { scoreCv } from "../../src/lib/cv-score.ts";
import { cvScoringSector } from "../../src/lib/cv-sector-context.ts";
import { scoringContextForSector } from "../../src/lib/cv-scoring-context.ts";

const root = new URL("./fixtures/profiles/", import.meta.url);
// Mêmes mots-clés du marché que le banc d'essai (figés).
const market = JSON.parse(readFileSync(new URL("./fixtures/market-keywords.json", import.meta.url), "utf8"));
for (const set of ["dev", "holdout"]) {
  for (const file of readdirSync(new URL(`${set}/`, root))) {
    const profile = JSON.parse(readFileSync(new URL(`${set}/${file}`, root), "utf8"));
    const cv = CvDataSchema.parse(profile.cv);
    const sector = cvScoringSector(JSON.stringify(chatContent(cv)), targetJobOf(cv), null);
    const score = scoreCv(cv, scoringContextForSector(sector, null, market[sector] ?? []));
    console.log(`${set.padEnd(8)} ${profile.id.padEnd(24)} attendu=${profile.sector.padEnd(10)} détecté=${sector.padEnd(10)} score=${score.score}`);
    if (process.argv.includes("--detail")) for (const c of score.corrections) console.log(`         +${c.points} ${c.message}`);
  }
}
