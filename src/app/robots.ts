import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

// /robots.txt : indique le sitemap aux moteurs de recherche ; l'espace connecté n'est pas indexé.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/candidatures",
        "/profil",
        "/offres",
        "/premium",
        "/extension",
        "/cv-builder",
        "/admin",
        "/beta",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
