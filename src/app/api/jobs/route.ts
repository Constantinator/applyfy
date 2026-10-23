import { getAllJobs } from "@/lib/job-boards";

// Offres des pages carrières (Greenhouse, Lever, Ashby) au format normalisé, régénérées au
// plus une fois par heure : les API des ATS ne sont pas sollicitées à chaque requête.
export const revalidate = 3600;

export async function GET() {
  try {
    return Response.json(await getAllJobs());
  } catch (error) {
    console.error("[api/jobs]", error);
    return Response.json({ error: "Offres momentanément indisponibles." }, { status: 503 });
  }
}
