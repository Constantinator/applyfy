import type { NextRequest } from "next/server";

import { getProfileCvFile } from "@/lib/profile";

// Consultation (inline) ou téléchargement (?telecharger=1) d'un CV du profil.
export async function GET(request: NextRequest, ctx: RouteContext<"/profil/cv/[cvId]">) {
  const { cvId } = await ctx.params;
  const file = await getProfileCvFile(cvId);
  if (!file) return new Response("CV introuvable", { status: 404 });

  const disposition = request.nextUrl.searchParams.get("telecharger") ? "attachment" : "inline";
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.cv.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
