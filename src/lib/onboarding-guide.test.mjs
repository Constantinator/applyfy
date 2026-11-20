// Phase guidée du CV Builder (chemin A du parcours d'accueil, lot 6a). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { GUIDE_STEPS, ONBOARDING_LAUNCHED_AT, ONBOARDING_STEPS, guidedEditorStep, resumeTarget } = await import("./onboarding.ts");
const { guideContentFingerprint, guideStepIndex, isCvImproved } = await import("./onboarding-guide.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { GUIDE_TEXTS: T } = await import("./lumeo-texts.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const after = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) + 3_600_000).toISOString();
const before = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) - 3_600_000).toISOString();

test("reprise selon l'étape : éditeur du dernier CV pendant la phase guidée, sinon /bienvenue", () => {
  assert.deepEqual(resumeTarget("guide_cv", "cv-1"), { kind: "editeur", cvId: "cv-1" });
  assert.deepEqual(resumeTarget("guide_telecharger", "cv-1"), { kind: "editeur", cvId: "cv-1" });
  // Import raté ou fenêtre de création fermée : retour au choix « importer ou créer ».
  assert.deepEqual(resumeTarget("guide_cv", null), { kind: "bienvenue", screen: "chemin_cv" });
  assert.deepEqual(resumeTarget("guide_telecharger", null), { kind: "bienvenue", screen: "chemin_cv" });
  assert.deepEqual(resumeTarget("guide_offre", "cv-1"), { kind: "bienvenue", screen: "chemin_offre" });
  assert.deepEqual(resumeTarget("temps", "cv-1"), { kind: "bienvenue", screen: "temps" });
  assert.deepEqual(resumeTarget(null, null), { kind: "bienvenue", screen: "accueil" });
});

test("mode guidé jamais actif pour un ancien compte, un parcours fini ou passé, un autre CV", () => {
  const base = {
    createdAt: after,
    metadataCompleted: false,
    doneCookie: false,
    progress: { step: "guide_cv", completed: false },
    cvId: "cv-1",
    latestCvId: "cv-1",
  };
  assert.equal(guidedEditorStep(base), "guide_cv");
  assert.equal(guidedEditorStep({ ...base, progress: { step: "guide_telecharger", completed: false } }), "guide_telecharger");
  assert.equal(guidedEditorStep({ ...base, createdAt: before }), null, "compte antérieur au parcours");
  assert.equal(guidedEditorStep({ ...base, createdAt: null }), null);
  assert.equal(guidedEditorStep({ ...base, metadataCompleted: true }), null, "parcours terminé (compte)");
  assert.equal(guidedEditorStep({ ...base, doneCookie: true }), null, "parcours terminé ou passé (navigateur)");
  assert.equal(guidedEditorStep({ ...base, progress: { step: "guide_cv", completed: true } }), null, "terminé en base");
  assert.equal(guidedEditorStep({ ...base, progress: null }), null, "aucune ligne");
  assert.equal(guidedEditorStep({ ...base, progress: { step: "cv", completed: false } }), null, "pas en phase guidée");
  assert.equal(guidedEditorStep({ ...base, progress: { step: "guide_offre", completed: false } }), null);
  assert.equal(guidedEditorStep({ ...base, latestCvId: "cv-2" }), null, "autre CV que le dernier");
  // La page lit d'abord le compte : ancien compte ou parcours terminé, aucune lecture de plus.
  const server = read("lib/onboarding-server.ts");
  assert.match(server, /if \(!isAfterLaunch\(account\.createdAt\) \|\| account\.completed\) return null;/);
});

test("« CV amélioré » : seul un changement du contenu enregistré compte", () => {
  const cv = CvDataSchema.parse({ personal: { firstName: "Inès", jobTitle: "Analyste" }, summary: "Analyste junior." });
  const baseline = guideContentFingerprint(cv);
  // Première sauvegarde sans vrai changement, style, cache de Lumeo, photo : non.
  assert.equal(isCvImproved(baseline, cv), false);
  assert.equal(isCvImproved(baseline, CvDataSchema.parse(JSON.parse(JSON.stringify(cv)))), false);
  assert.equal(isCvImproved(baseline, { ...cv, style: { ...cv.style, accent: "#123456" } }), false);
  assert.equal(isCvImproved(baseline, { ...cv, coach: { opening: "Salut", hash: "x" } }), false);
  assert.equal(isCvImproved(baseline, { ...cv, personal: { ...cv.personal, photo: "data:image/jpeg;base64,AAAA" } }), false);
  // Contenu : oui (correction à la main ou modification de Lumeo appliquée).
  assert.equal(isCvImproved(baseline, { ...cv, summary: "Analyste financière, trois ans d'audit." }), true);
  assert.equal(isCvImproved(baseline, { ...cv, personal: { ...cv.personal, jobTitle: "Analyste financière" } }), true);
  // L'éditeur ne passe à « télécharger » qu'après une sauvegarde réussie.
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /if \(result\.ok && guideStepRef\.current === "guide_cv" && isCvImproved\(guideBaseline\.current, data\)\)/);
  assert.match(editor, /const guideBaseline = useRef\(guideContentFingerprint\(cv\.data\)\);/);
});

test("étapes de l'en-tête : améliorer, télécharger, ajouter une offre", () => {
  assert.deepEqual(GUIDE_STEPS, ["guide_cv", "guide_telecharger", "guide_offre"]);
  assert.deepEqual(GUIDE_STEPS.map(guideStepIndex), [0, 1, 2]);
  assert.deepEqual(T.steps, ["Améliore ton CV", "Télécharge-le", "Ajoute une offre"]);
});

