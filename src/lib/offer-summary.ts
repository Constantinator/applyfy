// Mise en forme du résumé d'une offre (« Générer un résumé » et action confirmée de Lumeo).
import type { OfferSummary } from "./claude";

/** Missions, profil recherché et avantages, en sections à puces. */
export function formatOfferSummary({ missions, profil, avantages }: OfferSummary) {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((item) => `• ${item}`).join("\n")}` : "";
  return [
    section("Missions", missions),
    section("Profil recherché", profil),
    section("Avantages", avantages),
  ]
    .filter(Boolean)
    .join("\n\n");
}
