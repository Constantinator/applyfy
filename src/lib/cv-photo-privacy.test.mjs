// Photo du CV et vie privée (lot photo) : la photo n'est JAMAIS transmise à un modèle (coach,
// Lumeo, score, traduction, import, adaptation à une offre, résumé, lettre) ni écrite dans les
// journaux ; les copies du CV (traduction) la gardent. Chaque test met dans le CV une photo
// « sentinelle » et vérifie le contenu exact qui partirait vers le modèle (client factice : aucun
// appel réseau). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
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

delete process.env.CLAUDE_MODEL_COACH;
delete process.env.COACH_MODE_BOOLEAN;

const {
  CvDataSchema,
  adaptationExperiences,
  chatContent,
  cvDataToText,
  fitCvData,
  readCvData,
  summaryCvText,
  withoutEmptyLines,
  withoutPhoto,
} = await import("./cv-builder-types.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { buildCoachContext } = await import("./coach-context.ts");
const { coachBuilderCv, coachOpening } = await import("./coach-llm.ts");
const { runTranslation, translatableFields, translationMessage } = await import("./cv-translate.ts");
const { buildLumeoContext } = await import("./lumeo-panel.ts");
const { cvScoringSector } = await import("./cv-sector-context.ts");

/** Photo sentinelle : une vraie data URL JPEG valide, reconnaissable partout où elle passerait. */
const SENTINEL = "PHOTOSENTINELLE";
const PHOTO = `data:image/jpeg;base64,/9j/4AAQ${SENTINEL}${"Q".repeat(2000)}`;

const cv = CvDataSchema.parse({
  personal: {
    firstName: "Alex",
    lastName: "Exemple",
    jobTitle: "Commercial terrain",
    email: "alex@example.com",
    city: "Lyon",
    photo: PHOTO,
  },
  summary: "Commercial terrain, 3 ans de prospection auprès des PME.",
  experiences: [
    {
      id: "e1",
      position: "Commercial",
      company: "Société Fictive",
      startDate: "2021",
      endDate: "2024",
      bullets: ["Prospection de nouveaux clients PME", "Négocier des contrats annuels avec 30 clients"],
    },
  ],
  education: [{ id: "d1", degree: "BTS NDRC", school: "Lycée Fictif", startDate: "2019", endDate: "2021" }],
  skills: [{ id: "s1", name: "Négociation", level: "" }],
  languages: [{ id: "l1", name: "Anglais", level: "B2" }],
  interests: "Course à pied",
});

/** Rien de la photo : ni la sentinelle, ni une data URL d'image, ni un champ « photo » rempli. */
function assertNoPhoto(text, where) {
  assert.equal(typeof text, "string", where);
  assert.ok(!text.includes(SENTINEL), `${where} : la photo est présente`);
  assert.ok(!/data:image/i.test(text), `${where} : une data URL d'image est présente`);
  assert.ok(!/"photo"\s*:\s*"/.test(text), `${where} : un champ photo rempli est présent`);
  assert.ok(!text.includes("/9j/4AAQ"), `${where} : des octets JPEG sont présents`);
}

/** Client factice : enregistre les requêtes (aucun appel réseau). */
function fakeClient(output) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        parse: async (params) => {
          requests.push(params);
          return { stop_reason: "end_turn", stop_details: null, model: params.model, parsed_output: output };
        },
      },
    },
  };
}

/** Journaux capturés pendant `run` (console.log, info, warn, error, debug). */
async function captureLogs(run) {
  const lines = [];
  const saved = {};
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    saved[level] = console[level];
    console[level] = (...args) => lines.push(args.map((a) => (typeof a === "string" ? a : a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a))).join(" "));
  }
  try {
    await run();
  } finally {
    Object.assign(console, saved);
  }
  return lines.join("\n");
}

test("la sentinelle est bien dans le CV (sinon les tests suivants ne prouveraient rien)", () => {
  assert.equal(cv.personal.photo, PHOTO);
  assert.ok(JSON.stringify(cv).includes(SENTINEL));
});

