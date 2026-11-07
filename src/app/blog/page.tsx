import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BLOG_POSTS, formatBlogDate } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog Applyfy — Conseils pour ta recherche d'emploi",
  description:
    "Astuces, conseils et guides pour organiser ta recherche de stage ou d'emploi et décrocher le poste que tu mérites.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <div className="ui-page">
      <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink">
        Blog <span className="text-accent">Applyfy</span>
      </h1>
      <p className="mt-2.5 max-w-[640px] text-[17px] text-muted">
        Conseils et astuces pour réussir ta recherche d&apos;emploi
      </p>

      <ul className="mt-9 grid gap-5 md:grid-cols-3">
        {BLOG_POSTS.map((post, index) => {
          // Le dernier article publié (en tête du tableau) occupe toute la largeur.
          const featured = index === 0;
          return (
            <li key={post.slug} className={featured ? "flex md:col-span-3" : "flex"}>
              <article
                className={`ui-card relative flex w-full flex-col overflow-hidden ${featured ? "md:flex-row" : ""}`}
              >
                {/* Couverture : 16:9, ou 4:3 sur la moitié gauche pour l'article mis en avant
                    (fond gris clair pour un article sans image). */}
                <div
                  className={`relative bg-pill ${featured ? "aspect-[4/3] md:w-1/2 md:shrink-0" : "aspect-video"}`}
                >
                  {post.cover && (
                    <Image
                      src={post.cover.src}
                      alt={post.cover.alt}
                      fill
                      priority={featured}
                      sizes={
                        featured
                          ? "(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
                          : "(min-width: 1152px) 360px, (min-width: 768px) 33vw, 100vw"
                      }
                      className="object-cover"
                    />
                  )}
                  {featured && (
                    <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">
                      Nouvel article
                    </span>
                  )}
                </div>
                <div
                  className={`flex flex-1 flex-col p-6 ${featured ? "md:justify-center" : ""}`}
                >
                  <time dateTime={post.date} className="text-[13px] text-muted">
                    {formatBlogDate(post.date)}
                  </time>
                  <h2
                    className={`mt-2 leading-[1.25] font-bold tracking-[-0.025em] text-ink ${featured ? "text-2xl" : "text-[20px]"}`}
                  >
                    {post.title}
                  </h2>
                  <p
                    className={`mt-2 text-muted ${featured ? "text-[15px]" : "flex-1 text-[14.5px]"}`}
                  >
                    {post.description}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="ui-focus mt-5 self-start text-sm font-semibold text-accent underline-offset-4 after:absolute after:inset-0 hover:underline"
                    aria-label={`Lire l'article : ${post.title}`}
                  >
                    Lire l&apos;article
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
