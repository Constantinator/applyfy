import type { AccountName } from "./person-name";
import type { ReminderSettings } from "./reminders";
import type {
  ApplicationDetail,
  ApplicationDocument,
  ApplicationEvent,
  ApplicationEventType,
} from "./types";

// Données utilisées tant que Supabase n'est pas configuré (.env.local absent).
// Stockées en mémoire côté serveur : les modifications sont perdues au redémarrage.

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function offer(company: string, position: string, missions: string[], profile: string) {
  return [
    `${company} recrute un·e ${position} en CDI.`,
    "",
    "Tes missions :",
    ...missions.map((m) => `- ${m}`),
    "",
    "Profil recherché :",
    profile,
  ].join("\n");
}

const APPLICATIONS: ApplicationDetail[] = [
  {
    id: "demo-1",
    company: "Doctolib",
    position: "Product Manager",
    location: "Paris",
    offer_url: "https://careers.doctolib.com",
    contact_name: "Julie Martin",
    contact_email: "julie.martin@example.com",
    status: "envoyee",
    applied_at: daysAgo(12),
    last_contact_at: daysAgo(12),
    created_at: daysAgo(13),
    notes: null,
    offer_description: offer(
      "Doctolib",
      "Product Manager",
      [
        "Définir la roadmap de l'agenda praticien avec les équipes tech et design",
        "Mener des interviews utilisateurs et analyser les données d'usage",
        "Rédiger les spécifications et prioriser le backlog",
      ],
      "Première expérience en produit ou en conseil, esprit analytique, goût pour la santé.",
    ),
  },
  {
    id: "demo-2",
    company: "BlaBlaCar",
    position: "Data Analyst",
    location: "Paris",
    offer_url: null,
    contact_name: null,
    contact_email: null,
    status: "entretien",
    applied_at: daysAgo(20),
    last_contact_at: daysAgo(3),
    created_at: daysAgo(21),
    notes: null,
    offer_description: offer(
      "BlaBlaCar",
      "Data Analyst",
      [
        "Construire des dashboards pour les équipes Marketing et Produit",
        "Analyser les tests A/B et formuler des recommandations",
        "Industrialiser les requêtes SQL clés",
      ],
      "Maîtrise de SQL et d'un outil de BI, bases en Python appréciées.",
    ),
  },
  {
    id: "demo-3",
    company: "Alan",
    position: "Growth Marketing",
    location: "Remote",
    offer_url: null,
    contact_name: "Thomas Leroy",
    contact_email: "thomas@example.com",
    status: "relancee",
    applied_at: daysAgo(25),
    last_contact_at: daysAgo(9),
    created_at: daysAgo(26),
    notes: null,
    offer_description: offer(
      "Alan",
      "Growth Marketer",
      [
        "Piloter les campagnes d'acquisition payantes",
        "Optimiser le funnel d'inscription",
        "Collaborer avec l'équipe contenu sur le SEO",
      ],
      "Curiosité, autonomie, à l'aise avec les chiffres.",
    ),
  },
  {
    id: "demo-4",
    company: "Qonto",
    position: "Business Developer",
    location: "Paris",
    offer_url: null,
    contact_name: null,
    contact_email: null,
    status: "envoyee",
    applied_at: daysAgo(4),
    last_contact_at: daysAgo(4),
    created_at: daysAgo(5),
    notes: null,
    offer_description: offer(
      "Qonto",
      "Business Developer",
      [
        "Prospecter des PME et indépendants",
        "Mener des démos produit",
        "Remonter les retours clients aux équipes Produit",
      ],
      "Excellent relationnel, énergie, première expérience commerciale.",
    ),
  },
  {
    id: "demo-5",
    company: "Back Market",
    position: "UX Designer",
    location: "Bordeaux",
    offer_url: null,
    contact_name: null,
    contact_email: null,
    status: "brouillon",
    applied_at: null,
    last_contact_at: null,
    created_at: daysAgo(1),
    notes: null,
    offer_description: offer(
      "Back Market",
      "UX Designer",
      [
        "Concevoir les parcours d'achat sur mobile",
        "Animer des tests utilisateurs",
        "Contribuer au design system",
      ],
      "Portfolio montrant ta démarche UX, maîtrise de Figma.",
    ),
  },
  {
    id: "demo-6",
    company: "Mirakl",
    position: "Développeur Full-Stack",
    location: "Paris",
    offer_url: null,
    contact_name: null,
    contact_email: null,
    status: "refusee",
    applied_at: daysAgo(30),
    last_contact_at: daysAgo(15),
    created_at: daysAgo(31),
    notes: null,
    offer_description: offer(
      "Mirakl",
      "Développeur·se Full-Stack",
      [
        "Développer de nouvelles fonctionnalités de la marketplace (Java / React)",
        "Participer aux revues de code",
        "Améliorer la qualité et la performance",
      ],
      "Bases solides en développement web, envie d'apprendre.",
    ),
  },
];

