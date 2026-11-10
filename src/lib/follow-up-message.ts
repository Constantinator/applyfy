// Message de relance pré-écrit de la boîte « Relancer » (lot 3b) : sans IA, gratuit, modifiable.
// Variante selon le délai depuis l'envoi ou la dernière relance ; rien d'inventé (seulement poste,
// entreprise, date d'envoi, contact, signature). Fonctions pures, réexportées par lib/applications.
import { daysSince } from "./follow-up";
import { atPosition, cleanPosition } from "./position-title";
import type { Application } from "./types";

export type FollowUpApp = Pick<Application, "position" | "company" | "applied_at" | "last_contact_at" | "status" | "contact_name">;

/** courte : moins de 7 jours ou date inconnue ; interet : 7 à 10 ; echange : 11 et plus ; deuxieme : statut relancée. */
export type FollowUpVariant = "courte" | "interet" | "echange" | "deuxieme";

export const FOLLOW_UP_INTEREST_FROM = 7;
export const FOLLOW_UP_EXCHANGE_FROM = 11;

export function followUpVariant(app: FollowUpApp, now = new Date()): FollowUpVariant {
  if (app.status === "relancee") return "deuxieme";
  const days = daysSince(app.last_contact_at ?? app.applied_at, now);
  if (days === null || days < FOLLOW_UP_INTEREST_FROM) return "courte";
  return days < FOLLOW_UP_EXCHANGE_FROM ? "interet" : "echange";
}

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC", // date sans heure, cf. applications-list.tsx
});

const CIVILITY: [RegExp, string][] = [
  [/^(?:m\.|mr\.?|monsieur)$/i, "Monsieur"],
  [/^(?:mme\.?|madame|mlle\.?|mademoiselle)$/i, "Madame"],
];
/** Contact qui désigne une équipe, pas une personne : « Bonjour, ». */
const TEAM = /(?<![\p{L}])(?:service|équipe|equipe|team|rh|ressources|recrutement|talents?|direction|département|departement|cabinet|agence|contact)(?![\p{L}])/iu;

/**
 * « Bonjour Marie, » (prénom = premier mot d'un nom d'au moins deux mots), « Bonjour Madame Dupont, »
 * (civilité), sinon « Bonjour, » : pas de contact, un seul mot (prénom ou nom ?), initiale, équipe.
 */
export function followUpGreeting(contactName: string | null | undefined): string {
  const words = (contactName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || TEAM.test(words.join(" "))) return "Bonjour,";
  const civility = CIVILITY.find(([re]) => re.test(words[0]));
  if (civility) return `Bonjour ${civility[1]} ${words.slice(1).join(" ")},`;
  const first = words[0];
  if (!/^\p{L}[\p{L}'’-]*\p{L}$/u.test(first)) return "Bonjour,";
  return `Bonjour ${first},`;
}

/** « ma candidature au poste d'Analyste chez Acme » ; sans titre utilisable : « ma candidature chez Acme ». */
function candidature(app: FollowUpApp): string {
  const company = app.company.trim();
  return ["ma candidature", atPosition(app.position), company ? `chez ${company}` : ""].filter(Boolean).join(" ");
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Message de relance pré-rempli, modifiable par l'utilisateur. `signer` : prénom et nom du compte
 * (Mon profil) ; sans eux, un repère « [Prénom Nom] » est laissé à compléter.
 */
export function buildFollowUpMessage(app: FollowUpApp, signer?: string | null, now = new Date()): string {
  // « 1er novembre » (et non « 1 novembre », que donne Intl).
  const sent = app.applied_at ? `envoyée le ${longDate.format(new Date(app.applied_at)).replace(/^1 /, "1er ")}` : "";
  const cand = candidature(app);
  const body: Record<FollowUpVariant, string[]> = {
    courte: [
      `Je voulais m'assurer que ${cand}${sent ? `, ${sent},` : ""} vous est bien parvenue.`,
      "Pourriez-vous me confirmer qu'elle est bien en cours d'examen ?",
    ],
    interet: [
      `Je reviens vers vous au sujet de ${cand}${sent ? `, ${sent}` : ""}. Le poste m'intéresse toujours et j'aimerais en parler avec vous.`,
      "Où en est le processus de recrutement ?",
    ],
    echange: [
      `${capitalize(cand)}${sent ? `, ${sent},` : ""} est toujours d'actualité : ce poste m'intéresse vraiment.`,
      "Auriez-vous un moment dans les prochains jours pour un court échange, par téléphone ou en visio ?",
    ],
    deuxieme: [
      `Je reviens vers vous au sujet de ${cand}.\nSi le poste est déjà pourvu, un mot me suffira. Sinon, auriez-vous un moment pour en parler ?`,
    ],
  };
  return [
    followUpGreeting(app.contact_name),
    "",
    body[followUpVariant(app, now)].join("\n\n"),
    "",
    "Bien cordialement,",
    signer?.trim() || "[Prénom Nom]",
  ].join("\n");
}

/** Objet : « Candidature Analyste — petit suivi » (2e relance : « nouveau suivi »), sans titre : « Candidature chez Acme ». */
export function buildFollowUpSubject(app: FollowUpApp, now = new Date()): string {
  const title = cleanPosition(app.position);
  const what = title ? `Candidature ${title}` : app.company.trim() ? `Candidature chez ${app.company.trim()}` : "Candidature";
  return `${what} — ${followUpVariant(app, now) === "deuxieme" ? "nouveau suivi" : "petit suivi"}`;
}
