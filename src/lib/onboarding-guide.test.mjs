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
const { GUIDE_STEPS, ONBOARDING_LAUNCHED_AT, ONBOARDING_STEPS, guideOfferDestination, guidedEditorStep, guidedPhaseStep, resumeTarget, entryPathAfterAuth, PATH_HEADER } =
  await import("./onboarding.ts");
const { AI_MONTHLY_LIMITS } = await import("./ai-usage-limits.ts");
const { frenchSpaces, guideActiveIndex, guideStepIndex } = await import("./onboarding-guide.ts");
const { GUIDE_BANNER_TEXTS: B, GUIDE_TEXTS: T, LUMEO_DASHBOARD_TEXTS: D, ONBOARDING_TEXTS: O } = await import("./lumeo-texts.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const after = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) + 3_600_000).toISOString();
const before = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) - 3_600_000).toISOString();

test("reprise selon l'étape : éditeur du dernier CV pendant la phase guidée, sinon /bienvenue", () => {
  assert.deepEqual(resumeTarget("guide_cv", "cv-1"), { kind: "editeur", cvId: "cv-1" });
  assert.deepEqual(resumeTarget("guide_telecharger", "cv-1"), { kind: "editeur", cvId: "cv-1" });
  // Import raté ou fenêtre de création fermée : retour au choix « importer ou créer ».
  assert.deepEqual(resumeTarget("guide_cv", null), { kind: "bienvenue", screen: "chemin_cv" });
  assert.deepEqual(resumeTarget("guide_telecharger", null), { kind: "bienvenue", screen: "chemin_cv" });
  assert.deepEqual(resumeTarget("guide_offre", "cv-1"), { kind: "offre" });
  assert.deepEqual(resumeTarget("guide_offre", null), { kind: "offre" });
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

test("en-tête guidé : 2 étapes (« Améliore ton CV », « Ajoute une offre ») ; « Bravo » : étape 1 faite, 2 pas active", () => {
  // Noms en base inchangés : guide_telecharger (ancienne étape) compte pour l'étape 1.
  assert.deepEqual(GUIDE_STEPS, ["guide_cv", "guide_telecharger", "guide_offre"]);
  assert.deepEqual(T.steps, ["Améliore ton CV", "Ajoute une offre"]);
  assert.deepEqual(GUIDE_STEPS.map(guideStepIndex), [0, 0, 1]);
  assert.deepEqual(GUIDE_STEPS.map(guideActiveIndex), [0, 0, 1]);
  assert.equal(guideStepIndex("bravo"), 1);
  assert.equal(guideActiveIndex("bravo"), null);
  assert.match(read("components/cv-builder/guided-header.tsx"), /const active = index === activeIndex;/);
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
  assert.match(editor, /await finishGuideAction\(guideStep\)[\s\S]{0,80}router\.push\("\/dashboard"\);/);
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
  // « Étape 1 · importer ton CV » : numéro d'étape demandé tel quel, pas un chiffre mesuré.
  const texts = [...Object.values(T).flat(), ...Object.values(T.bravo)]
    .filter((value) => typeof value === "string" && value !== T.importStepLabel)
    .join("\n");
  assert.equal(T.importStepLabel, "Étape 1 · importer ton CV");
  assert.deepEqual(T.bravo, {
    title: "Bravo, tu as fini ton premier CV.",
    subtitle: "Et si on cherchait ta première candidature ?",
    startTitle: "Ton premier CV est enregistré.",
    startSubtitle: "C'est un bon début, tu pourras l'améliorer quand tu veux. Et si on cherchait ta première candidature ?",
    continue: "Continuer",
    note: "Ton CV est enregistré. Tu pourras le télécharger plus tard dans le CV Builder.",
  });
  assert.deepEqual(T.suggestions, ["Améliorer mon profil", "Reformuler mes expériences", "Vérifier les mots-clés"]);
  assert.equal(T.placeholder, "Pose ta question à Lumeo");
  assert.doesNotMatch(texts, /\d/);
  assert.doesNotMatch(texts, /illimit|sans limite|premium/i);
  assert.doesNotMatch(texts, /\bvous\b|\bvotre\b|\bvos\b/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
  for (const path of ["components/cv-builder/guided-header.tsx", "lib/onboarding-guide.ts"]) {
    assert.doesNotMatch(read(path), /\/premium|Premium|illimit/i, path);
  }
});

test("écran de l'offre : en-tête guidé, formulaire et liens du chemin B, aucun lien Premium", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  const screen = flow.slice(flow.indexOf("export function GuideOfferScreen"));
  assert.match(screen, /<GuidedHeader step="guide_offre" onSkip=\{later\} \/>/);
  assert.match(screen, /<OfferLinkForm onSubmit=\{\(link\) => leave\(async \(\) => undefined, guideOfferDestination\(link\)\)\}/);
  assert.match(screen, /T\.cheminOffre\.title/);
  assert.match(screen, /T\.cheminOffre\.subtitle/);
  assert.match(screen, /GUIDE_TEXTS\.offerNote/);
  // « Trouver une offre » termine le parcours au clic ; « Plus tard » et « Passer » aussi.
  assert.match(screen, /finishGuideAction\(null, "recherche"\), choiceDestination\("recherche"\)/);
  assert.match(screen, /const later = \(\) => leave\(\(\) => finishGuideAction\("guide_offre"\), "\/dashboard"\);/);
  assert.doesNotMatch(screen, /premium|PlanChoice/i);
  assert.equal(T.offerNote, "Ensuite, on pourra adapter ton CV à cette offre.");
  assert.equal(T.offerLater, "Plus tard, aller au tableau de bord");
  assert.equal(O.cheminOffre.title, "Quelle offre t'intéresse ?");
  assert.equal(O.cheminOffre.subtitle, "Colle le lien, je remplis la fiche pour toi.");
  assert.equal(guideOfferDestination("https://a.fr/o?x=1"), "/candidatures/nouvelle?lien=https%3A%2F%2Fa.fr%2Fo%3Fx%3D1&accueil=1");
  // /bienvenue : l'écran de l'offre pour l'étape « guide_offre » (reprise depuis /dashboard).
  assert.match(read("app/(onboarding)/bienvenue/page.tsx"), /const bravo = etape === "bravo";[\s\S]*?<GuideOfferScreen\s+bravo=\{bravo\}\s+tone=/);
});

test("création de la candidature : accueil=1 termine le parcours seulement à l'étape « guide_offre »", () => {
  const action = read("app/actions/applications.ts");
  assert.match(action, /if \(formData\.get\("accueil"\) === "1"\) await completeGuideWithApplication\(id\);\s*revalidateApplicationLists\(\);\s*redirect\(`\/candidatures\/\$\{id\}\?creee=1`\);/);
  const server = read("lib/onboarding-server.ts");
  const complete = server.slice(server.indexOf("export async function completeGuideWithApplication"), server.indexOf("export async function shouldShowGuideBanner"));
  assert.match(complete, /if \(row === "illisible" \|\| !row \|\| row\.completed_at \|\| row\.step !== "guide_offre"\) return;/);
  assert.match(complete, /update\(\{ guide_application_id: applicationId \}\)/);
  assert.match(complete, /await finishOnboarding\(\{ \.\.\.stateOf\(row\), choice: "lien" \}\);/);
  assert.match(complete, /^export async function completeGuideWithApplication[^{]*\{\s*try \{/, "sans échec");
  const form = read("components/application/new-application-form.tsx");
  assert.match(form, /\{fromGuide && <input type="hidden" name="accueil" value="1" \/>\}/);
  assert.match(read("app/(app)/candidatures/nouvelle/page.tsx"), /fromGuide=\{accueil === "1"\}/);
});

test("bandeau de la fiche : seulement la candidature de la phase guidée, une seule fois, non bloquant", () => {
  const server = read("lib/onboarding-server.ts");
  const show = server.slice(server.indexOf("export async function shouldShowGuideBanner"), server.indexOf("export async function markGuideBannerSeen"));
  assert.match(show, /if \(!isAfterLaunch\(account\.createdAt\)\) return false;/);
  assert.match(show, /return data\?\.guide_application_id === applicationId && !data\.fiche_banner_seen_at;/);
  assert.match(show, /if \(error\) \{[\s\S]*?return false;/, "colonnes absentes : pas de bandeau");
  const seen = server.slice(server.indexOf("export async function markGuideBannerSeen"));
  assert.match(seen, /\.eq\("guide_application_id", applicationId\)\s*\.is\("fiche_banner_seen_at", null\)/);
  const banner = read("components/onboarding/guide-fiche-banner.tsx");
  // « Vu » dès l'affichage dans le navigateur (pas quand le serveur prépare la page).
  assert.match(banner, /useEffect\(\(\) => \{[\s\S]{0,120}guideBannerSeenAction\(applicationId\)/);
  assert.match(banner, /<aside/);
  assert.doesNotMatch(banner, /role="dialog"|aria-modal/);
  assert.match(banner, /fixed inset-x-3 bottom-3/, "mobile : carte en bas");
  assert.match(banner, /href=\{`\/cv-builder\?applicationId=\$\{applicationId\}`\} className="ui-btn-primary"/);
  assert.match(banner, /href=\{`\/candidatures\/\$\{applicationId\}\/lettre`\} className="ui-btn-secondary"/);
  assert.match(banner, /aria-label=\{T\.close\}/);
  const page = read("app/(app)/candidatures/[id]/page.tsx");
  assert.match(page, /freeNote=\{usage\.premium \? null : GUIDE_BANNER_TEXTS\.freeNote\(AI_MONTHLY_LIMITS\.cvb_chat\)\}/);
  assert.equal(B.title, "Bien joué. Je peux adapter ton CV à cette offre, ou te préparer une lettre. Tu choisis.");
  assert.deepEqual([B.adapt, B.letter, B.later], ["Adapter mon CV", "Écrire ma lettre", "Plus tard"]);
  assert.equal(B.freeNote(AI_MONTHLY_LIMITS.cvb_chat), `Gratuit : ${AI_MONTHLY_LIMITS.cvb_chat} adaptations par mois.`);
  assert.equal(B.freeNote(2), "Gratuit : 2 adaptations par mois.");
  const texts = [B.label, B.title, B.adapt, B.letter, B.later, B.close].join("\n");
  assert.doesNotMatch(texts, /\d|illimit|sans limite|premium/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
});

test("animations de la phase guidée : dans prefers-reduced-motion: no-preference", () => {
  const css = read("app/globals.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  @keyframes ob-fill");
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const block = css.slice(start, end);
  for (const name of ["@keyframes ob-slide", ".ob-hop", ".ob-slide-in"]) assert.ok(block.includes(name), name);
  const outside = css.slice(0, start) + css.slice(end + 1);
  assert.doesNotMatch(outside, /ob-(slide|halo|hop)/);
  assert.doesNotMatch(css, /ob-halo/, "halo de l'ancien bouton « Télécharger mon CV » retiré");
  assert.match(read("components/onboarding/guide-fiche-banner.tsx"), /className="ob-slide-in fixed/);
});

test("captures : champ du lien à pleine hauteur sur mobile, bandeau sans cacher l'en-tête, mode démo sans redirection", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  // En colonne (mobile), flex-1 écrasait la hauteur du champ : seulement à partir de sm.
  assert.match(flow, /className="h-14 w-full min-w-0 rounded-2xl sm:flex-1/);
  const banner = read("components/onboarding/guide-fiche-banner.tsx");
  assert.match(banner, /sm:right-6 sm:bottom-6 sm:w-\[360px\] lg:bottom-24/);
  assert.doesNotMatch(banner, /sm:top-/);
  const server = read("lib/onboarding-server.ts");
  const seen = server.slice(server.indexOf("export async function markGuideBannerSeen"));
  assert.match(seen, /if \(!isSupabaseConfigured\(\)\) return;/);
});

test("écran « Bravo » : textes, « Continuer » vers l'écran de l'offre, sorties, reprise sur l'offre", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  const screen = flow.slice(flow.indexOf("export function GuideOfferScreen"));
  const bravo = screen.slice(screen.indexOf("if (showBravo)"), screen.indexOf('<GuidedHeader step="guide_offre"'));
  assert.match(bravo, /<GuidedHeader step="bravo" onSkip=\{later\} \/>/);
  assert.match(bravo, /<LumeoAvatar size=\{120\} expression="felicite" celebrate standalone \/>/);
  assert.match(bravo, /onClick=\{\(\) => setShowBravo\(false\)\}/);
  assert.match(bravo, /GUIDE_TEXTS\.bravo\.title/);
  assert.match(bravo, /GUIDE_TEXTS\.bravo\.note/);
  assert.match(bravo, /onChoose=\{later\}/);
  assert.doesNotMatch(bravo, /premium/i);
  // ?etape=bravo retiré de l'adresse : un rechargement (reprise) mène à l'écran de l'offre.
  assert.match(screen, /if \(bravo\) window\.history\.replaceState\(window\.history\.state, "", window\.location\.pathname\);/);
  // Pas de nouvelle étape en base : « Enregistrer mon CV » passe directement à guide_offre.
  const server = read("lib/onboarding-server.ts");
  assert.match(server.slice(server.indexOf("export async function advanceGuideToOffer")), /step: "guide_offre"/);
});

test("confettis : décoratifs, une seule chute, absents si les animations sont réduites", () => {
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /<div aria-hidden="true" className="ob-confetti-layer pointer-events-none absolute inset-0 hidden/);
  const css = read("app/globals.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  @keyframes ob-fill");
  const block = css.slice(start);
  assert.ok(block.indexOf(".ob-confetti-layer { display: block; }") > 0);
  assert.match(block, /\.ob-confetti \{ animation: ob-fall 2\.6s ease-in 0\.3s 1 both; \}/);
  assert.doesNotMatch(css.slice(0, start), /ob-confetti|ob-fall/);
});

test("verrou de l'import et de la création : en-tête guidé, barre normale et bouton rond masqués", () => {
  const base = { createdAt: after, metadataCompleted: false, doneCookie: false, progress: { step: "guide_cv", completed: false } };
  assert.equal(guidedPhaseStep(base), "guide_cv");
  assert.equal(guidedPhaseStep({ ...base, progress: { step: "guide_telecharger", completed: false } }), "guide_telecharger");
  assert.equal(guidedPhaseStep({ ...base, createdAt: before }), null, "ancien compte : jamais de verrou");
  assert.equal(guidedPhaseStep({ ...base, metadataCompleted: true }), null);
  assert.equal(guidedPhaseStep({ ...base, doneCookie: true }), null, "parcours passé");
  assert.equal(guidedPhaseStep({ ...base, progress: { step: "guide_cv", completed: true } }), null);
  assert.equal(guidedPhaseStep({ ...base, progress: { step: "guide_offre", completed: false } }), null);
  assert.equal(guidedPhaseStep({ ...base, progress: null }), null);
  const header = read("components/onboarding/guided-page-header.tsx");
  assert.match(header, /<style>\{"\[data-app-chrome\]\{display:none!important\}"\}<\/style>/);
  assert.match(header, /<GuidedHeader step=\{step\} onSkip=\{skip\} \/>/);
  assert.match(header, /finishGuideAction\(step\)[\s\S]{0,80}router\.push\("\/dashboard"\)/);
  assert.match(read("components/app-topbar.tsx"), /<header data-app-chrome /);
  assert.match(read("components/lumeo/lumeo-panel.tsx"), /data-app-chrome\s*className="ui-focus fixed right-/);
  for (const page of ["app/(app)/cv-builder/importer/page.tsx", "app/(app)/cv-builder/page.tsx"]) {
    const source = read(page);
    assert.match(source, /const guided = detail \? null : await getGuidedPhaseStep\(\);/, page);
    assert.match(source, /\{guided && <GuidedPageHeader step=\{guided\} \/>\}/, page);
  }
});

test("import guidé : pas de « Mes CV », stepper en petit, « Le créer de zéro » après une erreur, jamais de Premium", () => {
  const flow = read("components/cv-builder/cv-import-flow.tsx");
  assert.match(flow, /\{!guided && \(\s*<Link/);
  assert.match(flow, /\{guided \? <GuidedStepper current=\{step\} \/> : <Stepper current=\{step\} \/>\}/);
  const stepper = flow.slice(flow.indexOf("function GuidedStepper"), flow.indexOf("function CreateFromScratchLink"));
  assert.doesNotMatch(stepper, /i \+ 1/, "pas de numéros");
  assert.match(stepper, /GUIDE_TEXTS\.importStepLabel/);
  assert.match(flow, /\{guided && error && <CreateFromScratchLink \/>\}/);
  assert.match(flow, /fallback=\{guided \? <CreateFromScratchLink \/> : undefined\}/);
  // Quota d'import atteint : message sans Premium et « Le créer de zéro » ; bandeau Premium hors phase guidée seulement.
  const limit = flow.slice(flow.indexOf("{limitReached &&"), flow.indexOf("{limitReached &&") + 700);
  assert.match(limit, /guided \? \([\s\S]*GUIDE_TEXTS\.importLimit[\s\S]*<CreateFromScratchLink \/>[\s\S]*\) : \([\s\S]*<UsageLimitBanner/);
  assert.match(flow, /href="\/cv-builder\?nouveau=1"/);
  assert.doesNotMatch(T.importLimit, /premium|\d/i);
  assert.equal(T.createFromScratch, "Le créer de zéro");
  assert.match(read("components/cv-builder/cv-import-progress.tsx"), /Réessayer\s*<\/button>\s*\{fallback\}/);
});

test("typographie : espace insécable devant « ? » et « : » sur l'écran Bravo", () => {
  assert.equal(frenchSpaces("Et si on cherchait ta première candidature ?"), "Et si on cherchait ta première candidature\u00A0?");
  assert.equal(frenchSpaces("Enregistre-le : tu pourras"), "Enregistre\u2011le\u00A0: tu pourras");
  assert.equal(frenchSpaces("« Passer » te ramène"), "«\u00A0Passer\u00A0» te ramène");
  assert.equal(frenchSpaces("Sans signe."), "Sans signe.");
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /frenchSpaces\(ready \? GUIDE_TEXTS\.bravo\.subtitle : GUIDE_TEXTS\.bravo\.startSubtitle\)/);
  assert.match(flow, /text-balance text-ink sm:text-\[42px\]">\s*\{frenchSpaces\(ready \? GUIDE_TEXTS\.bravo\.title : GUIDE_TEXTS\.bravo\.startTitle\)\}/);
});
test("typographie : trait d'union insécable avant un pronom (« Enregistre-le »)", () => {
  assert.equal(frenchSpaces("Enregistre-le : tu pourras"), "Enregistre\u2011le\u00A0: tu pourras");
  assert.equal(frenchSpaces("Télécharge-le plus tard"), "Télécharge\u2011le plus tard");
  assert.equal(frenchSpaces("mots-clés et CV"), "mots-clés et CV", "les autres mots composés ne changent pas");
});

test("pied de page pendant la phase guidée : seuls « Notre histoire » et « Blog » sont masqués", () => {
  const footer = read("components/site-footer.tsx");
  const marked = [...footer.matchAll(/<(?:Link|a)\b[^>]*data-guide-hidden[^>]*>\s*([^<]+?)\s*</g)].map((m) => m[1]);
  assert.deepEqual(marked, ["Notre histoire", "Blog"]);
  // Liens légaux, cookies et attribution jamais marqués.
  assert.match(footer, /\{LEGAL_LINKS\.map\(\(link\) => \(\s*<Link key=\{link\.href\} href=\{link\.href\} className=\{LINK\}>/);
  assert.match(footer, /<ConsentSettingsLink className=\{LINK\} \/>/);
  assert.match(footer, /<a href="https:\/\/logo\.dev" className=\{LINK\}>/);
  assert.match(read("components/onboarding/guided-footer-style.tsx"), /\[data-guide-hidden\]\{display:none!important\}/);
  // Seulement pendant la phase guidée : import et création, éditeur guidé, /bienvenue.
  assert.match(read("components/onboarding/guided-page-header.tsx"), /<GuidedFooterStyle \/>/);
  assert.match(read("components/cv-builder/cv-builder-editor.tsx"), /\{guideStep && <GuidedFooterStyle \/>\}/);
  assert.match(read("app/(onboarding)/layout.tsx"), /<GuidedFooterStyle \/>/);
  assert.doesNotMatch(read("app/layout.tsx"), /GuidedFooterStyle/, "hors phase guidée : pied de page inchangé");
});

test("éditeur guidé (8a) : un seul état, « Continuer » toujours actif, PDF en contour, chat plus grand", () => {
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /const guideStep = guided;/);
  // Plus de critère « CV amélioré », de « déjà bon » ni de carte de l'étape 2.
  assert.doesNotMatch(editor, /isCvImproved|guideBaseline|alreadyGood|guideReadyToDownloadAction|GUIDE_TEXTS\.(note|congrats|downloadNow|save)\b/);
  const actions = editor.slice(editor.indexOf("{guideStep ? ("), editor.indexOf(") : (", editor.indexOf("{guideStep ? (")));
  assert.match(actions, /onClick=\{download\}[^>]*className="ui-btn-secondary/);
  const continueButton = actions.slice(actions.indexOf("continueGuide"));
  assert.match(continueButton, /className="ui-btn-primary/);
  assert.doesNotMatch(actions.slice(actions.indexOf("<button", actions.indexOf("continueGuide") - 200)), /\bdisabled=/, "« Continuer » jamais désactivé");
  // « Continuer » : enregistrement d'abord ; échec : message, on reste ; sinon Bravo. Pas de PDF.
  const cont = editor.slice(editor.indexOf("async function continueGuide"), editor.indexOf("return (", editor.indexOf("async function continueGuide")));
  assert.match(cont, /const saved = await flushSave\(\)\.catch\(\(\) => false\);/);
  assert.match(cont, /if \(!saved\) \{\s*setSaveError\(GUIDE_TEXTS\.saveError\);\s*setGuideSaving\(false\);\s*return;/);
  assert.match(cont, /await guideSavedAction\(\)[\s\S]{0,60}router\.push\("\/bienvenue\?etape=bravo"\);/);
  assert.doesNotMatch(cont, /pdf\(|download\(/);
  const download = editor.slice(editor.indexOf("async function download"), editor.indexOf("// Phase guidée : « Passer »"));
  assert.doesNotMatch(download, /guideSavedAction|router\.push/, "le téléchargement n'avance jamais le parcours");
  assert.equal(T.continue, "Continuer");
  // Côté serveur : « Continuer » vaut depuis guide_cv comme depuis guide_telecharger (comptes de test).
  const server = read("lib/onboarding-server.ts");
  assert.doesNotMatch(server, /advanceGuideToDownload/);
  assert.match(server.slice(server.indexOf("export async function advanceGuideToOffer")), /!isGuidedEditorStep\(row\.step\)\) return;/);
  assert.match(server, /const isGuidedEditorStep = \(step: string \| undefined\) => step === "guide_cv" \|\| step === "guide_telecharger";/);
});

test("arrivée sans barre (8b) : /bienvenue directement après inscription, confirmation et Google", () => {
  const recent = { created_at: after, user_metadata: {} };
  assert.equal(entryPathAfterAuth("/dashboard", recent), "/bienvenue");
  assert.equal(entryPathAfterAuth("/dashboard", { created_at: before, user_metadata: {} }), "/dashboard", "ancien compte");
  assert.equal(entryPathAfterAuth("/dashboard", { created_at: after, user_metadata: { onboarding_completed_at: "2026-11-21" } }), "/dashboard");
  assert.equal(entryPathAfterAuth("/candidatures/x", recent), "/candidatures/x", "destination demandée gardée");
  assert.equal(entryPathAfterAuth("/dashboard", null), "/dashboard");
  assert.match(read("app/actions/auth.ts"), /redirect\(entryPathAfterAuth\("\/dashboard", data\.user\)\);/);
  assert.match(read("app/auth/confirm/route.ts"), /const destination = ok \? entryPathAfterAuth\(next, user\) : "\/login\?erreur=lien";/);
  assert.match(read("app/auth/callback/route.ts"), /ok \? entryPathAfterAuth\(next, user\) : "\/login\?error=auth"/);
});

test("arrivée sans barre (8b) : filet dans le layout, avant le rendu de la barre, seulement sur /dashboard nu", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /headers\.set\(PATH_HEADER, `\$\{request\.nextUrl\.pathname\}\$\{request\.nextUrl\.search\}`\);/);
  // Toutes les réponses de session passent par forward() (le mode démo, sans comptes, non).
  assert.equal((proxy.match(/response = forward\(\);/g) ?? []).length, 2);
  assert.equal(PATH_HEADER, "x-applyfy-path");
  const layout = read("app/(app)/layout.tsx");
  const guard = layout.indexOf('if ((await headers()).get(PATH_HEADER) === "/dashboard")');
  assert.ok(guard > 0, "filet présent");
  assert.ok(guard < layout.indexOf("<AppTopbar"), "avant le rendu de la barre");
  assert.ok(guard < layout.indexOf("Promise.all("), "avant toute autre lecture");
  assert.match(layout.slice(guard), /const onboarding = await getOnboardingEntry\(\);\s*if \(onboarding\) redirect\(/);
  // Retour de Stripe (/dashboard?premium=bienvenue&…) : la page décide, comme avant.
  assert.match(read("app/(app)/dashboard/page.tsx"), /if \(!welcomePremium\) \{/);
});

test("Lumeo dans la carte « À faire aujourd'hui » vide (8d)", () => {
  const card = read("components/dashboard/todo-card.tsx");
  assert.match(card, /<LumeoAvatar size=\{56\} expression="salue" standalone \/>/);
  assert.match(card, /\{LUMEO_DASHBOARD_TEXTS\.todoEmpty\}/);
  assert.equal(D.todoEmpty, "Ajoute l'offre qui t'intéresse. Je t'aide à adapter ton CV, écrire ta lettre et relancer au bon moment.");
  assert.doesNotMatch(D.todoEmpty, /\d|illimit|premium/i);
});
