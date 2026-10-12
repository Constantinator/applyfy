// Articles du blog (/blog). Le contenu complet arrivera plus tard : chaque page d'article
// affiche pour l'instant « Article à venir ».
export type BlogPost = {
  slug: string;
  title: string;
  /** Date au format AAAA-MM-JJ. */
  date: string;
  description: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "organiser-candidatures-stage",
    title: "Comment organiser ses candidatures de stage efficacement",
    date: "2026-10-11",
    description:
      "Tableau de suivi, priorités, relances : une méthode simple pour ne plus perdre le fil quand les candidatures s'accumulent.",
  },
  {
    slug: "relancer-recruteur-sans-etre-intrusif",
    title: "Comment relancer un recruteur sans être intrusif",
    date: "2026-10-11",
    description:
      "Quand relancer, sur quel ton et avec quel message : les bons réflexes pour se rappeler au bon souvenir d'un recruteur.",
  },
  {
    slug: "erreurs-cv-rejet-automatique",
    title: "Les erreurs qui font rejeter un CV automatiquement",
    date: "2026-10-11",
    description:
      "Mise en page, mots-clés, format de fichier : ce qui fait écarter un CV par les logiciels de recrutement avant même d'être lu.",
  },
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** Ex. « 11 octobre 2026 ». */
export function formatBlogDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}
