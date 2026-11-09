// Petite ligne de Lumeo sur la fiche d'une candidature (fonction pure, testable) : seulement
// quand la candidature est envoyée, jamais pour la candidature exemple. Rien n'est mémorisé :
// la ligne disparaît d'elle-même dès que le statut change.
import type { Application } from "./types";

export function showLumeoSentLine(app: Pick<Application, "status" | "is_example">): boolean {
  return app.status === "envoyee" && !app.is_example;
}
