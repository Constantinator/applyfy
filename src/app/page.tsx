import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AccountDeletedNotice } from "@/components/account-deleted-notice";
import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import {
  IconActivity,
  IconBell,
  IconDocument,
  IconFolder,
} from "@/components/icons";
import {
  CvPreview,
  DocumentsPreview,
  FollowUpPreview,
  TrackingPreview,
} from "@/components/landing/feature-previews";
import { CountUp } from "@/components/landing/count-up";
import { DemoDashboard } from "@/components/landing/demo-dashboard";
import { HERO_EXAMPLE_SCORE, HeroVisual } from "@/components/landing/hero-visual";
import { MobileCtaBar } from "@/components/landing/mobile-cta-bar";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/site/site-header";
import { PREMIUM_PRICE_FROM_LABEL } from "@/lib/ai-usage-limits";
import { BETA_MAX_TESTERS, BETA_PREMIUM_UNTIL_LABEL, BETA_REPORTS, isBetaOfferOpen } from "@/lib/beta-rules";
import { CV_TEMPLATES } from "@/lib/cv-builder-types";
import { SCORE_CATEGORIES, SCORE_TOTAL } from "@/lib/cv-score";
import { FREE_FEATURES, LANDING_FREE_ANSWER, PLAN_LIMITS_NOTE, PREMIUM_FEATURES, QUARTERLY_FEATURES, RESET_NOTE } from "@/lib/plan-features";
import { FREE_PLAN_PRICE, PREMIUM_MONTHLY_PLAN, PREMIUM_QUARTERLY_PLAN, QUARTERLY_SAVING_PERCENT } from "@/lib/premium-plans";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Applyfy — Gère tes candidatures et décroche ton job",
  description:
    "Applyfy centralise tes candidatures, adapte ton CV et ta lettre pour chaque offre, et te rappelle quand relancer. Gratuit.",
  path: "/",
});

// Page statique, régénérée chaque jour : l'offre bêta disparaît d'elle-même après sa date de fin.
export const revalidate = 86400;

// Conteneur de la maquette : 1180 px au plus, marges de 20 px sur mobile, 32 px au-delà.
const WRAP = "mx-auto w-full max-w-[1180px] px-5 sm:px-8";
const HERO_BUTTON = "min-h-[52px]! px-[30px]! text-base! max-sm:w-full";

const SCORE_CATEGORY_NAMES = SCORE_CATEGORIES.map((category, index) =>
  index === 0 ? category.label : category.label.toLowerCase(),
).join(", ");

const FACTS = [
  { value: String(CV_TEMPLATES.length), label: "modèles de CV" },
  { value: String(SCORE_TOTAL), label: "points : un score que tu comprends" },
  { value: "ATS", label: "texte sélectionnable, lisible par les ATS" },
  { value: `${FREE_PLAN_PRICE} €`, label: "pour commencer" },
];

// Sur-titre bleu et titre de section de la maquette.
const EYEBROW = "mb-2.5 text-[13px] font-semibold tracking-[.02em] text-accent md:mb-3";
const TITLE = "text-[31px] leading-[1.1] font-bold tracking-[-0.035em] md:text-[44px] md:leading-[1.08]";
const SECTION = "py-16 md:py-24";
const SCROLL_MARGIN = "scroll-mt-[60px] lg:scroll-mt-[68px]";
// Carte douce de la maquette : 24 px sur mobile, 28 px au-delà.
const SOFT_CARD = "ui-card-soft p-[22px] md:rounded-[28px] md:p-7";
const CARD_H3 = "text-[21px] leading-tight font-semibold tracking-[-0.025em] md:text-[22px]";
const CARD_TEXT = "text-[15px] text-muted";
const PLAN_CARD = "flex flex-col p-[26px] md:p-8";
const PLAN_PRICE = "mt-1.5 mb-0.5 text-[42px] leading-tight font-extrabold tracking-[-0.04em] md:mt-2 md:mb-1 md:text-5xl";
const PLAN_NOTE = "mb-[18px] text-[13.5px] md:mb-[22px] md:text-sm";
const PLAN_BUTTON = "mt-auto w-full";
const CHECK = "flex items-start gap-2.5 text-[15px] md:text-[14.5px]";
const CHECK_ICON =
  "mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md bg-ink text-[11px] text-white md:mt-0.5";

// Sous chaque CTA d'inscription. L'inscription ne demande jamais de carte (Stripe : Premium seulement).
const FRICTION_REDUCER = "Gratuit · Sans carte bancaire · Prêt en 1 minute";

