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
  choiceDestination,
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
const { CV_IMPORT_MAX_LABEL } = await import("./cv-builder-types.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("barre : 4 segments (écran 1 ; écrans 2 et 2 bis ; écran 3 ; chemin A ou B)", () => {
  assert.equal(ONBOARDING_SEGMENTS, 4);
  assert.deepEqual(
    ONBOARDING_STEPS.map((step) => [step, segmentOf(step)]),
    [
      ["accueil", 1],
      ["apport", 2],
      ["temps", 2],
      ["cv", 3],
      ["chemin_cv", 4],
      ["chemin_offre", 4],
      ["guide_cv", 4],
      ["guide_telecharger", 4],
      ["guide_offre", 4],
    ],
  );
});

test("passages entre écrans : 1 → 2 → 2 bis → 3 → chemin A ou B, puis fin", () => {
  assert.deepEqual(ONBOARDING_SCREENS, ["accueil", "apport", "temps", "cv", "chemin_cv", "chemin_offre"]);
  assert.equal(nextScreen("accueil"), "apport");
  assert.equal(nextScreen("apport"), "temps");
  assert.equal(nextScreen("temps"), "cv");
  // « Ajouter mon CV » : chemin A ; « Plus tard » ou écran passé : chemin B.
  assert.equal(nextScreen("cv", "oui"), "chemin_cv");
  assert.equal(nextScreen("cv", "plus_tard"), "chemin_offre");
  assert.equal(nextScreen("cv", null), "chemin_offre");
  // Fin des chemins (et « Passer » sur ces écrans) : tableau de bord.
  assert.equal(nextScreen("chemin_cv", "oui"), null);
  assert.equal(nextScreen("chemin_offre", "plus_tard"), null);
});

test("chemins A et B : destination de chaque action", () => {
  assert.equal(choiceDestination("import"), "/cv-builder/importer");
  assert.equal(choiceDestination("zero"), "/cv-builder?nouveau=1");
  assert.equal(choiceDestination("recherche"), "/offres");
  assert.equal(
    choiceDestination("lien", "https://jobs.exemple.fr/offre?id=4&src=a b"),
    "/candidatures/nouvelle?lien=https%3A%2F%2Fjobs.exemple.fr%2Foffre%3Fid%3D4%26src%3Da%20b",
  );
});

test("reprise : là où la personne s'était arrêtée", () => {
  assert.equal(resumeScreen(null), "accueil");
  assert.equal(resumeScreen(undefined), "accueil");
  for (const screen of ONBOARDING_SCREENS) assert.equal(resumeScreen(screen), screen);
  assert.equal(resumeScreen("chemin_offre"), "chemin_offre");
  assert.equal(resumeScreen("ailleurs"), "accueil");
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
  assert.deepEqual(parseOnboardingState(ok), { step: "temps", jobSearch: "oui", hasCv: null, choice: null, skipped: ["apport"] });
  for (const choice of ["import", "zero", "lien", "recherche"]) {
    assert.equal(parseOnboardingState({ ...ok, step: "chemin_cv", choice }).choice, choice);
  }
  assert.equal(parseOnboardingState({ ...ok, choice: "premium" }), null);
  assert.equal(parseOnboardingState({ ...ok, step: "fin" }), null);
  assert.equal(parseOnboardingState({ ...ok, jobSearch: "peut-etre" }), null);
  assert.equal(parseOnboardingState({ ...ok, hasCv: "non" }), null);
  assert.equal(parseOnboardingState({ ...ok, skipped: ["ailleurs"] }), null);
  assert.equal(parseOnboardingState({ ...ok, skipped: "apport" }), null);
  assert.equal(parseOnboardingState(null), null);
});

