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
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Blog <span className="text-blue-600">Applyfy</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg tracking-tight text-slate-500">
        Conseils et astuces pour réussir ta recherche d&apos;emploi
      </p>

      <ul className="mt-14 grid gap-6 md:grid-cols-3">
        {BLOG_POSTS.map((post, index) => {
          // Le dernier article publié (en tête du tableau) occupe toute la largeur.
          const featured = index === 0;
          return (
            <li key={post.slug} className={featured ? "flex md:col-span-3" : "flex"}>
              <article className="card flex w-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
                {/* Couverture 16:9 (fond gris clair pour un article sans image). */}
                <div className="relative aspect-video bg-slate-100">
                  {post.cover && (
                    <Image
                      src={post.cover.src}
                      alt={post.cover.alt}
                      fill
                      priority={featured}
                      sizes={
                        featured
                          ? "(min-width: 1152px) 1104px, 100vw"
                          : "(min-width: 1152px) 360px, (min-width: 768px) 33vw, 100vw"
                      }
                      className="object-cover"
                    />
                  )}
                </div>
                <div className={`flex flex-1 flex-col ${featured ? "p-6 sm:p-8" : "p-6"}`}>
                  <time dateTime={post.date} className="text-xs font-medium text-slate-500">
                    {formatBlogDate(post.date)}
                  </time>
                  <h2
                    className={`mt-2 leading-snug font-semibold tracking-tight text-slate-900 ${featured ? "text-2xl" : "text-lg"}`}
                  >
                    {post.title}
                  </h2>
                  <p
                    className={`mt-2 flex-1 leading-relaxed text-slate-500 ${featured ? "text-base" : "text-sm"}`}
                  >
                    {post.description}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-6 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline"
                    aria-label={`Lire l'article : ${post.title}`}
                  >
                    Lire l&apos;article →
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
