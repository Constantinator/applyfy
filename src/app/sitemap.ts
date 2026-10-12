import type { MetadataRoute } from "next";

import { BLOG_POSTS } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

// /sitemap.xml : pages publiques, dont un lien par article du blog (ajouté automatiquement).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${SITE_URL}/mentions-legales`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/politique-confidentialite`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
  return pages;
}