test("coach : contenu du CV (chatContent) et premier message envoyés au modèle sans la photo", async () => {
  assertNoPhoto(JSON.stringify(chatContent(cv)), "chatContent");
  const context = buildCoachContext(cv, scoringContextFrom(cv, null, ["prospection"]), null);
  assertNoPhoto(context.cvJson, "contexte du coach");
  const client = fakeClient({ message: "Bonjour" });
  const logs = await captureLogs(() => coachOpening(client, context));
  assert.equal(client.requests.length, 1);
  assertNoPhoto(JSON.stringify(client.requests), "requête du premier message");
  assertNoPhoto(logs || "", "journaux du premier message");
});

test("coach : échange (CV libre et CV lié à une offre) envoyé au modèle sans la photo", async () => {
  const offer = { position: "Commercial B2B", company: "Entreprise Fictive", description: "Prospection, CRM", sector: "commercial" };
  const detail = { application: { cv_suggestions: { keywords: [{ keyword: "CRM", group: "technique", variants: [], weight: 2 }], ignored: [] } } };
  for (const [name, context] of [
    ["libre", buildCoachContext(cv, scoringContextFrom(cv, null, []), null, "Raccourcis mon accroche", [])],
    ["lié", buildCoachContext(cv, scoringContextFrom(cv, offer, []), detail, "Ajoute CRM", [])],
  ]) {
    const client = fakeClient({ mode: "demande", message: "Fait.", change_summary: "", skipped_points: [], updates: [] });
    const logs = await captureLogs(() => coachBuilderCv(client, context, [{ role: "assistant", content: "Question ?" }], "Réponse"));
    assert.equal(client.requests.length, 1, name);
    assertNoPhoto(JSON.stringify(client.requests), `requête du coach (${name})`);
    assertNoPhoto(logs || "", `journaux du coach (${name})`);
  }
});

test("coach : le CV relu par le serveur (avec la photo enregistrée) donne le même contenu au modèle qu'un CV sans photo", () => {
  const without = { ...cv, personal: { ...cv.personal, photo: null } };
  const a = buildCoachContext(withoutEmptyLines(cv), scoringContextFrom(cv, null, []), null);
  const b = buildCoachContext(withoutEmptyLines(without), scoringContextFrom(without, null, []), null);
  assert.equal(a.cvJson, b.cvJson);
  assert.equal(a.contentKey, b.contentKey, "empreinte du coach indépendante de la photo");
});

test("score et secteur : calculés sur le contenu sans la photo", () => {
  assert.equal(
    cvScoringSector(JSON.stringify(chatContent(cv)), "", null),
    cvScoringSector(JSON.stringify(chatContent({ ...cv, personal: { ...cv.personal, photo: null } })), "", null),
  );
});

