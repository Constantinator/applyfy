import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { runDomainSweep, type SweepClient } from "@/lib/company-domain-sweep";
import { KNOWN_COMPANY_DOMAINS } from "@/lib/company-logos";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Nouveaux essais hebdomadaires des domaines d'entreprises (Vercel Cron, le dimanche à 13 h UTC,
// après la collecte) : lignes dues de company_domains, puis noms de candidatures absents de la
// table, 50 au plus. Vercel appelle cette route avec « Authorization: Bearer <CRON_SECRET> ».
// ?dry=1 : sélection seulement (nombres), aucune recherche Logo.dev ni écriture.
// Le bilan ne contient que des nombres ; la clé Logo.dev n'est jamais journalisée.

export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sans secret configuré, la route reste fermée
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const secretKey = process.env.LOGO_DEV_SECRET_KEY;
  if (!dryRun && !secretKey) {
    return Response.json({ error: "LOGO_DEV_SECRET_KEY manquante" }, { status: 500 });
  }

  const report = await runDomainSweep({
    client: createAdminClient() as unknown as SweepClient,
    secretKey,
    known: KNOWN_COMPANY_DOMAINS,
    log: (message) => console.error(message),
    dryRun,
  });
  if (report.error) console.error("[cron/domaines]", JSON.stringify(report));
  else console.info("[cron/domaines]", JSON.stringify(report));
  return Response.json(report, { status: report.error ? 500 : 200 });
}