/**
 * « La réalité du marché » : uniquement des chiffres sourcés (sources sous la section). `value`
 * est animé par CountUp, `unit` reste fixe ; sans `value`, formulation qualitative (pas de
 * chiffre inventé à la place des « 40 candidatures » non sourcées).
 */
const PAIN_STATS: {
  key: string;
  value?: string;
  unit?: string;
  text?: string;
  label: string;
}[] = [
  {
    key: "tableur",
    text: "Des dizaines",
    label: "de candidatures perdues dans un tableur",
  },
  {
    key: "reponse",
    value: "8,7",
    unit: "jours",
    label: "de délai moyen avant une première réponse",
  },
  {
    key: "processus",
    value: "12",
    unit: "semaines",
    label: "de processus de recrutement complet, en moyenne",
  },
];

const PAIN_STATS_SOURCES =
  "Sources : iCIMS × HEC Junior Conseil, 2023 · APEC, 2023";

const FEATURES = [
  {
    title: "Sache où en est chaque candidature, d'un coup d'œil",
    preview: TrackingPreview,
    description:
      "Toutes tes candidatures au même endroit, avec leur statut à jour : envoyée, relancée, entretien, offre.",
    icon: IconActivity,
  },
  {
    title: "Ton CV optimisé",
    preview: CvPreview,
    description:
      "Adapte ton CV et ta lettre à chaque offre, sans perdre ce qui fait ta personnalité.",
    icon: IconDocument,
  },
  {
    title: "Ne laisse plus jamais une candidature sans réponse",
    preview: FollowUpPreview,
    description:
      "Applyfy te prévient quand une entreprise tarde à répondre et prépare ton message de relance.",
    icon: IconBell,
  },
  {
    title: "Retrouve le bon CV avant chaque entretien",
    preview: DocumentsPreview,
    description:
      "CV, lettres, offres et échanges : chaque candidature garde son historique complet.",
    icon: IconFolder,
  },
];

/** Ce que fait le coach (src/lib/claude.ts) : il applique lui-même, il ne demande pas de validation. */
const COACH_POINTS = [
  "Une seule question précise à la fois",
  "Chaque modification est annoncée et surlignée dans l'aperçu",
];

/**
 * « Pourquoi Applyfy ? » : yes = oui, no = non, partial = limité ou absent en gratuit, complet en
 * payant, unknown = non précisé, manual = possible à la main dans un tableur. Comparatif nominatif : n'afficher que ce qui est vérifiable.
 * Lu sur huntr.co/pricing le 6 novembre 2026 : les prix (mensuel 40, semestriel 26,66), le suivi,
 * le CV adapté et la lettre. Cette page ne parle ni de la langue de l'interface, ni d'une recherche
 * d'offres, ni de rappels de relance : ces cases restent « Non précisé ». Elle affiche « $ » sans
 * code de devise : on affiche « $ » sans préciser « dollars US », non confirmé.
 */
type Support = "yes" | "no" | "partial" | "unknown" | "manual";

const HUNTR_PRO_PRICE_FROM = "26,66";
const HUNTR_PRO_PRICE_MONTHLY = "40";

const COMPARISON_TOOLS = [
  { name: "Applyfy", price: `Gratuit · Premium ${PREMIUM_PRICE_FROM_LABEL}`, note: null },
  {
    name: "Huntr",
    price: `Gratuit · Pro dès ${HUNTR_PRO_PRICE_FROM} $/mois`,
    note: `${HUNTR_PRO_PRICE_MONTHLY} $/mois en mensuel`,
  },
  { name: "Excel / Word", price: null, note: null },
] as const;

const COMPARISON: { feature: string; values: [Support, Support, Support] }[] = [
  { feature: "Interface en français", values: ["yes", "unknown", "yes"] },
  { feature: "Suivi des candidatures", values: ["yes", "yes", "manual"] },
  { feature: "Recherche d'offres intégrée", values: ["yes", "unknown", "no"] },
  { feature: "CV adapté à l'offre (IA)", values: ["yes", "partial", "no"] },
  { feature: "Lettre de motivation IA", values: ["yes", "partial", "no"] },
  { feature: "Rappels de relance", values: ["yes", "unknown", "manual"] },
];

const SUPPORT_DISPLAY: Record<
  Support,
  { symbol: string; label: string; className: string; size: string }
> = {
  yes: {
    symbol: "✓",
    label: "Oui",
    className: "text-green-600",
    size: "text-lg font-bold",
  },
  no: {
    symbol: "✕",
    label: "Non",
    className: "text-muted",
    size: "text-lg font-semibold",
  },
  partial: {
    symbol: "~",
    label: "Limité ou absent en gratuit, complet en payant",
    className: "text-muted",
    size: "text-lg font-semibold",
  },
  manual: {
    symbol: "À la main",
    label: "À la main",
    className: "text-muted",
    size: "text-xs font-normal",
  },
  unknown: {
    symbol: "Non précisé",
    label: "Non précisé",
    className: "text-muted",
    size: "text-xs font-normal",
  },
};

