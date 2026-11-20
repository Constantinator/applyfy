// Parcours d'accueil (/bienvenue). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const {
  INITIAL_ONBOARDING_STATE,
  ONBOARDING_LAUNCHED_AT,
  ONBOARDING_SCREENS,
  ONBOARDING_SEGMENTS,
  ONBOARDING_STEPS,
  isAfterLaunch,
  nextScreen,
  onboardingStats,
  parseOnboardingState,
  resumeScreen,
  segmentOf,
  withSkipped,
} = await import("./onboarding.ts");
const { ONBOARDING_TEXTS: T } = await import("./lumeo-texts.ts");
const { AI_MONTHLY_LIMITS } = await import("./ai-usage-limits.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("barre : 4 segments (écran 1 ; écrans 2 et 2 bis ; écran 3 ; chemin A ou B)", () => {
  assert.equal(ONBOARDING_SEGMENTS, 4);
  assert.deepEqual(
    ONBOARDING_STEPS.map((step) => [step, segmentOf(step)]),
    [["accueil", 1], ["apport", 2], ["temps", 2], ["cv", 3], ["chemin_cv", 4], ["chemin_offre", 4]],
  );
});

test("passages entre écrans : 1 → 2 → 2 bis → 3, puis fin", () => {
  assert.deepEqual(ONBOARDING_SCREENS, ["accueil", "apport", "temps", "cv"]);
  assert.equal(nextScreen("accueil"), "apport");
  assert.equal(nextScreen("apport"), "temps");
  assert.equal(nextScreen("temps"), "cv");
  assert.equal(nextScreen("cv"), null);
});

test("reprise : là où la personne s'était arrêtée", () => {
  assert.equal(resumeScreen(null), "accueil");
  assert.equal(resumeScreen(undefined), "accueil");
  for (const screen of ONBOARDING_SCREENS) assert.equal(resumeScreen(screen), screen);
  // Écran d'un lot futur enregistré : on reprend au dernier écran disponible.
  assert.equal(resumeScreen("chemin_cv"), "cv");
  assert.equal(resumeScreen("chemin_offre"), "cv");
});

test("« Passer » : écran noté une seule fois", () => {
  const once = withSkipped(INITIAL_ONBOARDING_STATE, "accueil");
  assert.deepEqual(once.skipped, ["accueil"]);
  assert.equal(withSkipped(once, "accueil"), once);
  assert.deepEqual(withSkipped(once, "temps").skipped, ["accueil", "temps"]);
  assert.deepEqual(INITIAL_ONBOARDING_STATE.skipped, [], "l'état initial n'est pas modifié");
});

test("date de coupure : seuls les comptes créés après la mise en ligne", () => {
  const launch = Date.parse(ONBOARDING_LAUNCHED_AT);
  assert.ok(!Number.isNaN(launch));
  assert.equal(isAfterLaunch(ONBOARDING_LAUNCHED_AT), true);
  assert.equal(isAfterLaunch(new Date(launch + 1000).toISOString()), true);
  assert.equal(isAfterLaunch(new Date(launch - 1000).toISOString()), false);
  assert.equal(isAfterLaunch("2026-09-30T10:00:00Z"), false, "premier compte d'Applyfy");
  assert.equal(isAfterLaunch(null), false);
  assert.equal(isAfterLaunch("pas une date"), false);
  // Comptes existants : jamais de parcours (la règle passe par isAfterLaunch, mode démo exclu).
  const account = read("lib/account.ts");
  assert.match(account, /if \(!isSupabaseConfigured\(\)\) return false;/);
  assert.match(account, /isAfterLaunch\(user\.created_at\)/);
});

test("état reçu du navigateur : validé", () => {
  const ok = { step: "temps", jobSearch: "oui", hasCv: null, skipped: ["apport", "apport"] };
  assert.deepEqual(parseOnboardingState(ok), { step: "temps", jobSearch: "oui", hasCv: null, skipped: ["apport"] });
  assert.equal(parseOnboardingState({ ...ok, step: "fin" }), null);
  assert.equal(parseOnboardingState({ ...ok, jobSearch: "peut-etre" }), null);
  assert.equal(parseOnboardingState({ ...ok, hasCv: "non" }), null);
  assert.equal(parseOnboardingState({ ...ok, skipped: ["ailleurs"] }), null);
  assert.equal(parseOnboardingState({ ...ok, skipped: "apport" }), null);
  assert.equal(parseOnboardingState(null), null);
});

