import { getProfileCv, getProfileCvBytes } from "@/lib/profile";

// Téléchargement du CV du profil de l'utilisateur connecté.
export async function GET() {
  const [meta, bytes] = await Promise.all([getProfileCv(), getProfileCvBytes()]);
  if (!meta || !bytes) return new Response("Aucun CV dans ton profil", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