test("statistiques admin : commencés, terminés, arrêts, réponses, écrans passés", () => {
  const rows = [
    { step: "chemin_cv", job_search: "oui", has_cv: "oui", choice: "import", skipped_steps: [], completed_at: "2026-11-21T10:00:00Z" },
    { step: "apport", job_search: "pas_encore", has_cv: null, choice: null, skipped_steps: [], completed_at: null },
    { step: "temps", job_search: null, has_cv: null, choice: null, skipped_steps: ["accueil", "apport"], completed_at: null },
    { step: "chemin_offre", job_search: "oui", has_cv: "plus_tard", choice: null, skipped_steps: ["cv"], completed_at: null },
    { step: "chemin_offre", job_search: "oui", has_cv: "plus_tard", choice: "recherche", skipped_steps: [], completed_at: "2026-11-21T11:00:00Z" },
  ];
  const stats = onboardingStats(rows, 6);
  assert.equal(stats.signups, 6);
  assert.equal(stats.started, 5);
  assert.equal(stats.completed, 2);
  assert.deepEqual(stats.stoppedAt, {
    accueil: 0,
    apport: 1,
    temps: 1,
    cv: 0,
    chemin_cv: 0,
    chemin_offre: 1,
    guide_cv: 0,
    guide_telecharger: 0,
    guide_offre: 0,
  });
  assert.deepEqual(stats.jobSearch, { oui: 3, pas_encore: 1, sans_reponse: 1 });
  assert.deepEqual(stats.hasCv, { oui: 1, plus_tard: 2, sans_reponse: 2 });
  assert.deepEqual(stats.choice, { import: 1, zero: 0, lien: 0, recherche: 1, aucune: 3 });
  assert.deepEqual(stats.skipped, {
    accueil: 1,
    apport: 1,
    temps: 0,
    cv: 1,
    chemin_cv: 0,
    chemin_offre: 0,
    guide_cv: 0,
    guide_telecharger: 0,
    guide_offre: 0,
  });
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
  assert.equal(T.cheminCv.title, "On part de ton CV.");
  assert.equal(T.cheminCv.subtitle, "Importe-le, ou on le construit ensemble, question par question.");
  assert.equal(T.cheminCv.import.detail(CV_IMPORT_MAX_LABEL), `PDF ou Word, ${CV_IMPORT_MAX_LABEL} max.`);
  assert.equal(T.cheminCv.import.detail("5 Mo"), "PDF ou Word, 5 Mo max.");
  assert.equal(T.cheminCv.zero.detail, "Je te guide pas à pas.");
  assert.equal(T.cheminCv.note, "Tu pourras tout modifier ensuite.");
  assert.equal(T.cheminOffre.title, "Quelle offre t'intéresse ?");
  assert.equal(T.cheminOffre.subtitle, "Colle le lien, je remplis la fiche pour toi.");
  assert.equal(T.cheminOffre.label, "Lien de l'offre");
  assert.equal(T.cheminOffre.submit, "Ajouter l'offre");
  assert.equal(`${T.cheminOffre.searchIntro} ${T.cheminOffre.search}`, "Pas d'offre sous la main ? Trouver une offre");
});

test("chemins A et B : chaque action enregistre son choix ; B termine le parcours, A ouvre la phase guidée", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /const choose = \(choice: OnboardingChoice, link = ""\) => finish\(\{ \.\.\.state, choice \}, choiceDestination\(choice, link\)\);/);
  assert.match(flow, /\["import", IconUpload,/);
  assert.match(flow, /\["zero", IconPencil,/);
  // Chemin A : la phase guidée commence (sans la migration 0047 : parcours terminé, cf. guide).
  assert.match(flow, /onChoose=\{\(\) => startCv\(choice\)\}/);
  assert.match(flow, /startCvPathAction\(\{ \.\.\.state, choice \}\)\)\.then\(\(\) => router\.push\(choiceDestination\(choice\)\)\)/);
  assert.match(flow, /<OfferLinkForm onSubmit=\{\(link\) => choose\("lien", link\)\}/);
  assert.match(flow, /onChoose=\{\(\) => choose\("recherche"\)\}/);
  // Fin : choix et completed_at en base, marque du compte, marque du navigateur.
  const server = read("lib/onboarding-server.ts");
  assert.match(server, /choice: state\.choice,/);
  assert.match(server, /saveOnboardingState\(state, true\), completeOnboarding\(\)/);
  // Lien vide ou invalide : message lisible, la sortie du parcours reste possible.
  assert.match(flow, /role="alert"/);
  assert.match(flow, /<label htmlFor="ob-offer-link"/);
  assert.match(flow, /id="ob-offer-link"/);
});