const STEPS = [
  {
    title: "Ajoute une offre",
    description:
      "Colle le lien d'une offre ou trouve-en une directement depuis Applyfy. Ta fiche candidature est créée en quelques secondes.",
  },
  {
    title: "Prépare ta candidature",
    description:
      "Adapte ton CV et génère une lettre de motivation personnalisée pour chaque offre.",
  },
  {
    title: "Suis l'évolution",
    description:
      "Suis le statut de chaque candidature depuis ton dashboard et relance au bon moment.",
  },
  {
    title: "Retrouve tes documents",
    description:
      "Tous tes CV et lettres de motivation sont sauvegardés par candidature, prêts pour tes entretiens.",
  },
];

/**
 * FAQ : chaque réponse doit rester exacte (CGU, politique de confidentialité, prompts de
 * src/lib/claude.ts, import d'offres de src/lib/offer-import.ts).
 */
const FAQ: { question: string; answer: React.ReactNode }[] = [
  {
    question: "Qu'est-ce qui est gratuit ?",
    answer: LANDING_FREE_ANSWER,
  },
  {
    question: "L'IA invente-t-elle des choses dans mon CV ?",
    answer:
      "Non. Applyfy adapte ton CV existant à l'offre ciblée : il reformule et met en avant, sans ajouter d'expériences, de diplômes ou de compétences que tu n'as pas.",
  },
  {
    question: "Mes données sont-elles revendues ?",
    answer: (
      <>
        Non. Tes données ne sont jamais vendues ni utilisées à des fins
        publicitaires. Elles sont uniquement transmises aux prestataires
        nécessaires au service (hébergement, IA, paiement), listés dans notre{" "}
        <Link
          href="/politique-confidentialite"
          className="ui-link py-3 underline"
        >
          politique de confidentialité
        </Link>
        .
      </>
    ),
  },
  {
    question: "Puis-je résilier à tout moment ?",
    answer:
      "Oui. Tu peux annuler ton abonnement à tout moment depuis ton espace personnel, sans engagement.",
  },
  {
    question: "Est-ce que ça marche avec Indeed ou Welcome to the Jungle ?",
    answer:
      "Oui. Colle le lien d'une offre et Applyfy tente de récupérer les informations automatiquement. Si ça ne marche pas, copie-colle le titre, l'entreprise et la description en quelques secondes — Applyfy s'occupe du reste : adaptation du CV, de la lettre et suivi de la candidature. Tu peux aussi chercher des offres directement depuis Applyfy.",
  },
];

