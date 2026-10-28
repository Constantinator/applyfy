import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { runActivationJob } from "@/lib/activation-job";
import { cleanupCvImports } from "@/lib/cv-import-cleanup";
import { isAdminConfigured } from "@/lib/supabase/admin";

// Tâche quotidienne (Vercel Cron, cf. vercel.json) : email J+2 aux comptes sans candidature, et
// suppression des fichiers d'import du CV Builder abandonnés depuis plus de 24 h.
// Vercel appelle cette route avec « Authorization: Bearer <CRON_SECRET> ».
// ?dry=1 : liste les emails prévus sans rien modifier ni envoyer.

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
    const result = await runActivationJob({ dryRun });
    console.info("[cron/activation]", JSON.stringify(result));
    // Ménage du CV Builder : fichiers d'import abandonnés depuis plus de 24 h (sans échec : journalisé).
    const cvImports = await cleanupCvImports({ dryRun }).catch((error) => {
      console.error("[cron/activation] fichiers d'import", error);
      return null;
    });
    console.info("[cron/activation] fichiers d'import", JSON.stringify(cvImports));
    return Response.json({ ...result, cvImports });
  } catch (error) {
    console.error("[cron/activation]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 500 });
  }
}
