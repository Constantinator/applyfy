// Écran de limite du coach et refus enregistrés (migration 0046). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { CVB_COACH_DAILY_LIMIT } = await import("./ai-usage-limits.ts");
const { COACH_LIMIT_DAYS, COACH_LIMIT_SURFACES, coachLimitStats } = await import("./coach-limit-rules.ts");
const { COACH_LIMIT_TEXTS: T } = await import("./lumeo-texts.ts");
const { lumeoGate } = await import("./lumeo-panel.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("textes : nombre lu dans CVB_COACH_DAILY_LIMIT, ceux validés", () => {
  assert.equal(T.title(CVB_COACH_DAILY_LIMIT), `Tu as utilisé tes ${CVB_COACH_DAILY_LIMIT} questions du jour.`);
  assert.equal(T.title(5), "Tu as utilisé tes 5 questions du jour.");
  assert.equal(T.subtitle, "Ton quota quotidien est atteint. Il se renouvelle demain, ou tout de suite avec Premium.");
  assert.equal(T.later, "Plus tard, je continue sans");
  assert.equal(T.footer, "Pas de panique, ton CV t'attend.");
  const screen = read("components/lumeo/coach-limit-screen.tsx");
  assert.match(screen, /T\.title\(CVB_COACH_DAILY_LIMIT\)/);
});

test("textes : aucun chiffre en dur, tutoiement, sans emoji, ni « illimité » ni « sans limite »", () => {
  const texts = [T.title(CVB_COACH_DAILY_LIMIT).replace(String(CVB_COACH_DAILY_LIMIT), "N"), T.subtitle, T.later, T.footer].join("\n");
  assert.doesNotMatch(texts, /\d/);
  assert.doesNotMatch(texts, /\bvous\b|\bvotre\b|\bvos\b/i);
  assert.doesNotMatch(texts, /\p{Extended_Pictographic}/u);
  for (const path of [
    "components/lumeo/coach-limit-screen.tsx",
    "components/admin/coach-limit-section.tsx",
    "lib/coach-limit.ts",
    "lib/coach-limit-rules.ts",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /illimit|sans limite/i, path);
  }
  assert.doesNotMatch(read("components/lumeo/coach-limit-screen.tsx"), /\d+ questions|\d+\s?(€|%)/);
});

test("formules : composant commun du lot 1, prix lus dans les constantes", () => {
  const screen = read("components/lumeo/coach-limit-screen.tsx");
  assert.match(screen, /<PlanChoice paymentEnabled=\{paymentEnabled\} stacked \/>/);
  const choice = read("components/premium/plan-choice.tsx");
  for (const name of ["PREMIUM_MONTHLY_PLAN", "PREMIUM_QUARTERLY_PLAN", "QUARTERLY_SAVING_PERCENT"]) assert.match(choice, new RegExp(name));
  assert.match(choice, /Meilleure offre · −\{QUARTERLY_SAVING_PERCENT\} %/);
});