function PlanFeatures({ items, inverse = false }: { items: string[]; inverse?: boolean }) {
  return (
    <ul className="mb-[22px] space-y-2.5">
      {items.map((item) => (
        <li key={item} className={CHECK}>
          <span aria-hidden="true" className={`${CHECK_ICON} ${inverse ? "bg-accent!" : ""}`}>
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function LandingPage() {
  const betaOpen = isBetaOfferOpen(new Date());

  return (
    // overflow-x-clip : pas de défilement horizontal sur mobile (clip, pas hidden : l'en-tête reste collant).
    <div className="flex flex-1 flex-col overflow-x-clip bg-white leading-normal tracking-[-0.011em] text-ink">
      <SiteHeader />

      <main className="flex-1">
        {/* Suspense : la page d'accueil reste statique, le message est lu côté navigateur. */}
        <Suspense fallback={null}>
          <AccountDeletedNotice />
        </Suspense>

        {/* Hero : halo bleu très léger (seul dégradé de la page avec la carte bêta). */}
        <section className="bg-[radial-gradient(420px_260px_at_50%_0%,#F3F6FF_0%,#fff_75%)] pt-10 pb-8 text-center md:bg-[radial-gradient(900px_380px_at_50%_0%,#F3F6FF_0%,#fff_70%)] md:pt-[84px] md:pb-10">
          <div className={WRAP}>
            {betaOpen && (
              <a
                href="#beta"
                className="ui-focus inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pr-3.5 pl-2 text-xs font-medium md:text-[13px]"
              >
                <span className="rounded-full bg-accent px-2 py-[3px] text-[10px] font-bold text-white md:text-[11px]">
                  BÊTA
                </span>
                <span>
                  <span className="hidden md:inline">{BETA_MAX_TESTERS} places au maximum · </span>
                  Premium offert jusqu&apos;au {BETA_PREMIUM_UNTIL_LABEL}
                </span>
              </a>
            )}
            <h1 className="mx-auto mt-[22px] max-w-[1080px] text-[38px] leading-[1.05] font-extrabold tracking-[-0.045em] text-balance md:mt-[26px] md:text-[66px] md:leading-[1.02]">
              Toutes tes candidatures au même endroit.{" "}
              <span className="block text-accent">Un CV adapté à chaque offre.</span>
            </h1>
            <p className="mx-auto mt-[18px] max-w-[640px] text-[17px] leading-normal text-nav md:mt-[26px] md:text-xl">
              Applyfy suit tes candidatures, adapte ton CV et ta lettre à
              chacune d&apos;entre elles, et te dit quand relancer. Pour
              trouver ton job sans t&apos;y noyer.
            </p>
            <div className="mt-[26px] flex flex-col justify-center gap-3.5 sm:flex-row sm:gap-3 md:mt-[34px]">
              <Link href="/signup" className={`ui-btn-primary ${HERO_BUTTON}`}>
                Commencer gratuitement
              </Link>
              <a href="#comment-ca-marche" className={`ui-btn-secondary ${HERO_BUTTON}`}>
                Voir comment ça marche
              </a>
            </div>
            {/* Réducteur de friction sous le CTA (« Se connecter » reste dans l'en-tête). */}
            <p className="mt-3.5 text-[12.5px] text-muted md:mt-4 md:text-[13px]">{FRICTION_REDUCER}</p>
            <HeroVisual />
          </div>
        </section>

        {/* Bande de chiffres : tous lus dans le code. */}
        <section aria-label="Applyfy en bref" className="pt-5 pb-2 md:pt-9">
          <ul className={`${WRAP} grid grid-cols-2 gap-x-3 gap-y-5 text-center md:grid-cols-4 md:gap-4`}>
            {FACTS.map((fact) => (
              <li key={fact.value}>
                <p className="text-[26px] font-bold tracking-[-0.03em] md:text-[28px]">{fact.value}</p>
                <p className="text-[13px] text-muted md:text-sm">{fact.label}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Preuve sociale fondateur : en attendant de vrais témoignages, un visage et une histoire réels. */}
        <section aria-label="Le mot du fondateur" className="pt-12 md:pt-20">
          <figure className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-5 text-center sm:flex-row sm:px-8 sm:text-left">
            <Image
              src="/images/founder.jpg"
              alt="Constantin, fondateur d'Applyfy"
              width={200}
              height={200}
              className="h-[200px] w-[200px] shrink-0 rounded-card object-cover grayscale"
            />
            <div>
              <blockquote className="text-lg leading-relaxed text-pretty text-prose italic">
                « J&apos;ai créé Applyfy après avoir postulé à de nombreuses
                offres. Je me perdais vite et cela me frustrait. Je voulais un
                outil simple qui m&apos;aide à candidater, je l&apos;ai donc
                créé. »
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted">
                — Constantin, fondateur d&apos;Applyfy
              </figcaption>
              <Link href="/about" className="ui-link mt-1 inline-flex min-h-11 items-center text-sm">
                Notre histoire
              </Link>
            </div>
          </figure>
        </section>

        {/* Problème : uniquement les chiffres sourcés, dans la mise en page de la maquette. */}
        <section aria-labelledby="stats-title" className={SECTION}>
          <div className={WRAP}>
            <Reveal className="max-w-[720px]">
              <p className={EYEBROW}>La réalité du marché</p>
              <h2 id="stats-title" className={TITLE}>
                Les chiffres qui font mal
              </h2>
            </Reveal>
            <ul className="mt-7 grid gap-3.5 md:mt-11 md:grid-cols-3 md:gap-5">
              {PAIN_STATS.map((stat, index) => (
                <li key={stat.key}>
                  <Reveal delay={index * 80} className={`h-full ${SOFT_CARD}`}>
                    {/* Hauteur commune : chiffres et formulation qualitative alignés. */}
                    <div className="flex min-h-14 items-end md:min-h-16">
                      {stat.value ? (
                        <div className="flex items-baseline gap-2">
                          <CountUp
                            value={stat.value}
                            className="text-[44px] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap md:text-[52px]"
                          />
                          <span className="text-xl font-semibold tracking-[-0.025em]">{stat.unit}</span>
                        </div>
                      ) : (
                        <p className="text-[32px] leading-tight font-extrabold tracking-[-0.035em] md:text-[36px]">{stat.text}</p>
                      )}
                    </div>
                    <p className={`mt-3 ${CARD_TEXT}`}>{stat.label}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted">{PAIN_STATS_SOURCES}</p>
          </div>
        </section>

        {/* Comment ça marche */}
        <section
          id="comment-ca-marche"
          aria-labelledby="steps-title"
          className={`border-y border-line bg-surface ${SECTION} ${SCROLL_MARGIN}`}
        >
          <div className={WRAP}>
            <Reveal className="mx-auto max-w-[680px] md:text-center">
              <p className={EYEBROW}>Comment ça marche</p>
              <h2 id="steps-title" className={TITLE}>
                {STEPS.length} étapes, et ta recherche devient organisée
              </h2>
            </Reveal>
            <ol className="mt-7 grid gap-3.5 sm:grid-cols-2 md:mt-[52px] md:gap-5 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Reveal delay={index * 80} className="ui-card h-full p-[22px] md:p-7">
                    <span
                      aria-hidden="true"
                      className={`flex h-9 w-9 items-center justify-center rounded-[11px] font-bold text-white md:h-10 md:w-10 md:rounded-xl ${
                        index === STEPS.length - 1 ? "bg-accent" : "bg-ink"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <h3 className={`mt-4 mb-1.5 md:mt-5 md:mb-2 ${CARD_H3}`}>{step.title}</h3>
                    <p className={CARD_TEXT}>{step.description}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Fonctionnalités : les 4 vrais blocs et leurs aperçus, puis 4 cartes vérifiées dans le code. */}
        <section id="fonctionnalites" aria-labelledby="features-title" className={`${SECTION} ${SCROLL_MARGIN}`}>
          <div className={WRAP}>
            <Reveal className="max-w-[720px]">
              <p className={EYEBROW}>Fonctionnalités</p>
              <h2 id="features-title" className={TITLE}>
                Tout ce qu&apos;il te faut pour décrocher ton job
              </h2>
            </Reveal>
            <div className="mt-7 grid grid-cols-6 gap-3.5 md:mt-12 md:gap-5">
              {FEATURES.map((feature) => (
                <Reveal key={feature.title} className={`col-span-6 flex flex-col gap-5 md:col-span-3 ${SOFT_CARD}`}>
                  <div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-box text-ink">
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <h3 className={`mt-4 mb-2 ${CARD_H3}`}>{feature.title}</h3>
                    <p className={CARD_TEXT}>{feature.description}</p>
                  </div>
                  <div className="mt-auto">
                    <feature.preview />
                  </div>
                </Reveal>
              ))}

              <Reveal className={`col-span-6 flex flex-col gap-5 md:flex-row md:items-center md:gap-7 lg:col-span-4 ${SOFT_CARD}`}>
                <div className="flex-1">
                  <h3 className="mb-2 text-[23px] leading-tight font-semibold tracking-[-0.03em] md:mb-2.5 md:text-[26px]">
                    Un coach qui n&apos;invente rien
                  </h3>
                  <p className="mb-3.5 text-[15.5px] text-muted md:mb-4 md:text-base">
                    Il te demande combien, de combien, en combien de temps. Tes réalisations sont écrites avec tes vrais chiffres.
                  </p>
                  <ul className="space-y-2.5">
                    {COACH_POINTS.map((point) => (
                      <li key={point} className={CHECK}>
                        <span aria-hidden="true" className={CHECK_ICON}>
                          ✓
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div aria-hidden="true" className="ui-card flex flex-col gap-2 p-3 text-[13px] md:flex-[.9] md:p-4">
                  <p className="rounded-[14px] bg-box px-3 py-2.5">En combien de temps as-tu livré ce projet ?</p>
                  <p className="self-end rounded-[14px] bg-ink px-3 py-2.5 text-white">En 4 mois, pour 3 clients.</p>
                </div>
              </Reveal>

              <Reveal className={`col-span-6 lg:col-span-2 ${SOFT_CARD}`}>
                <p className="text-[40px] font-extrabold tracking-[-0.04em] text-green-600 md:text-[44px]">
                  {HERO_EXAMPLE_SCORE}
                  <span className="text-[17px] font-medium tracking-normal text-muted md:text-lg"> / {SCORE_TOTAL}</span>
                </p>
                <h3 className={`mt-1.5 mb-1.5 md:mt-2 md:mb-2 ${CARD_H3}`}>Un score clair</h3>
                <p className={CARD_TEXT}>{SCORE_CATEGORY_NAMES}. Chaque point perdu a une raison.</p>
              </Reveal>

              <Reveal className={`col-span-6 lg:col-span-2 ${SOFT_CARD}`}>
                <div aria-hidden="true" className="mb-4 flex gap-2">
                  <span className="h-[46px] w-[34px] rounded-md border border-line-strong bg-white" />
                  <span className="h-[46px] w-[34px] rounded-md border border-l-[12px] border-line-strong border-l-ink bg-white" />
                  <span className="h-[46px] w-[34px] rounded-md border border-t-[8px] border-line-strong border-t-accent bg-white" />
                </div>
                <h3 className={`mb-1.5 md:mb-2 ${CARD_H3}`}>{CV_TEMPLATES.length} modèles de CV</h3>
                <p className={CARD_TEXT}>Export PDF au texte sélectionnable, lisible par les ATS, avec ses polices intégrées.</p>
              </Reveal>

              <Reveal className={`col-span-6 lg:col-span-4 ${SOFT_CARD}`}>
                <h3 className={`mb-1.5 md:mb-2 ${CARD_H3}`}>Import d&apos;offres et lettres de motivation</h3>
                <p className={CARD_TEXT}>
                  Colle le lien d&apos;une offre : Applyfy tente de récupérer l&apos;entreprise, le poste et la description.
                  L&apos;extension Chrome le fait depuis la page de l&apos;offre. Génère ensuite une première version de ta lettre
                  à partir de ton CV et de l&apos;offre, puis affine-la avec le chat.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Démonstration du tableau de bord, hors de Reveal : son message est en position fixe. */}
        <section aria-label="Démonstration du tableau de bord" className="pb-16 md:pb-24">
          <figure className={WRAP}>
            <div className="overflow-hidden rounded-card border border-line">
              <DemoDashboard />
            </div>
            <figcaption className="mt-4 text-center text-sm text-muted">
              <strong className="font-semibold text-ink">Exemple fictif.</strong> Le dashboard Applyfy — toutes tes candidatures au même endroit
            </figcaption>
          </figure>
        </section>

        {/* Le coach, sur fond noir. Dialogue fictif, conforme au vrai coach : il applique et annonce. */}
        <section aria-labelledby="coach-title" className="bg-ink py-16 text-white md:py-24">
          <div className={`${WRAP} grid gap-x-16 gap-y-6 md:grid-cols-2 md:grid-rows-[auto_auto] md:items-center`}>
            <div className="md:self-end">
              <p className={`${EYEBROW} text-blue-400!`}>Le coach</p>
              <h2 id="coach-title" className={TITLE}>
                Ton CV s&apos;améliore à chaque réponse.
              </h2>
              <p className="mt-4 text-base text-[#A1A1AA] md:mt-5 md:text-lg">
                Le coach part de ton CV et de son score, repère ce qui manque (et les mots-clés de l&apos;offre si ton CV y est lié), puis te pose une question précise.
              </p>
            </div>
            <figure className="md:col-start-2 md:row-span-2 md:row-start-1">
              <div className="flex flex-col gap-2.5 rounded-card border border-[#262626] bg-[#171717] p-4 text-sm md:gap-3 md:rounded-[28px] md:p-6 md:text-[14.5px]">
                <p className="max-w-[92%] rounded-2xl bg-[#262626] px-3.5 py-3 md:max-w-[88%] md:rounded-[18px] md:px-4 md:py-[13px]">
                  Chez Atelier Lumen, tu as « géré des projets ». Combien en parallèle, et pour quel type de clients ?
                </p>
                <p className="max-w-[84%] self-end rounded-2xl bg-white px-3.5 py-3 text-ink md:max-w-[80%] md:rounded-[18px] md:px-4 md:py-[13px]">
                  Environ 5 à la fois, surtout des grands comptes.
                </p>
                <p className="max-w-[92%] rounded-2xl bg-[#262626] px-3.5 py-3 md:max-w-[88%] md:rounded-[18px] md:px-4 md:py-[13px]">
                  C&apos;est fait : j&apos;ai ajouté « Piloté jusqu&apos;à 5 projets simultanés pour des clients grands comptes » à ton CV.
                </p>
              </div>
              <figcaption className="mt-3 text-center text-[13px] text-[#A1A1AA]">Exemple fictif</figcaption>
            </figure>
            <div className="md:self-start">
              <Link href="/signup" className="ui-btn-inverse text-base! max-md:w-full md:px-[26px]!">
                Essayer gratuitement
              </Link>
            </div>
          </div>
        </section>

        {/* Pourquoi Applyfy ? */}
        <section aria-labelledby="why-title" className={SECTION}>
          <Reveal className={`${WRAP} max-w-4xl!`}>
            <h2 id="why-title" className={`md:text-center ${TITLE}`}>
              Pourquoi Applyfy ?
            </h2>
            <p className="mt-3.5 text-base text-muted md:mt-4 md:text-center md:text-lg">
              Ce que les autres outils ne font pas, ou font payer plus cher.
            </p>
            {/* Zone qui défile : atteignable au clavier. */}
            <div
              role="region"
              aria-label="Comparatif, à faire défiler"
              tabIndex={0}
              className="ui-focus relative mt-7 overflow-x-auto rounded-card border border-line md:mt-12"
            >
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="sr-only">
                  Comparatif d&apos;Applyfy avec Huntr et Excel / Word
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-4 text-left font-medium text-muted sm:static">
                      <span className="sr-only">Fonctionnalité</span>
                    </th>
                    {COMPARISON_TOOLS.map((tool, index) => (
                      <th
                        key={tool.name}
                        scope="col"
                        className={`px-4 py-4 text-center font-semibold ${index === 0 ? "bg-ink text-white" : "text-ink"}`}
                      >
                        {tool.name}
                        {tool.price && (
                          <span className={`mt-0.5 block text-xs font-normal ${index === 0 ? "text-white/75" : "text-muted"}`}>
                            {tool.price}
                          </span>
                        )}
                        {tool.note && <span className="mt-0.5 block text-[11px] font-normal text-muted">{tool.note}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-t border-line">
                      <th scope="row" className="sticky left-0 z-10 max-w-36 bg-white px-4 py-3.5 text-left font-medium text-ink sm:static sm:max-w-none">
                        {row.feature}
                      </th>
                      {row.values.map((value, index) => {
                        const display = SUPPORT_DISPLAY[value];
                        return (
                          <td
                            key={COMPARISON_TOOLS[index].name}
                            className={`px-4 py-3.5 text-center ${display.className} ${display.size} ${index === 0 ? "bg-surface" : ""}`}
                          >
                            <span aria-hidden="true">{display.symbol}</span>
                            <span className="sr-only">{display.label}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-muted sm:hidden">Fais glisser le tableau pour voir les autres outils.</p>
            <p className="mt-4 text-center text-xs text-muted max-sm:mt-1">
              ~ = limité ou absent sur le plan gratuit, complet sur le plan payant. Non précisé = pas indiqué sur la page de tarifs de Huntr. À la main = possible dans un tableur, sans automatisation.
            </p>
          </Reveal>
        </section>

        {/* Tarifs : ordre de la maquette sur mobile (3 mois, mensuel, gratuit), via order. */}
        <section
          id="tarifs"
          aria-labelledby="pricing-title"
          className={`pb-16 md:pb-24 ${SCROLL_MARGIN}`}
        >
          <div className={WRAP}>
            <div className="mx-auto max-w-[900px] md:text-center">
              <p className={EYEBROW}>Tarifs</p>
              <h2 id="pricing-title" className={TITLE}>
                Nos tarifs
              </h2>
            </div>

            <div className="mt-7 grid gap-4 md:mt-[52px] md:grid-cols-3 md:gap-5">
              <article className={`order-3 md:order-1 ${PLAN_CARD} ui-card`}>
                <h3 className="font-semibold">Gratuit</h3>
                <p className={PLAN_PRICE}>{FREE_PLAN_PRICE} €</p>
                <p className={`text-muted ${PLAN_NOTE}`}>Sans carte bancaire</p>
                <PlanFeatures items={FREE_FEATURES} />
                <Link href="/signup" className={`ui-btn-secondary ${PLAN_BUTTON}`}>
                  Commencer gratuitement
                </Link>
              </article>

              <article className={`order-2 ${PLAN_CARD} ui-card`}>
                <h3 className="font-semibold">Premium {PREMIUM_MONTHLY_PLAN.name.toLowerCase()}</h3>
                <p className={PLAN_PRICE}>
                  {PREMIUM_MONTHLY_PLAN.monthlyPrice} €
                  <span className="text-[15px] font-medium tracking-normal text-muted md:text-base"> / mois</span>
                </p>
                <p className={`text-muted ${PLAN_NOTE}`}>Sans engagement, résiliable à tout moment.</p>
                <PlanFeatures items={PREMIUM_FEATURES} />
                <Link href="/signup" className={`ui-btn-secondary ${PLAN_BUTTON}`}>
                  Obtenir le Premium
                </Link>
              </article>

              <article className={`relative order-1 rounded-card bg-ink text-white md:order-3 ${PLAN_CARD}`}>
                <span className="absolute -top-[11px] right-5 rounded-full bg-accent px-3 py-[5px] text-xs font-bold text-white md:-top-3 md:right-6">
                  Meilleure offre · −{QUARTERLY_SAVING_PERCENT} %
                </span>
                <h3 className="font-semibold">Premium {PREMIUM_QUARTERLY_PLAN.name}</h3>
                <p className={PLAN_PRICE}>
                  {PREMIUM_QUARTERLY_PLAN.monthlyPrice} €
                  <span className="text-[15px] font-medium tracking-normal text-[#A1A1AA] md:text-base"> / mois</span>
                </p>
                <p className={`text-[#A1A1AA] ${PLAN_NOTE}`}>
                  Facturé {PREMIUM_QUARTERLY_PLAN.billedAmount} € tous les {PREMIUM_QUARTERLY_PLAN.intervalMonths} mois, renouvelable. Résiliable à tout moment pour la période suivante.
                </p>
                <PlanFeatures items={QUARTERLY_FEATURES} inverse />
                <Link href="/signup" className={`ui-btn-inverse ${PLAN_BUTTON}`}>
                  Obtenir le Premium
                </Link>
              </article>
            </div>
            <p className="mt-5 text-center text-[12.5px] text-muted md:mt-[22px] md:text-[13px]">
              {PLAN_LIMITS_NOTE} {RESET_NOTE} Paiement sécurisé par Stripe.
            </p>
          </div>
        </section>

        {/* Bêta : fond dégradé léger de la maquette. Les conditions s'affichent avant l'inscription. */}
        {betaOpen && (
          <section id="beta" aria-labelledby="beta-title" className={`pb-16 md:pb-24 ${SCROLL_MARGIN}`}>
            <div className={WRAP}>
              <div className="rounded-[28px] border border-[#DBE4FF] bg-[linear-gradient(135deg,#F3F6FF,#fff)] px-[22px] py-7 md:flex md:items-center md:justify-between md:gap-8 md:rounded-[32px] md:px-12 md:py-11">
                <div className="max-w-[640px]">
                  <p className={`${EYEBROW} mb-2!`}>Bêta ouverte</p>
                  <h2 id="beta-title" className="text-[25px] leading-[1.15] font-bold tracking-[-0.03em] md:text-[34px]">
                    Deviens beta testeur : Premium offert jusqu&apos;au {BETA_PREMIUM_UNTIL_LABEL}.
                  </h2>
                  <p className="mt-3 mb-5 text-[15px] text-muted md:mb-0 md:text-base">
                    {BETA_MAX_TESTERS} places au maximum. Tu testes Applyfy, tu nous envoies {BETA_REPORTS.length} rapports sur ce qui marche et ce qui coince, et tu influences la suite.
                  </p>
                </div>
                <div className="shrink-0 [&>button]:w-full md:[&>button]:w-auto">
                  <BetaJoinDialog mode="link" triggerClassName="ui-btn-primary" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Questions fréquentes : réponses ouvertes, comme sur la maquette. */}
        <section aria-labelledby="faq-title" className="pb-16 md:pb-24">
          <div className={`${WRAP} md:flex md:gap-20`}>
            <h2
              id="faq-title"
              className="mb-[22px] text-[28px] leading-[1.1] font-bold tracking-[-0.035em] md:mb-0 md:flex-[.8] md:text-[38px] md:leading-[1.08]"
            >
              Questions fréquentes
            </h2>
            <div className="md:flex-[1.2]">
              {FAQ.map((item) => (
                <div key={item.question} className="border-t border-line py-[18px] first:border-t-0 first:pt-0 md:py-[22px]">
                  <h3 className="text-base font-semibold md:text-[17px]">{item.question}</h3>
                  <p className="mt-2 text-[15px] text-muted md:text-base">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Appel à l'action final */}
        <section aria-labelledby="cta-title" className="pb-12 md:pb-24">
          <div className={WRAP}>
            <Reveal className="rounded-[28px] bg-ink px-[22px] py-10 text-center text-white md:rounded-[36px] md:px-12 md:py-[72px]">
              <h2
                id="cta-title"
                className="mx-auto max-w-[720px] text-[31px] leading-[1.08] font-extrabold tracking-[-0.04em] md:text-[50px] md:leading-[1.06]"
              >
                Prêt(e) à reprendre le contrôle de ta recherche ?
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-base text-[#A1A1AA] md:mt-5 md:text-lg">
                Crée ton compte en une minute et ajoute ta première candidature.
              </p>
              <Link href="/signup" className="ui-btn-inverse mt-6 min-h-[52px]! px-8! text-base! max-md:w-full md:mt-8">
                Commencer gratuitement
              </Link>
              <p className="mt-3 text-[13px] text-[#A1A1AA]">{FRICTION_REDUCER}</p>
              <p className="mt-1 text-sm text-[#A1A1AA]">
                J&apos;ai déjà un compte ?{" "}
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-medium text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Se connecter
                </Link>
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <MobileCtaBar />
    </div>
  );
}
