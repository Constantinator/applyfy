// Génère l'extension pour Chrome et Firefox dans extension/dist/<navigateur>/.
// Le code est commun ; seule la déclaration du script d'arrière-plan diffère :
// service worker pour Chrome, scripts d'arrière-plan pour Firefox.
//
//   node extension/build.mjs          → version de production
//   node extension/build.mjs --dev    → ajoute http://localhost (npm run dev)

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes("--dev");
const base = JSON.parse(readFileSync(join(root, "manifest.base.json"), "utf8"));

if (dev) {
  // Les motifs d'URL n'acceptent pas de port : « localhost » couvre localhost:3000.
  const local = "http://localhost/*";
  base.host_permissions = [local, ...base.host_permissions];
  base.content_scripts[0].matches = [local, ...base.content_scripts[0].matches];
}

const targets = {
  chrome: {
    ...base,
    background: { service_worker: "background.js" },
  },
  firefox: {
    ...base,
    background: { scripts: ["url-match.js", "background.js"] },
    browser_specific_settings: {
      gecko: {
        id: "extension@applyfy.fr",
        strict_min_version: "128.0",
        // Le texte de la page d'offre est transmis à Applyfy.
        data_collection_permissions: { required: ["websiteContent"] },
      },
    },
  },
};

for (const [browser, manifest] of Object.entries(targets)) {
  const out = join(root, "dist", browser);
  // On vide le dossier sans le supprimer : il peut être verrouillé (Windows) quand
  // l'extension y est chargée ou qu'un terminal y est ouvert.
  mkdirSync(out, { recursive: true });
  for (const entry of readdirSync(out)) rmSync(join(out, entry), { recursive: true, force: true });
  cpSync(join(root, "src"), out, { recursive: true });
  cpSync(join(root, "icons"), join(out, "icons"), { recursive: true });
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ ${browser}${dev ? " (dev)" : ""} → extension/dist/${browser}`);
}
