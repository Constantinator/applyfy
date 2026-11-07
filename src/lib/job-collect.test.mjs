// Collecte des offres (pages carrières). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/0036_job_collect.sql", import.meta.url), "utf8");

test("migration : les offres existantes reçoivent last_seen_at avant la contrainte", () => {
  const fill = migration.indexOf("update job_offers_raw set last_seen_at = scraped_at where last_seen_at is null");
  const notNull = migration.indexOf("alter column last_seen_at set not null");
  assert.ok(fill > 0, "remplissage absent");
  assert.ok(notNull > fill, "NOT NULL avant le remplissage");
});

test("migration : aucune suppression, journal fermé aux clients", () => {
  assert.doesNotMatch(migration.replace(/--.*$/gm, ""), /\b(delete|drop|truncate)\b/i);
  assert.match(migration, /alter table job_collect_runs enable row level security/);
  assert.match(migration, /revoke all on job_collect_runs from anon, authenticated/);
});
