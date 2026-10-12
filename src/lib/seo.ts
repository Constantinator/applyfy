import type { Metadata } from "next";

/** Adresse publique du site (liens absolus : sitemap, Open Graph, URL canoniques). */
export const SITE_URL = "https://www.applyfy.fr";

/** Image de partage par défaut, générée par app/opengraph-image.tsx. */
const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Applyfy — Gère tes candidatures et décroche ton job",
};

/**
 * Métadonnées d'une page publique : titre et description, repris pour les partages
 * (LinkedIn, Facebook, X). Les champs imbriqués (openGraph, twitter) d'une page remplacent
 * ceux du layout au lieu de s'y ajouter : on les reconstruit donc entièrement ici, image de
 * partage comprise (sinon celle de app/opengraph-image.tsx n'est reprise que sur l'accueil).
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** Chemin de la page (ex. « /blog ») : URL canonique et URL de partage. */
  path?: string;
}): Metadata {
  return {
    title,
    description,
    ...(path && { alternates: { canonical: path } }),
    openGraph: {
      title,
      description,
      siteName: "Applyfy",
      locale: "fr_FR",
      type: "website",
      ...(path && { url: path }),
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}
