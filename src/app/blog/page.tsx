import type { Metadata } from "next";
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
      <h1 className="text-center text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
        Blog <span className="text-blue-600">Applyfy</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-500">
        Conseils et astuces pour réussir ta recherche d&apos;emploi
      </p>

      <ul className="mt-14 grid gap-6 md:grid-cols-3">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug} className="flex">
            <article className="card flex w-full flex-col p-6 transition-transform duration-200 hover:-translate-y-0.5">
              <time dateTime={post.date} className="text-xs font-medium text-slate-500">
                {formatBlogDate(post.date)}
              </time>
              <h2 className="mt-2 text-lg leading-snug font-semibold text-slate-900">
                {post.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-6 text-sm font-semibold text-blue-600 underline-offset-4 hover:underline"
                aria-label={`Lire l'article : ${post.title}`}
              >
                Lire l&apos;article →
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
