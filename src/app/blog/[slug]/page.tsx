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
    <article className="ui-page-narrow">
      <Link href="/blog" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
        Tous les articles
      </Link>
      {post.cover && (
        <div className="relative mt-8 aspect-video overflow-hidden rounded-card bg-pill">
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
      <time dateTime={post.date} className="mt-8 block text-sm font-medium text-muted">
        {formatBlogDate(post.date)}
      </time>
      <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] mt-2 text-balance text-ink">
        {post.title}
      </h1>
      {post.content ? (
        <div className="mt-10">
          <ArticleBody content={post.content} />
        </div>
      ) : (
        <div className="mt-10 rounded-block border border-line bg-surface px-6 py-10 text-center text-muted">
          Article à venir
        </div>
      )}
    </article>
  );
}
