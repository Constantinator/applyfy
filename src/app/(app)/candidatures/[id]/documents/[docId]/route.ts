import { getDocumentDownload } from "@/lib/applications";

// Téléchargement d'un document (CV, lettre) d'une candidature.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/candidatures/[id]/documents/[docId]">,
) {
  const { id, docId } = await ctx.params;
  const download = await getDocumentDownload(id, docId);

  if (!download) return new Response("Document introuvable", { status: 404 });

  // Fichier stocké dans Supabase Storage : redirection vers une URL signée courte.
  if (download.kind === "url") return Response.redirect(download.url, 302);

  return new Response(download.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
