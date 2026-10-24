import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/blog/article-body";
import { BLOG_POSTS, formatBlogDate, getBlogPost } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

// Une page générée au build par article ; toute autre adresse renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  return post
    ? pageMetadata({
        title: `${post.title} — Blog Applyfy`,
        description: post.description,
        path: `/blog/${post.slug}`,
      })
    : {};
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-900">
        Tous les articles
      </Link>
      {post.cover && (
        <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl bg-slate-100">
          <Image
            src={post.cover.src}
            alt={post.cover.alt}
            fill
            priority
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <time dateTime={post.date} className="mt-8 block text-sm font-medium text-slate-500">
        {formatBlogDate(post.date)}
      </time>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl">
        {post.title}
      </h1>
      {post.content ? (
        <div className="mt-10">
          <ArticleBody content={post.content} />
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
          Article à venir
        </div>
      )}
    </article>
  );
}
