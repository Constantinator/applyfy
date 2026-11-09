// Ajout manuel à la beta depuis /admin/beta. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { BETA_MAX_TESTERS, betaAddMessage, betaAddOutcome, isOverCapacity } = await import("./beta-rules.ts");

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actions = source("app/actions/beta-admin.ts");
const lib = source("lib/beta-admin.ts");

test("actions admin beta : chaque action vérifie l'admin côté serveur avant tout", () => {
  const bodies = [...actions.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n([^\n]*)/g)];
  assert.ok(bodies.length >= 4, "actions trouvées");
  for (const [, name, firstLine] of bodies) {
    assert.match(firstLine, /^\s*(?:const admin = )?await requireAdmin\(\);$/, name);
  }
  assert.match(actions, /^"use server";/);
});

test("requireAdmin : un non-admin est redirigé (email exact et confirmé, revérifié côté serveur)", () => {
  const guard = /export async function requireAdmin\(\) \{([\s\S]*?)\n\}/.exec(source("lib/admin-metrics.ts"))?.[1] ?? "";
  assert.match(guard, /user\.email\?\.toLowerCase\(\) !== ADMIN_EMAIL[^\n]*redirect\("\/dashboard"\)/);
  assert.match(guard, /getUserById\(user\.id\)/);
  assert.match(guard, /!data\.user\.email_confirmed_at[\s\S]*redirect\("\/dashboard"\)/);
});

test("ajout : aucun compte créé, aucun email envoyé, pas de limite de places côté admin", () => {
  const add = /export async function addBetaTesterByEmail[\s\S]*?\n\}/.exec(lib)?.[0] ?? "";
  const restart = /async function restartBetaAccess[\s\S]*?\n\}/.exec(lib)?.[0] ?? "";
  assert.ok(add && restart);
  for (const code of [add, restart, /export async function reactivateBetaTester[\s\S]*?\n\}/.exec(lib)?.[0] ?? ""]) {
    assert.doesNotMatch(code, /createUser|inviteUserByEmail|signUp|sendEmail|BETA_MAX_TESTERS/);
  }
  // Mêmes droits qu'un testeur normal, calendrier qui repart d'aujourd'hui.
  assert.match(restart, /status: "active",\s*joined_at: new Date\(\)\.toISOString\(\),\s*premium_until: BETA_PREMIUM_UNTIL,/);
  assert.match(add, /insert\(\{ user_id: account\.id, premium_until: BETA_PREMIUM_UNTIL \}\)/);
});

test("journal : ids et date dans les logs, jamais l'email", () => {
  const log = /function logBetaAdd\(([^)]*)\) \{([\s\S]*?)\n\}/.exec(lib);
  assert.ok(log);
  assert.equal(log[1], "adminId: string, userId: string, outcome: BetaAddOutcome");
  assert.match(log[2], /admin=\$\{adminId\} compte=\$\{userId\} date=\$\{new Date\(\)\.toISOString\(\)\}/);
});

test("résultat de l'ajout selon le compte et son statut", () => {
  assert.equal(betaAddOutcome(false, null), "introuvable");
  assert.equal(betaAddOutcome(true, null), "ajoute");
  assert.equal(betaAddOutcome(true, "removed"), "reactive");
  assert.equal(betaAddOutcome(true, "suspended"), "reactive");
  assert.equal(betaAddOutcome(true, "active"), "deja_actif");
});

test("messages : ajouté ou réactivé, Premium jusqu'au 31 décembre 2026, dépassement signalé", () => {
  assert.equal(isOverCapacity(BETA_MAX_TESTERS), false);
  assert.equal(isOverCapacity(BETA_MAX_TESTERS + 1), true);
  assert.match(betaAddMessage("ajoute", "a@b.fr", 5), /^a@b\.fr ajouté à la beta : Premium jusqu'au 31 décembre 2026/);
  assert.match(betaAddMessage("reactive", "a@b.fr", 5), /réactivé dans la beta : Premium jusqu'au 31 décembre 2026/);
  assert.doesNotMatch(betaAddMessage("ajoute", "a@b.fr", 30), /dépassement/);
  assert.match(betaAddMessage("ajoute", "a@b.fr", 31), /31 testeurs actifs pour 30 places \(dépassement\)/);
  assert.match(betaAddMessage("introuvable", "x@y.fr", 5), /Aucun compte n'a été créé/);
});

test("interface : bouton pilule noire de 44 px, réactivation aussi pour les comptes retirés", () => {
  const controls = source("components/admin/beta-admin-controls.tsx");
  assert.match(controls, /className="ui-btn-primary">\s*\{pending \? "Ajout…" : "Ajouter à la beta"\}/);
  assert.match(controls, /E-mail du compte/);
  const css = /@utility ui-btn-primary \{([\s\S]*?)\}/.exec(source("app/globals.css"))?.[1] ?? "";
  assert.match(css, /min-height: 2\.75rem;/);
  assert.match(css, /border-radius: 9999px;/);
  const page = source("app/(app)/admin/beta/page.tsx");
  assert.match(page, /t\.status !== "active" && <ReactivateBetaButton/);
  assert.match(page, /<AddBetaTesterForm \/>/);
});