test("chemin B : aucun lien ni texte Premium", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  const start = flow.indexOf('{screen === "chemin_offre" && (');
  assert.ok(start > 0);
  const block = flow.slice(start, flow.indexOf("</main>", start));
  const form = flow.slice(flow.indexOf("function OfferLinkForm"), flow.indexOf("function Pill"));
  for (const source of [block, form, JSON.stringify(T.cheminOffre)]) {
    assert.doesNotMatch(source, /premium/i);
  }
  assert.doesNotMatch(flow, /\/premium|PlanChoice|PremiumCard/);
});

test("« Le créer de zéro » : la fenêtre de création s'ouvre d'office, au tutoiement", () => {
  const page = read("app/(app)/cv-builder/page.tsx");
  assert.match(page, /autoOpen=\{!detail && nouveau === "1"\}/);
  const dialog = read("components/cv-builder/new-cv-dialog.tsx");
  assert.match(dialog, /Quel poste vises-tu \?/);
  assert.doesNotMatch(dialog, /\bvous\b|\bvotre\b|\bvos\b|visez/i);
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
  // 0045 : les écrans de /bienvenue (la 0047 ajoute les étapes de la phase guidée).
  assert.match(sql, new RegExp(`check \\(step in \\(${list(ONBOARDING_SCREENS)}\\)\\)`));
  assert.ok(sql.includes(`skipped_steps <@ array[${list(ONBOARDING_SCREENS)}]::text[]`));
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
  assert.doesNotMatch(outside, /ob-(fill|pop|rise|wave|jump|wow|pulse|tilt|nod|blink|lean|think)/, "aucune animation du parcours hors du bloc");
  const block = css.slice(start, end);
  for (const name of ["ob-fill", "ob-pop", "ob-rise", "ob-wave", "ob-jump", "ob-wow", "ob-pulse", "ob-tilt", "ob-nod", "ob-blink", "ob-lean"]) {
    assert.match(block, new RegExp(`@keyframes ${name}`), name);
  }
  assert.doesNotMatch(block, /pointer-events/, "aucun clic bloqué pendant une animation");
});

test("redirections : tableau de bord ↔ /bienvenue, même règle des deux côtés (pas de boucle)", () => {
  const dashboard = read("app/(app)/dashboard/page.tsx");
  assert.match(
    dashboard,
    /const onboarding = await getOnboardingEntry\(\);\s*if \(onboarding\) redirect\(onboarding\.target\.kind === "editeur" \? `\/cv-builder\/\$\{onboarding\.target\.cvId\}` : "\/bienvenue"\);/,
  );
  const page = read("app/(onboarding)/bienvenue/page.tsx");
  assert.match(page, /const entry = await getOnboardingEntry\(\);\s*if \(!entry\) redirect\("\/dashboard"\);/);
  assert.match(page, /if \(entry\.target\.kind === "editeur"\) redirect\(`\/cv-builder\/\$\{entry\.target\.cvId\}`\);/);
  assert.match(read("proxy.ts"), /"\/bienvenue"\]/);
  const server = read("lib/onboarding-server.ts");
  // Fin du parcours : marque posée dans le navigateur avant les écritures en base.
  assert.ok(server.indexOf("cookies()).set(DONE_COOKIE") < server.indexOf("saveOnboardingState(state, true)"));
  // Table absente ou illisible : pas de parcours.
  assert.match(server, /isMissingTable\(error\)/);
  assert.match(server, /if \(row === "illisible" \|\| row\?\.completed_at\) return null;/);
});
