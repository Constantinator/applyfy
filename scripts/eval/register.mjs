// Chargeur du banc d'essai (comme les tests de src/lib) : imports sans extension entre fichiers
// .ts, et JSON importé sans attribut. Utilisé par `npm run eval:coach` (node --import).
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts") && !/\.[a-z]+$/i.test(spec)) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