test("boîte de dialogue accessible : role, aria-modal, titre, Échap, focus", () => {
  const screen = read("components/lumeo/coach-limit-screen.tsx");
  assert.match(screen, /role="dialog"/);
  assert.match(screen, /aria-modal="true"/);
  assert.match(screen, /aria-labelledby=\{titleId\}/);
  assert.match(screen, /<h2 id=\{titleId\} tabIndex=\{-1\}/);
  assert.match(screen, /event\.key === "Escape"/);
  assert.match(screen, /event\.key !== "Tab"/);
  // Retour au chat : le focus revient dans le champ de saisie.
  const chat = read("components/application/refine-chat.tsx");
  assert.match(chat, /requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\)/);
  assert.match(chat, /\{coachLimit && \(\s*<CoachLimitScreen/);
});

test("jamais pour Premium ni bêta : la limite du jour ne vaut que pour le plan gratuit", () => {
  // usage.premium vaut true pour un abonnement Premium comme pour un beta testeur actif (isPremium).
  assert.equal(lumeoGate({ premium: true, coachToday: 999, usedToday: 0 }), "ok");
  assert.equal(lumeoGate({ premium: false, coachToday: CVB_COACH_DAILY_LIMIT, usedToday: 0 }), "quota");
  assert.equal(lumeoGate({ premium: false, coachToday: CVB_COACH_DAILY_LIMIT - 1, usedToday: 0 }), "ok");
  const editor = read("app/actions/cv-builder.ts");
  assert.match(
    editor,
    /if \(!gate\.usage\.premium && \(await countAiUsageToday\("cvb_coach"\)\) >= CVB_COACH_DAILY_LIMIT\) \{\s*\/\/[^\n]*\n\s*recordCoachLimitHit\(\(await requireUser\(\)\)\.id, "editeur"\);/,
  );
  const panel = read("app/actions/lumeo.ts");
  assert.match(panel, /if \(gate === "quota"\) \{[\s\S]{0,200}recordCoachLimitHit\(user\.id, "panneau"\);[\s\S]{0,200}coachLimit: coachLimitInfo\(\)/);
  assert.equal((panel.match(/coachLimit: coachLimitInfo\(\)/g) ?? []).length, 1);
  assert.match(read("lib/ai-usage.ts"), /isPremium\(\)/);
});

test("refus : enregistrés après la réponse, table absente tolérée", () => {
  const server = read("lib/coach-limit.ts");
  assert.match(server, /after\(\(\) => insertHit\(userId, surface\)\)/);
  assert.match(server, /isMissingTable\(error\)\) console\.error\("\[coach-limit\] table absente \(migration 0046\)/);
  assert.match(server, /if \(isMissingTable\(error\)\) return \{ status: "absente" \};/);
  // insertHit ne lève jamais : tout est dans un try / catch.
  const insert = server.slice(server.indexOf("async function insertHit"), server.indexOf("export function recordCoachLimitHit"));
  assert.match(insert, /^async function insertHit[^{]*\{\s*try \{/);
});

test("statistiques : refus par jour sur 14 jours, personnes différentes", () => {
  assert.equal(COACH_LIMIT_DAYS, 14);
  const now = new Date("2026-11-21T12:00:00Z");
  const rows = [
    { user_id: "a", occurred_at: "2026-11-21T08:00:00Z", surface: "editeur" },
    { user_id: "a", occurred_at: "2026-11-21T09:00:00Z", surface: "panneau" },
    { user_id: "b", occurred_at: "2026-11-20T22:30:00Z", surface: "editeur" }, // 23 h 30 à Paris : le 20
    { user_id: "c", occurred_at: "2026-11-01T10:00:00Z", surface: "editeur" }, // hors période
  ];
  const stats = coachLimitStats(rows, now);
  assert.equal(stats.perDay.length, 14);
  assert.equal(stats.perDay.at(-1).day, "2026-11-21");
  assert.equal(stats.perDay[0].day, "2026-11-08");
  assert.equal(stats.perDay.at(-1).value, 2);
  assert.equal(stats.perDay.at(-2).value, 1);
  assert.equal(stats.total, 3);
  assert.equal(stats.people, 2);
  assert.deepEqual(stats.bySurface, { editeur: 2, panneau: 1 });
});

test("migration 0046 : table, surfaces alignées, aucun accès des comptes, retour arrière", () => {
  const sql = read("../supabase/migrations/0046_coach_limit_hits.sql");
  assert.match(sql, /create table if not exists coach_limit_hits/);
  assert.match(sql, new RegExp(`check \\(surface in \\(${COACH_LIMIT_SURFACES.map((s) => `'${s}'`).join(", ")}\\)\\)`));
  assert.match(sql, /occurred_at timestamptz not null default now\(\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on coach_limit_hits from anon, authenticated;/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /Retour arrière : drop table if exists coach_limit_hits;/);
  assert.doesNotMatch(sql, /^\s*drop table/m);
});

test("animations : toutes dans prefers-reduced-motion: no-preference", () => {
  const css = read("app/globals.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  @keyframes cl-pop");
  assert.ok(start >= 0);
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
  assert.doesNotMatch(outside, /cl-(pop|breathe|z|rise|sleep)\b/);
  const block = css.slice(start, end);
  for (const name of ["cl-pop", "cl-breathe", "cl-z", "cl-rise"]) assert.match(block, new RegExp(`@keyframes ${name} `));
  assert.match(block, /cl-breathe 3\.6s/);
  assert.match(block, /cl-z 2\.6s/);
  assert.doesNotMatch(block, /pointer-events/);
});

test("Lumeo « endormi » : le « Z » porte son repère d'animation", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LumeoAvatar } = await import("../components/lumeo/lumeo-avatar.ts");
  assert.match(renderToStaticMarkup(createElement(LumeoAvatar, { expression: "endormi" })), /class="lumeo-z"/);
});
