import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { runBetaJob } from "@/lib/beta-job";
import { isAdminConfigured } from "@/lib/supabase/admin";

// Tâche quotidienne (Vercel Cron, cf. vercel.json) du programme beta : rappels J-2 et
// suspensions. Vercel appelle cette route avec « Authorization: Bearer <CRON_SECRET> ».
// ?dry=1 : liste les actions prévues sans rien modifier ni envoyer.

export const maxDuration = 60;

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
  try {
    const result = await runBetaJob({ dryRun });
    console.info("[cron/beta]", JSON.stringify(result));
    return Response.json(result);
  } catch (error) {
    console.error("[cron/beta]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 500 });
  }
}
