import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import atsCompanies from "@/lib/ats-companies.json";
import { matchSectorKeywords, SECTORS, type Sector } from "@/lib/cv-sector-context";
import { createAtsClient, runSectorCollection, type AtsCompany } from "@/lib/job-collect";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Collecte hebdomadaire d'un secteur, sur les pages carrières uniquement (Vercel Cron, une entrée
// par secteur dans vercel.json). France Travail et Adzuna ne sont pas appelés ici.
// Vercel appelle cette route avec « Authorization: Bearer <CRON_SECRET> ».
// ?dry=1 : lit les pages carrières et renvoie le bilan, sans aucun accès à la base.

export const maxDuration = 300;

const COMPANIES = atsCompanies as unknown as Record<Sector, AtsCompany[]>;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sans secret configuré, la route reste fermée
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest, context: RouteContext<"/api/cron/collecte/[secteur]">) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { secteur } = await context.params;
  if (!SECTORS.includes(secteur as Sector)) {
    return Response.json({ error: "Secteur inconnu" }, { status: 404 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  if (!dryRun && !isAdminConfigured()) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const sector = secteur as Sector;
  const run = await runSectorCollection({
    sector,
    companies: COMPANIES[sector] ?? [],
    supabase: dryRun ? null : createAdminClient(),
    get: createAtsClient(),
    matchKeywords: matchSectorKeywords,
  });
  if (run.error) console.error("[cron/collecte]", JSON.stringify(run));
  else console.info("[cron/collecte]", JSON.stringify(run));
  return Response.json(run, { status: run.error ? 500 : 200 });
}