test("Lumeo, lettre, Affiner et mots-clés : texte du CV (cvDataToText) sans la photo", async () => {
  assertNoPhoto(cvDataToText(cv), "cvDataToText");
  // Lumeo : seuls le score, le poste visé, les postes et les compétences sont repris (actions/lumeo.ts).
  const lumeoCv = {
    score: 60,
    weakPoints: [],
    sector: "Commercial",
    targetJob: cv.personal.jobTitle,
    experiences: cv.experiences.map(({ position, startDate, endDate, current }) => ({ position, startDate, endDate, current })),
    skills: cv.skills.map((s) => s.name),
  };
  const context = buildLumeoContext({ location: { page: "cv-builder" }, firstName: "Alex", cv: lumeoCv, applications: [], offer: null, now: new Date("2026-11-18T12:00:00Z") });
  assertNoPhoto(context, "contexte de Lumeo");
  const source = readFileSync(new URL("../app/actions/lumeo.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("async function lumeoCv("), source.indexOf("async function lumeoOffer("));
  assert.ok(body.length > 100);
  assert.ok(!/\.photo\b|\.\.\.cv\.data\b|\.\.\.cv\.data\.personal\b/.test(body), "lumeoCv ne reprend ni la photo ni le CV entier");
});

test("résumé et adaptation à une offre : texte envoyé sans la photo, photo retirée dès réception", () => {
  assertNoPhoto(summaryCvText(cv), "résumé");
  assertNoPhoto(JSON.stringify(adaptationExperiences(cv)), "adaptation");
  // Les actions retirent la photo du CV reçu avant toute validation.
  const raw = JSON.parse(JSON.stringify(cv));
  assert.equal(withoutPhoto(raw).personal.photo, null);
  assert.equal(raw.personal.photo, PHOTO, "l'objet reçu n'est pas modifié");
  for (const odd of [null, "texte", [1], { personal: "x" }, {}]) assert.deepEqual(withoutPhoto(odd), odd);
  const actions = readFileSync(new URL("../app/actions/cv-builder.ts", import.meta.url), "utf8");
  assert.match(actions, /fittedCv\(withoutPhoto\(rawData\), "résumé"\)/);
  assert.match(actions, /fittedCv\(withoutPhoto\(rawData\), "adaptation"\)/);
});

test("import d'un CV : l'analyse reçoit chatContent (sans photo), même si le CV en a déjà une", () => {
  const actions = readFileSync(new URL("../app/actions/cv-builder.ts", import.meta.url), "utf8");
  assert.match(actions, /analyseCv\(JSON\.stringify\(chatContent\(cv\.data\)\)/);
  assertNoPhoto(JSON.stringify(chatContent(cv)), "analyse de l'import");
});

test("traduction : le modèle ne reçoit que les champs texte ; la copie traduite garde la photo", async () => {
  const fields = translatableFields(cv);
  assertNoPhoto(JSON.stringify(fields), "champs à traduire");
  assertNoPhoto(translationMessage(fields), "message de traduction");
  const sent = [];
  const run = await runTranslation(cv, "fr", "en", async (f) => {
    sent.push(translationMessage(f));
    return { fields: f.map(({ path, text }) => ({ path, text: `${text} (EN)` })) };
  });
  assert.ok(sent.length >= 1);
  for (const message of sent) assertNoPhoto(message, "traduction envoyée");
  assert.equal(run.ok, true);
  assert.equal(run.data.personal.photo, PHOTO, "copie traduite : photo gardée");
});

test("journaux : une photo refusée ou trop lourde n'est jamais écrite (message et chemin seulement)", async () => {
  const huge = `data:image/jpeg;base64,/9j/${SENTINEL}${"A".repeat(500_000)}`;
  const webp = `data:image/webp;base64,UklGR${SENTINEL}`;
  let fixes = [];
  const logs = await captureLogs(() => {
    for (const photo of [huge, webp, `data:image/jpeg;base64,iVBORw0KGgo${SENTINEL}`]) {
      const fitted = fitCvData({ ...cv, personal: { ...cv.personal, photo } });
      fixes = fixes.concat(fitted.fixes);
      assert.equal(fitted.data.personal.photo, null);
      // Même journal que fittedCv (actions/cv-builder.ts) : chemin, nombre et code.
      const f = fitted.fixes[0];
      console.error(`[cv-builder] CV corrigé (enregistrement) : champ ${f.path || "racine"}, ${fitted.fixes.length} correction(s), ${f.code}`);
    }
    readCvData({ personal: { photo: huge } });
  });
  assertNoPhoto(logs, "journaux");
  assertNoPhoto(JSON.stringify(fixes), "messages de correction");
  const actions = readFileSync(new URL("../app/actions/cv-builder.ts", import.meta.url), "utf8");
  assert.match(actions, /console\.error\("\[cv-builder\] enregistrement : photo refusée"\)/);
  assert.ok(!/console\.\w+\([^)]*\bphoto\b(?!\s*refusée)/.test(actions.replace(/"[^"\n]*"/g, '""')), "aucun journal ne reçoit la variable photo");
});

test("sauvegarde : le contenu envoyé à chaque frappe ne contient pas la photo inchangée", () => {
  const editor = readFileSync(new URL("../components/cv-builder/cv-builder-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /saveBuilderCvAction\(cv\.id, \{ title, templateId, data: withoutPhoto\(data\), photo \}\)/);
  assert.match(editor, /scoringContextAction\(cv\.id, withoutPhoto\(dataRef\.current\)\)/);
});