test("en-tête guidé : aria-current sur l'étape, « Passer » vrai bouton jamais désactivé", () => {
  const header = read("components/cv-builder/guided-header.tsx");
  assert.match(header, /aria-current=\{active \? "step" : undefined\}/);
  assert.match(header, /<nav aria-label=\{T\.stepsLabel\}/);
  const skip = header.slice(header.indexOf("<button"), header.indexOf("</button>"));
  assert.match(skip, /type="button"/);
  assert.match(skip, /onClick=\{onSkip\}/);
  assert.doesNotMatch(skip, /disabled/);
  assert.match(skip, /ui-focus/, "focus visible");
  // Éditeur : « Passer » ignore un second clic sans jamais se désactiver ; plus de « Retour » ni de « Menu ».
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /\{guideStep && <GuidedHeader step=\{guideStep\} onSkip=\{\(\) => void skipGuide\(\)\} \/>\}/);
  assert.match(editor, /\{!guideStep && \(\s*<>\s*<Link/);
  assert.match(editor, /if \(skipping\.current\) return;/);
  assert.match(editor, /await finishGuideAction\(guideStepRef\.current\)[\s\S]{0,80}router\.push\("\/dashboard"\);/);
});

test("étape 1 sans impasse : « Mon CV est déjà bon, continuer » passe à l'étape suivante, sans quitter", () => {
  assert.equal(T.alreadyGood, "Mon CV est déjà bon, continuer");
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /function alreadyGood\(\) \{[\s\S]{0,200}guideReadyToDownloadAction\(true\)/);
  const server = read("lib/onboarding-server.ts");
  assert.match(server, /skipped \? withSkipped\(state, "guide_cv"\) : state\), step: "guide_telecharger"/);
  assert.match(server, /row\.step !== "guide_cv"\) return;/);
});

test("téléchargement : bouton « Télécharger mon CV » à l'étape 2, félicitations de Lumeo", () => {
  assert.equal(T.download, "Télécharger mon CV");
  assert.equal(T.congrats, "Beau travail, ton CV est prêt. Télécharge-le pour l'avoir sous la main, tu pourras toujours le modifier ensuite.");
  assert.equal(T.downloadNote, "Un PDF prêt à envoyer. Ensuite, on ajoute une offre qui te plaît.");
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /guideStep === "guide_telecharger" \? GUIDE_TEXTS\.download : "Télécharger en PDF"/);
  // Lot 6a : après le téléchargement (amélioré ou non), le parcours se termine.
  assert.match(editor, /if \(guideStepRef\.current\) \{\s*guideStepRef\.current = null;\s*setGuideStep\(null\);\s*void finishGuideAction\(null\)/);
});

test("sans la migration 0047 : le chemin A garde le comportement d'avant", () => {
  const server = read("lib/onboarding-server.ts");
  const start = server.slice(server.indexOf("export async function startGuidedPhase"), server.indexOf("export async function advanceGuideToDownload"));
  assert.match(start, /if \(!error\) return true;/);
  assert.match(start, /await finishOnboarding\(state\);\s*return false;/);
  // Lecture impossible : pas de mode guidé, et pas de redirection.
  assert.match(server, /if \(row === "illisible" \|\| !row \|\| !isGuidedEditorStep\(row\.step\)\) return null;/);
});

test("migration 0047 : étapes alignées avec le code, colonnes facultatives, retour arrière", () => {
  const sql = read("../supabase/migrations/0047_onboarding_guide.sql");
  const list = ONBOARDING_STEPS.map((v) => `'${v}'`).join(", ");
  assert.ok(sql.includes(`check (step in (${list}))`), "contrôle de step");
  assert.ok(sql.includes(`check (skipped_steps <@ array[${list}]::text[])`), "contrôle de skipped_steps");
  assert.match(sql, /add column if not exists guide_application_id uuid references applications \(id\) on delete set null;/);
  assert.match(sql, /add column if not exists fiche_banner_seen_at timestamptz;/);
  assert.match(sql, /pg_get_constraintdef\(oid\) like '%accueil%'/, "anciens contrôles retirés quel que soit leur nom");
  assert.match(sql, /Retour arrière/);
  // Aucune suppression exécutée hors du commentaire de retour arrière.
  const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /drop (table|column)/i);
});

test("textes : tutoiement, sans emoji, sans chiffre en dur, ni « illimité », ni Premium", () => {
  const texts = [...Object.values(T).flat()].filter((value) => typeof value === "string").join("\n");
  assert.deepEqual(T.suggestions, ["Améliorer mon profil", "Reformuler mes expériences", "Vérifier les mots-clés"]);
  assert.equal(T.placeholder, "Pose ta question à Lumeo");
  assert.equal(T.note, "Tu restes ici le temps de finir. « Passer » te ramène au tableau de bord.");
  assert.doesNotMatch(texts, /\d/);
  assert.doesNotMatch(texts, /illimit|sans limite|premium/i);
  assert.doesNotMatch(texts, /\bvous\b|\bvotre\b|\bvos\b/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
  for (const path of ["components/cv-builder/guided-header.tsx", "lib/onboarding-guide.ts"]) {
    assert.doesNotMatch(read(path), /\/premium|Premium|illimit/i, path);
  }
});
