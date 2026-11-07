import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CONTACT_EMAIL } from "@/components/legal/legal-document";
import { SiteHeader } from "@/components/site/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Notre histoire — Applyfy",
  description:
    "Applyfy est né d'une frustration simple : gérer des dizaines de candidatures entre Excel, Word et PDF. Voici son histoire.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <article className="ui-page-narrow">
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink">
            Notre histoire
          </h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              Applyfy est né d&apos;une frustration simple : gérer des dizaines et des dizaines de
              candidatures en jonglant entre Excel, Word et PDF, c&apos;est épuisant.
            </p>
            <p>
              Je m&apos;appelle Constantin, j&apos;ai 21 ans, je suis étudiant à Berkeley et
              Audencia. En octobre 2026, j&apos;ai décidé de construire l&apos;outil que
              j&apos;aurais voulu avoir — et je l&apos;ai fait en quelques semaines.
            </p>
            <p>
              Aujourd&apos;hui Applyfy aide les chercheurs d&apos;emploi — étudiants, jeunes
              diplômés et demandeurs d&apos;emploi — à organiser leur recherche, adapter leurs
              candidatures et ne plus jamais oublier de relancer.
            </p>
            <p>
              Le produit est encore jeune, mais il grandit chaque jour grâce aux retours de ses
              premiers utilisateurs.
            </p>
          </div>

          {/* Photo et citation côte à côte (l'une sous l'autre sur mobile, photo en premier). */}
          <div className="mt-12 flex flex-col items-start gap-8 sm:flex-row">
            <Image
              src="/images/founder.jpg"
              alt="Constantin, fondateur d'Applyfy"
              width={192}
              height={192}
              className="h-48 w-48 shrink-0 rounded-card object-cover object-top"
            />
            <figure>
              <blockquote className="text-xl leading-relaxed text-pretty text-ink italic">
                « Applyfy, c&apos;est l&apos;outil que j&apos;aurais voulu avoir quand je
                cherchais mon stage. »
              </blockquote>
              <figcaption className="mt-3 text-sm text-muted">
                — Constantin, fondateur d&apos;Applyfy
              </figcaption>
            </figure>
          </div>

          {/* Emplacement réservé à un texte à venir. */}
          <div className="min-h-16" />

          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Link href="/signup" className="ui-btn-primary text-base">
              Essayer Applyfy gratuitement
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="ui-focus ui-hit relative text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              Nous contacter
            </a>
          </div>
        </article>
      </main>
    </div>
  );
}
