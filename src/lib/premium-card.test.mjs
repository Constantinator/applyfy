// Lot onboarding 1 : plus de candidature exemple à l'inscription, carte « Passe au Premium » en
// bas du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { isFreeAccount } = await import("./free-plan.ts");

const SRC = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), "utf8");

/** Tous les fichiers .ts et .tsx de src (hors tests). */
function sourceFiles(dir = SRC.pathname.replace(/^\/([A-Za-z]:)/, "$1")) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("inscription : plus aucune création de candidature exemple", () => {
  assert.equal(existsSync(new URL("lib/example-application.ts", SRC)), false);
  const callers = sourceFiles().filter((path) => /createExampleApplication|example-application/.test(readFileSync(path, "utf8")));
  assert.deepEqual(callers, []);
  for (const path of ["app/actions/auth.ts", "app/auth/confirm/route.ts", "app/auth/callback/route.ts"]) {
    assert.match(read(path), /queueWelcomeEmail\(supabase, data\.user\)/, `${path} : l'e-mail de bienvenue reste`);
  }
});

test("carte « Passe au Premium » : comptes gratuits seulement, jamais Premium ni bêta", () => {
  const base = { premium: false, betaActive: false, admin: false };
  assert.equal(isFreeAccount(base), true);
  assert.equal(isFreeAccount({ ...base, premium: true }), false);
  assert.equal(isFreeAccount({ ...base, betaActive: true }), false);
  const page = read("app/(app)/dashboard/page.tsx");
  assert.match(page, /\{freeAccount && source !== "demo" && \(\s*<Reveal index=\{nextReveal\(\)\}>\s*<PremiumCard /);
  assert.equal(page.match(/<PremiumCard /g)?.length, 1);
});

test("carte « Passe au Premium » : dernière carte du tableau de bord", () => {
  const page = read("app/(app)/dashboard/page.tsx");
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  const cards = ["<TodoCard", "<CvCard", "<MyWeekCard", "<OffersForYou", "<FreePlanCard", "beta-invite-title", "<PremiumCard"];
  const positions = cards.map((card) => main.lastIndexOf(card));
  assert.ok(positions.every((p) => p >= 0), "toutes les cartes sont présentes");
  assert.equal(Math.max(...positions), main.lastIndexOf("<PremiumCard"));
});

test("formules : prix lus dans les constantes, badge « Meilleure offre » sur l'offre 3 mois", () => {
  const choice = read("components/premium/plan-choice.tsx");
  for (const name of ["PREMIUM_MONTHLY_PLAN", "PREMIUM_QUARTERLY_PLAN", "QUARTERLY_SAVING_PERCENT"]) {
    assert.match(choice, new RegExp(`\\b${name}\\b`), name);
  }
  assert.match(choice, /<PlanOption plan=\{PREMIUM_QUARTERLY_PLAN\} featured /);
  assert.match(choice, /Meilleure offre · −\{QUARTERLY_SAVING_PERCENT\} %/);
  // Aucun montant ni pourcentage écrit à la main.
  for (const path of ["components/premium/plan-choice.tsx", "components/dashboard/premium-card.tsx"]) {
    assert.doesNotMatch(read(path), /\d+\s?(€|%)/, path);
  }
});

test("« Ton plan gratuit » : plus de bouton Premium (doublon avec la nouvelle carte)", () => {
  const card = read("components/dashboard/free-plan-card.tsx");
  assert.doesNotMatch(card, /\/premium|Premium/);
});

test("textes : tutoiement, sans emoji, ni « illimité » ni « sans limite »", () => {
  for (const path of ["components/premium/plan-choice.tsx", "components/dashboard/premium-card.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /illimit|sans limite/i, path);
    assert.doesNotMatch(source, /\bvous\b|\bvotre\b/i, path);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, path);
  }
});