test("statistiques admin : commencés, terminés, arrêts, réponses, écrans passés", () => {
  const rows = [
    { step: "cv", job_search: "oui", has_cv: "oui", skipped_steps: [], completed_at: "2026-11-21T10:00:00Z" },
    { step: "apport", job_search: "pas_encore", has_cv: null, skipped_steps: [], completed_at: null },
    { step: "temps", job_search: null, has_cv: null, skipped_steps: ["accueil", "apport"], completed_at: null },
    { step: "chemin_cv", job_search: "oui", has_cv: "plus_tard", skipped_steps: ["cv"], completed_at: null },
  ];
  const stats = onboardingStats(rows, 6);
  assert.equal(stats.signups, 6);
  assert.equal(stats.started, 4);
  assert.equal(stats.completed, 1);
  assert.deepEqual(stats.stoppedAt, { accueil: 0, apport: 1, temps: 1, cv: 1 });
  assert.deepEqual(stats.jobSearch, { oui: 2, pas_encore: 1, sans_reponse: 1 });
  assert.deepEqual(stats.hasCv, { oui: 1, plus_tard: 1, sans_reponse: 2 });
  assert.deepEqual(stats.skipped, { accueil: 1, apport: 1, temps: 0, cv: 1 });
});

/** Toutes les phrases du parcours (fonctions appelées avec des valeurs de test). */
function allTexts() {
  const out = [];
  const walk = (value) => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(T);
  return out;
}

test("textes : ceux validés, prénom facultatif", () => {
  assert.equal(T.accueil.title("Inès"), "Salut Inès, moi c'est Lumeo.");
  assert.equal(T.accueil.title(null), "Salut, moi c'est Lumeo.");
  assert.equal(T.accueil.question, "Tu cherches un job en ce moment ?");
  assert.deepEqual(T.accueil.oui, { title: "Oui, je cherche", detail: "Je t'aide à postuler plus vite." });
  assert.deepEqual(T.accueil.pasEncore, { title: "Pas encore", detail: "On prépare le terrain ensemble." });
  assert.equal(T.apport.title, "Applyfy t'aide à postuler sans te perdre.");
  assert.deepEqual(T.apport.items.filter((item) => item.soon).map((item) => item.title), ["Remplir tes candidatures"]);
  assert.equal(T.temps.title, "Applyfy t'aide à gagner du temps sur chaque candidature.");
  assert.equal(T.temps.detail, "Ton CV, tes lettres et ton suivi au même endroit.");
  assert.equal(T.cv.title, "Tu as déjà un CV ?");
  assert.equal(T.cv.add.badge, "Conseillé");
  assert.equal(T.cv.importNote(AI_MONTHLY_LIMITS.cvb_import), `Gratuit : ${AI_MONTHLY_LIMITS.cvb_import} import de CV par mois.`);
  assert.equal(T.cv.importNote(1), "Gratuit : 1 import de CV par mois.");
  assert.equal(T.progress(2, 4), "Étape 2 sur 4");
});

test("textes : aucun chiffre écrit, tutoiement, sans emoji, ni « illimité » ni « sans limite »", () => {
  const texts = allTexts().join("\n");
  assert.doesNotMatch(texts, /\d/, "aucun chiffre en dur (la note d'import lit AI_MONTHLY_LIMITS)");
  assert.doesNotMatch(texts, /illimit|sans limite/i);
  assert.doesNotMatch(texts, /\bvous\b|\bvotre\b|\bvos\b/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
  for (const path of ["components/onboarding/onboarding-flow.tsx", "app/(onboarding)/bienvenue/page.tsx", "components/admin/onboarding-section.tsx"]) {
    assert.doesNotMatch(read(path), /illimit|sans limite/i, path);
  }
});

test("écran 2 bis : sans chiffre ; emplacement de preuve facultatif, vide dans ce lot", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /\{timeSavingProof && <div/);
  assert.doesNotMatch(read("app/(onboarding)/bienvenue/page.tsx"), /timeSavingProof|getPublicTimeSaving/);
  assert.doesNotMatch(flow, /\d+\s?%/);
});

