import type { Metadata } from "next";
import { connection } from "next/server";

import { CvImportFlow } from "@/components/cv-builder/cv-import-flow";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getApplicationDetail } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { getBuilderCvByApplication } from "@/lib/cv-builder";

export async function generateMetadata({ searchParams }: PageProps<"/cv-builder/importer">): Promise<Metadata> {
  const { applicationId } = await searchParams;
  return { title: `${typeof applicationId === "string" ? "Importer un CV" : "Créer un CV à partir d'un CV existant"} — Applyfy` };
}

// Lecture et analyse du CV par Claude (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;

/** « Créer un CV à partir d'un CV existant » : import, analyse, modèle, puis l'éditeur. */
export default async function CvImportPage({ searchParams }: PageProps<"/cv-builder/importer">) {
  await connection(); // compteurs IA lus à chaque visite
  const { applicationId } = await searchParams;
  // Arrivée depuis une fiche (candidature de l'utilisateur, vérifiée ici). Pas de redirection vers
  // le CV lié : il est lié dès l'extraction, avant la fin de ce parcours.
  const [usage, detail] = await Promise.all([
    readAiUsage(),
    typeof applicationId === "string" ? getApplicationDetail(applicationId) : null,
  ]);
  const linked = detail ? await getBuilderCvByApplication(detail.application.id) : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <CvImportFlow
        resetLabel={formatResetDate(usage.resetsOn)}
        aiEnabled={isClaudeConfigured()}
        application={
          detail && { id: detail.application.id, position: detail.application.position, linkedCvTitle: linked?.title ?? null }
        }
      />
    </main>
  );
}