function atDay(days: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function event(
  application_id: string,
  type: ApplicationEventType,
  days: number,
  content: string | null = null,
): ApplicationEvent {
  return {
    id: `${application_id}-${type}-${days}`,
    application_id,
    type,
    content,
    created_at: atDay(days, type === "creation" ? 9 : 11),
  };
}

const EVENTS: ApplicationEvent[] = [
  event("demo-1", "creation", 13),
  event("demo-1", "envoi", 12, "Envoyée via le site carrières"),
  event("demo-2", "creation", 21),
  event("demo-2", "envoi", 20, "Envoyée via Welcome to the Jungle"),
  event("demo-2", "reponse", 3, "Entretien RH proposé pour la semaine prochaine"),
  event("demo-3", "creation", 26),
  event("demo-3", "envoi", 25),
  event("demo-3", "relance", 9, "Relance par email à Thomas Leroy"),
  event("demo-4", "creation", 5),
  event("demo-4", "envoi", 4),
  event("demo-5", "creation", 1),
  event("demo-6", "creation", 31),
  event("demo-6", "envoi", 30),
  event("demo-6", "reponse", 15, "Refus : profil plus senior recherché"),
];

function cv(app: ApplicationDetail) {
  return [
    "Camille Dupont",
    "camille.dupont@example.com · 06 12 34 56 78 · Paris",
    "",
    `Objectif : ${app.position} chez ${app.company}`,
    "",
    "FORMATION",
    "2021-2026 · Master Management de l'innovation — Université Paris-Dauphine",
    "",
    "EXPÉRIENCES",
    "2025 · Assistant·e chef de projet (6 mois) — Startup SaaS",
    "2024 · Job étudiant — Conseiller·ère de vente",
    "",
    "COMPÉTENCES",
    "Gestion de projet · SQL · Figma · Anglais courant",
  ].join("\n");
}

function coverLetter(app: ApplicationDetail) {
  return [
    `Objet : Candidature au poste de ${app.position}`,
    "",
    app.contact_name ? `Bonjour ${app.contact_name},` : "Madame, Monsieur,",
    "",
    `Diplômé·e en management de l'innovation, je souhaite rejoindre ${app.company} en tant que ${app.position}.`,
    "Mes expériences en gestion de projet et en analyse m'ont appris à allier rigueur et écoute des utilisateurs.",
    "",
    "Je serais ravi·e d'échanger avec vous sur la façon dont je pourrais contribuer à vos équipes.",
    "",
    "Bien cordialement,",
    "Camille Dupont",
  ].join("\n");
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
}

const DOCUMENTS: ApplicationDocument[] = APPLICATIONS.flatMap((app) => [
  {
    id: `${app.id}-cv`,
    application_id: app.id,
    kind: "cv" as const,
    file_name: `CV_${slug(app.company)}.txt`,
    storage_path: null,
    content: cv(app),
    created_at: app.created_at,
  },
  {
    id: `${app.id}-lettre`,
    application_id: app.id,
    kind: "lettre_motivation" as const,
    file_name: `Lettre_motivation_${slug(app.company)}.txt`,
    storage_path: null,
    content: coverLetter(app),
    created_at: app.created_at,
  },
]);

type DemoStore = {
  applications: ApplicationDetail[];
  events: ApplicationEvent[];
  documents: ApplicationDocument[];
  /** CV du profil (mode démo : en mémoire). */
  profileCvs: { id: string; name: string; fileName: string; data: Buffer; uploadedAt: string }[];
  /** Réglages des rappels de relance (mode démo). */
  reminderSettings?: ReminderSettings;
  /** Prénom et nom du compte (mode démo). */
  accountName?: AccountName;
};

const globalForDemo = globalThis as unknown as { applyfyDemoStore?: DemoStore };

export const demoStore: DemoStore = (globalForDemo.applyfyDemoStore ??= {
  applications: APPLICATIONS,
  events: EVENTS,
  documents: DOCUMENTS,
  profileCvs: [],
});
// Store créé par une version précédente du code (rechargement à chaud en dev).
demoStore.profileCvs ??= [];