test("migration 0045 : mêmes valeurs que le code, RLS, retour arrière", () => {
  const sql = read("../supabase/migrations/0045_onboarding.sql");
  const list = (values) => values.map((v) => `'${v}'`).join(", ");
  assert.match(sql, new RegExp(`check \\(step in \\(${list(ONBOARDING_STEPS)}\\)\\)`));
  assert.ok(sql.includes(`skipped_steps <@ array[${list(ONBOARDING_STEPS)}]::text[]`));
  assert.match(sql, /check \(job_search in \('oui', 'pas_encore'\)\)/);
  assert.match(sql, /check \(has_cv in \('oui', 'plus_tard'\)\)/);
  assert.match(sql, /check \(choice in \('import', 'zero', 'lien', 'recherche'\)\)/);
  assert.match(sql, /create table if not exists onboarding_progress/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on onboarding_progress from anon;/);
  for (const action of ["select", "insert", "update"]) assert.match(sql, new RegExp(`for ${action} `));
  assert.match(sql, /Retour arrière : drop table if exists onboarding_progress;/);
  assert.doesNotMatch(sql, /^\s*drop table/m);
});

test("barre de progression accessible : role, libellé, valeurs", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /role="progressbar"/);
  assert.match(flow, /aria-label=\{T\.progress\(segment, ONBOARDING_SEGMENTS\)\}/);
  assert.match(flow, /aria-valuemin=\{1\}/);
  assert.match(flow, /aria-valuemax=\{ONBOARDING_SEGMENTS\}/);
  assert.match(flow, /aria-valuenow=\{segment\}/);
  // Vrais boutons, pas de lien Premium dans le parcours.
  assert.doesNotMatch(flow, /\/premium|PlanChoice|PremiumCard/);
  assert.doesNotMatch(flow, /<div[^>]*onClick/);
});

test("animations : toutes dans prefers-reduced-motion: no-preference", () => {
  const css = read("app/globals.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  @keyframes ob-fill");
  assert.ok(start >= 0, "bloc des animations du parcours");
  // Fin du bloc : accolade fermante au niveau de @media.
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const outside = css.slice(0, start) + css.slice(end + 1);
  assert.doesNotMatch(outside, /ob-(fill|pop|rise|wave|jump|wow|pulse|tilt)/, "aucune animation du parcours hors du bloc");
  const block = css.slice(start, end);
  for (const name of ["ob-fill", "ob-pop", "ob-rise", "ob-wave", "ob-jump", "ob-wow", "ob-pulse", "ob-tilt"]) {
    assert.match(block, new RegExp(`@keyframes ${name}`), name);
  }
  assert.doesNotMatch(block, /pointer-events/, "aucun clic bloqué pendant une animation");
});

test("redirections : tableau de bord ↔ /bienvenue, même règle des deux côtés (pas de boucle)", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  assert.match(dashboard, /if \(!welcomePremium && \(await getOnboardingEntry\(\)\)\) redirect\("\/bienvenue"\);/);
  const page = read("app/(onboarding)/bienvenue/page.tsx");
  assert.match(page, /const entry = await getOnboardingEntry\(\);\s*if \(!entry\) redirect\("\/dashboard"\);/);
  assert.match(read("proxy.ts"), /"\/bienvenue"\]/);
  const server = read("lib/onboarding-server.ts");
  // Fin du parcours : marque posée dans le navigateur avant les écritures en base.
  assert.ok(server.indexOf("cookies()).set(DONE_COOKIE") < server.indexOf("saveOnboardingState(state, true)"));
  // Table absente ou illisible : pas de parcours.
  assert.match(server, /isMissingTable\(error\)/);
  assert.match(server, /return null;\s*\}\s*if \(data\?\.completed_at\) return null;/);
});
