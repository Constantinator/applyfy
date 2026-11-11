// Langue du coach (lot « le coach écoute ») : messages dans la langue du candidat, contenu du CV
// dans la langue du CV, repli sur la langue du CV en cas de doute ; textes du serveur en anglais.
// Lancé par `npm test` (Node 22.18 ou plus).
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

const { candidateLanguage, cvLanguage, detectLanguage } = await import("./coach-language.ts");
const { closedOpening, closureMessage, coachReplyText, quotaBlockedText } = await import("./coach-outcome.ts");
const { coachSystem } = await import("./coach-prompt.ts");
const { buildCoachContext } = await import("./coach-context.ts");
const { PROBLEM_NO_FIGURE } = await import("./coach-proposals.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");

const frCv = CvDataSchema.parse({
  personal: { jobTitle: "Commercial terrain" },
  summary: "Commercial terrain avec 3 ans de prospection pour des PME de la région.",
  experiences: [{ id: "e1", position: "Commercial", company: "Société Fictive", bullets: ["Prospection de nouveaux clients pour la société"] }],
});
const enCv = CvDataSchema.parse({
  personal: { jobTitle: "Backend Engineer" },
  summary: "Backend engineer with 8 years of experience building APIs for the B2B market.",
  experiences: [{ id: "e1", position: "Engineer", company: "Fictional Ltd", bullets: ["Led the migration of the platform to the cloud"] }],
});

test("langue : détection par mots outils, et doute quand le message est trop court", () => {
  assert.equal(detectLanguage("Je préparais 40 dossiers de crédit par mois pour des PME."), "fr");
  assert.equal(detectLanguage("I lead a team of 4 backend engineers."), "en");
  assert.equal(detectLanguage("Is it okay if we just keep the years?"), "en");
  for (const short of ["ok", "merci", "thanks", "40", "passe"]) assert.equal(detectLanguage(short), null, short);
});

test("langue : celle du dernier message, sinon (doute) celle du CV", () => {
  assert.equal(cvLanguage(frCv), "fr");
  assert.equal(cvLanguage(enCv), "en");
  assert.equal(candidateLanguage("Can you shorten my summary please?", frCv), "en");
  assert.equal(candidateLanguage("Peux-tu raccourcir mon accroche ?", enCv), "fr");
  assert.equal(candidateLanguage("ok", enCv), "en");
  assert.equal(candidateLanguage(null, frCv), "fr");
});

test("langue : contexte du coach à partir du dernier message", () => {
  const scoring = scoringContextFrom(enCv, null, []);
  assert.deepEqual([buildCoachContext(enCv, scoring, null).language, buildCoachContext(enCv, scoring, null).cvLanguage], ["en", "en"]);
  assert.equal(buildCoachContext(enCv, scoring, null, "Je veux raccourcir mon accroche").language, "fr");
});

test("langue : bloc du prompt en phrases fixes (seule la langue varie)", () => {
  const base = { cvJson: "{}", score: { value: 60, corrections: [], banned: [] }, sector: "tech", marketKeywords: [], analysis: null };
  const block = (system) => system.slice(system.indexOf("<langue>"), system.indexOf("</langue>") + "</langue>".length);
  assert.equal(
    block(coachSystem({ ...base, language: "en", cvLanguage: "fr" }, "")),
    [
      "<langue>",
      "Langue du candidat : anglais. Écris « message » et « change_summary » en anglais.",
      "Langue du CV : français. Le contenu du CV reste en français, sauf traduction demandée explicitement par le candidat.",
      "</langue>",
    ].join("\n"),
  );
  assert.ok(!coachSystem(base, "").includes("<langue>"), "sans langue décidée : pas de bloc");
});

test("langue : textes du serveur en anglais", () => {
  const base = {
    mode: "parcours",
    section: "experience",
    applied: 0,
    stale: 0,
    invalid: false,
    firstInvalid: false,
    noChange: false,
    problems: [],
    firstProblems: [],
    message: "",
    changeSummary: "",
    scoreBefore: 60,
    scoreAfter: null,
    corrections: ["1 puce sans chiffre — A"],
    offerKeywords: [],
    lang: "en",
  };
  const problem = { changeId: "c1", text: "x", problems: [PROBLEM_NO_FIGURE] };
  assert.equal(
    coachReplyText({ ...base, problems: [problem] }),
    "I couldn't update your CV: I'm missing a number or an order of magnitude to write this bullet. Can you give me an order of magnitude (number, %, duration, budget) so I can write it?",
  );
  assert.equal(
    coachReplyText({ ...base, applied: 1, scoreAfter: 64, appliedLabels: ["Engineer chez Fictional Ltd — nouvelle puce"], message: "What's next?" }),
    "Done, I've updated: Engineer at Fictional Ltd (new bullet). What's next?",
  );
  const closure = coachReplyText({ ...base, applied: 1, scoreBefore: 78, scoreAfter: 81, changeSummary: "Done: added your result." });
  assert.ok(closure.startsWith("Done: added your result. Your CV is ready: it reaches 81/100"), closure);
  assert.ok(!closure.includes("puce"), "pas de correction en français dans un texte anglais");
  assert.ok(closedOpening(85, "en").startsWith("Your CV is ready: it reaches 85/100"));
  assert.ok(closureMessage(80, [], ["SQL"], "en").endsWith("Optional ideas, no rush: job offer keywords to consider: SQL."));
  assert.ok(quotaBlockedText({ mode: "demande", section: "summary", message: "", lang: "en" }).includes("on your summary"));
  // Français par défaut, inchangé.
  assert.ok(closedOpening(85).startsWith("Ton CV est prêt"));
});
