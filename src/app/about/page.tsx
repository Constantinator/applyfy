import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL } from "@/components/legal/legal-document";
import { SiteHeader } from "@/components/site/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Notre histoire — Applyfy",
  description:
    "Applyfy est né d'une frustration simple : gérer des dizaines de candidatures de stage entre Excel, Word et Gmail. Voici son histoire.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Notre histoire
          </h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-slate-600">
            <p>
              Applyfy est né d&apos;une frustration simple : gérer 40 candidatures de stage en
              jonglant entre Excel, Word et Gmail, c&apos;est épuisant.
            </p>
            <p>
              Je m&apos;appelle Constantin, j&apos;ai 20 ans, je suis étudiant à Berkeley et
              Audencia. En octobre 2026, j&apos;ai décidé de construire l&apos;outil que
              j&apos;aurais voulu avoir — et je l&apos;ai fait en 3 jours avec l&apos;IA, sans
              écrire une seule ligne de code moi-même.
            </p>
            <p>
              Aujourd&apos;hui Applyfy aide des étudiants et jeunes actifs à organiser leur
              recherche d&apos;emploi, adapter leurs candidatures et ne plus jamais oublier de
              relancer.
            </p>
            <p>
              Le produit est encore jeune, mais il grandit chaque jour grâce aux retours de ses
              premiers utilisateurs.
            </p>
          </div>
          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Essayer Applyfy gratuitement
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm font-semibold text-blue-600 underline-offset-4 hover:underline"
            >
              Nous contacter
            </a>
          </div>
        </article>
      </main>
    </div>
  );
}
