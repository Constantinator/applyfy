import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
import { Reveal } from "@/components/landing/reveal";
import { LogoFull } from "@/components/logo";
import { SiteHeader } from "@/components/site/site-header";
import { AI_MONTHLY_LIMITS, PREMIUM_PRICE_LABEL } from "@/lib/ai-usage-limits";
import { BETA_MAX_TESTERS } from "@/lib/beta-rules";

/**
 * Page de preview isolée : landing redesignée façon Linear (plus d'air, sections alternées
 * blanc / #f9fafb, titres resserrés), avec les couleurs actuelles. Non indexée, absente du sitemap.
 */
export const metadata: Metadata = {
  title: "Design test — Applyfy",
  robots: { index: false, follow: false },
};

// Typographie : graisse 600 sur tous les titres, letter-spacing négatif sur H1 et H2.
const H1 = "font-semibold tracking-[-0.03em]";
const H2 = "font-semibold tracking-[-0.02em]";
const H3 = "font-semibold";

// Sur-titre bleu au-dessus des H2.
const EYEBROW =
  "text-center text-sm font-medium tracking-wide text-blue-600 uppercase";

// Boutons compacts (8px 14px, rayon 8px, 14px, graisse 500) : le « ! » l'emporte sur btn-*.
const BUTTON = "rounded-[8px]! px-[14px]! py-2! text-sm! font-medium!";
const BTN_PRIMARY = `btn-primary ${BUTTON}`;
const BTN_SECONDARY = `btn-secondary ${BUTTON}`;

// Rythme : sections alternées blanc / gris clair, 96px de part et d'autre.
// Transparent / voile gris léger : le dégradé de la page reste visible sous chaque section.
// relative isolate : le z-10 du contenu reste dans la section (sous l'en-tête collant, z-10 aussi)
// et la section passe au-dessus des rubans SVG du wrapper.
const BG_WHITE = "relative isolate bg-transparent";
const BG_GRAY = "relative isolate bg-slate-500/[0.04]";
// Contenu de chaque section, au-dessus des rubans.
const CONTENT = "relative z-10";
const SECTION_Y = "py-24";

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
    title: "Suivi en temps réel",
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
    title: "Rappels de relance",
    preview: FollowUpPreview,
    description:
      "Applyfy te prévient quand une entreprise tarde à répondre et prépare ton message de relance.",
    icon: IconBell,
  },
  {
    title: "Tous tes documents",
    preview: DocumentsPreview,
    description:
      "CV, lettres, offres et échanges : chaque candidature garde son historique complet.",
    icon: IconFolder,
  },
];

type Support = "yes" | "no" | "partial";

const COMPARISON_TOOLS = [
  { name: "Applyfy", price: `Gratuit · ${PREMIUM_PRICE_LABEL}` },
  { name: "Huntr", price: "Pro : 40 $/mois" },
  { name: "Excel / Word", price: null },
] as const;

const COMPARISON: { feature: string; values: [Support, Support, Support] }[] = [
  { feature: "Interface en français", values: ["yes", "no", "yes"] },
  { feature: "Suivi des candidatures", values: ["yes", "yes", "no"] },
  { feature: "Recherche d'offres intégrée", values: ["yes", "no", "no"] },
  { feature: "CV adapté à l'offre (IA)", values: ["yes", "partial", "no"] },
  { feature: "Lettre de motivation IA", values: ["yes", "partial", "no"] },
  { feature: "Rappels de relance", values: ["yes", "partial", "no"] },
];

const SUPPORT_DISPLAY: Record<
  Support,
  { symbol: string; label: string; className: string; size: string }
> = {
  yes: {
    symbol: "✓",
    label: "Oui",
    className: "text-emerald-600",
    size: "text-lg font-bold",
  },
  no: {
    symbol: "✕",
    label: "Non",
    className: "text-red-500",
    size: "text-xl font-black",
  },
  partial: {
    symbol: "~",
    label: "Partiel",
    className: "text-amber-500",
    size: "text-xl font-semibold",
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
 * Rubans SVG du wrapper (milieu gauche, bas droite, bas gauche), sous les sections (z-0). Placés
 * avant l'en-tête dans le DOM : les sections, positionnées après, passent au-dessus.
 * Chaque SVG est 30 % plus large que sa zone visible et décalé d'autant hors de l'écran : les
 * rubans traversent le bord et continuent au-delà (coupés par overflow-x-clip), sans arête visible.
 */
function PageRibbons() {
  return (
    <>
      {/* Milieu gauche : 3 rubans qui entrent par le bord gauche et s'affinent en pointe. */}
      <svg
        aria-hidden="true"
        viewBox="-120 0 520 500"
        className="pointer-events-none absolute top-[40%] -left-[120px] z-0 h-[500px] w-[520px] -translate-y-1/2"
      >
        <path
          d="M-120 140 C0 100 120 150 220 210 S340 300 400 290 C330 330 260 290 200 260 S40 180 -120 200 Z"
          fill="#0ea5e9"
          opacity="0.12"
        />
        <path
          d="M-120 250 C20 210 150 260 240 310 S350 380 390 375 C330 410 250 360 190 340 S20 290 -120 300 Z"
          fill="#1d4ed8"
          opacity="0.10"
        />
        <path
          d="M-120 320 C40 300 140 350 210 390 S310 450 350 470 C290 480 200 430 140 400 S0 350 -120 360 Z"
          fill="#38bdf8"
          opacity="0.08"
        />
      </svg>

      {/* Bas droite : rubans qui naissent en pointe et remontent vers le bord droit, plus discrets. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 650 600"
        className="pointer-events-none absolute -right-[150px] bottom-[20%] z-0 h-[600px] w-[650px]"
      >
        <path
          d="M120 560 C220 470 320 420 400 340 S520 180 650 140 L650 290 C540 320 460 390 400 440 S240 540 120 560 Z"
          fill="#1d4ed8"
          opacity="0.12"
        />
        <path
          d="M220 590 C280 530 350 500 420 450 S540 340 650 320 L650 390 C560 400 480 460 420 500 S300 580 220 590 Z"
          fill="#6366f1"
          opacity="0.10"
        />
        <path
          d="M80 520 C170 420 280 360 360 270 S480 100 650 40 L650 80 C510 120 420 250 340 320 S160 480 80 520 Z"
          fill="#0ea5e9"
          opacity="0.08"
        />
      </svg>

      {/* Tout en bas à gauche : 2 rubans très discrets, du bord gauche vers le bas de la page. */}
      <svg
        aria-hidden="true"
        viewBox="-120 0 520 400"
        className="pointer-events-none absolute bottom-0 -left-[120px] z-0 h-[400px] w-[520px]"
      >
        <path
          d="M-120 100 C0 140 100 210 160 280 S240 370 270 400 L210 400 C180 370 130 320 100 290 S10 200 -120 180 Z"
          fill="#38bdf8"
          opacity="0.10"
        />
        <path
          d="M-120 230 C20 260 90 310 125 355 S155 395 165 400 L105 400 C85 380 65 355 45 335 S-20 290 -120 285 Z"
          fill="#0ea5e9"
          opacity="0.07"
        />
      </svg>
    </>
  );
}

/**
 * Tarifs : uniquement ce que l'app fait aujourd'hui (voir /premium, ai-usage-limits, beta-rules).
 * Premium « illimité » comme sur /premium (garde-fou de 50 actions IA par jour en interne).
 */
const PLAN_FEATURES = {
  free: [
    "Suivi illimité des candidatures",
    "Tableau de bord",
    "Rappels de relance par e-mail",
    `${AI_MONTHLY_LIMITS.lettre} actions IA par type et par mois (résumé d'offre, analyse de CV, lettre…)`,
  ],
  premium: [
    "Tout le plan gratuit",
    "Résumés d'offre et analyses de CV illimités",
    "Éditeur de CV et lettres de motivation illimités",
    "Chat « Affiner avec l'IA » illimité",
  ],
};

/**
 * FAQ : chaque réponse doit rester exacte (CGU, politique de confidentialité, prompts de
 * src/lib/claude.ts, import d'offres de src/lib/offer-import.ts).
 */
const FAQ: { question: string; answer: React.ReactNode }[] = [
  {
    question: "Qu'est-ce qui est gratuit ?",
    answer: `Le plan gratuit inclut le suivi illimité de tes candidatures, le tableau de bord, les rappels de relance et ${AI_MONTHLY_LIMITS.lettre} actions IA par type et par mois. Aucune carte bancaire requise.`,
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
          className="font-medium text-blue-600 underline-offset-4 hover:underline"
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
      "Oui, le Premium est sans engagement. Et si tu n'es pas satisfait(e), tu es remboursé(e) intégralement dans les 14 jours suivant ton premier abonnement, sauf si tu as renoncé à ton droit de rétractation pour accéder immédiatement au service.",
  },
  {
    question: "Est-ce que ça marche avec Indeed ou Welcome to the Jungle ?",
    answer:
      "Oui. Colle le lien d'une offre Indeed, Welcome to the Jungle ou de la plupart des sites carrières : Applyfy récupère l'intitulé, l'entreprise et la description. Tu peux aussi chercher des offres directement depuis Applyfy.",
  },
];

function PlanFeatures({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className="font-bold text-blue-600">
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function DesignTestPage() {
  return (
    // Dégradé sur toute la page : les sections sont transparentes ou teintées par-dessus.
    <div className="relative isolate flex flex-1 flex-col overflow-x-clip bg-[linear-gradient(180deg,#eff6ff_0%,#f8faff_30%,#ffffff_60%,#f0f9ff_80%,#ecfeff_100%)]">
      {/* Rubans décoratifs répartis sur la page (le 1er, en haut à droite, est dans le hero).
          overflow-x-clip : pas de défilement horizontal sur mobile (clip, pas hidden : l'en-tête reste collant). */}
      <PageRibbons />

      <SiteHeader />

      {/* Bandeau de preview : rappelle que la page n'est qu'un test visuel. */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
        Preview du nouveau design —{" "}
        <Link href="/" className="font-medium underline underline-offset-4">
          comparer avec la landing actuelle
        </Link>
      </div>

      <main className="flex-1">
        {/*
          Hero : fond transparent (dégradé du wrapper), rubans SVG façon Stripe dans le coin
          supérieur droit. isolate : le z-10 du contenu reste sous l'en-tête collant (z-10 aussi).
          120px au-dessus au minimum, 160px sur grand écran.
        */}
        <section className="relative isolate overflow-hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 780 700"
            className="pointer-events-none absolute top-0 -right-[180px] z-0 h-[700px] w-[780px]"
          >
            {/* Ruban large */}
            <path
              d="M180 0 C260 140 380 200 470 300 S600 470 780 520 L780 360 C640 330 540 250 460 180 S330 60 300 0 Z"
              fill="#1d4ed8"
              opacity="0.15"
            />
            {/* Ruban moyen, près du coin */}
            <path
              d="M320 0 C380 110 470 170 560 240 S700 330 780 340 L780 230 C700 220 610 160 540 110 S440 30 420 0 Z"
              fill="#0ea5e9"
              opacity="0.20"
            />
            {/* Ruban fin, le plus long */}
            <path
              d="M100 0 C200 180 330 260 430 380 S600 600 780 660 L780 610 C620 560 500 440 410 340 S180 110 140 0 Z"
              fill="#38bdf8"
              opacity="0.12"
            />
            {/* Ruban indigo, croise les deux premiers */}
            <path
              d="M240 0 C300 80 400 110 480 180 S620 300 780 290 L780 220 C640 230 520 150 440 100 S340 30 330 0 Z"
              fill="#6366f1"
              opacity="0.10"
            />
          </svg>
          <div className="relative z-10 mx-auto max-w-7xl px-4 pt-[120px] pb-24 sm:px-6 lg:pt-40">
            <div className="mx-auto max-w-4xl text-center">
              {/* Logo masqué sur mobile (déjà dans l'en-tête) : titre et CTA remontent. */}
              <LogoFull className="mx-auto mb-12 hidden h-auto w-72 sm:block" />
              {/* Offre beta en pastille : seule vraie rareté de la page, mise en avant. */}
              <div className="mb-8 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-sm text-slate-600 backdrop-blur">
                <span className="font-medium text-blue-700">✦ Beta</span>
                <span>Premium offert jusqu&apos;au 31/12/2026 · 30 places</span>
                <span aria-hidden="true" className="text-slate-300">
                  |
                </span>
                <BetaJoinDialog
                  mode="link"
                  triggerClassName="font-medium text-blue-600 underline-offset-4 hover:underline"
                />
              </div>
              <h1
                className={`text-5xl leading-[1.08] text-balance text-slate-900 sm:text-6xl lg:text-7xl ${H1}`}
              >
                Toutes tes candidatures au même endroit.{" "}
                <span className="text-blue-600">
                  Un CV adapté à chaque offre.
                </span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-pretty text-slate-500 sm:text-xl">
                Applyfy suit tes candidatures, adapte ton CV et ta lettre à
                chacune d&apos;entre elles, et te dit quand relancer. Pour
                trouver ton job sans t&apos;y noyer.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/signup" className={BTN_PRIMARY}>
                  Commencer gratuitement
                </Link>
                <a href="#comment-ca-marche" className={BTN_SECONDARY}>
                  Voir comment ça marche
                </a>
              </div>
              {/* Réducteur de friction sous le CTA (« Se connecter » reste dans l'en-tête). */}
              <p className="mt-4 text-sm text-slate-500">{FRICTION_REDUCER}</p>
            </div>

            {/* Dashboard : 90 % de la largeur du conteneur (1 280 px au plus), ombre légère. */}
            <figure className="mx-auto mt-20 w-[90%] sm:mt-24">
              <div className="overflow-hidden rounded-[16px] border border-[#e5e7eb] shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
                <DemoDashboard />
              </div>
              <figcaption className="mt-4 text-center text-sm text-slate-500">
                Le dashboard Applyfy — toutes tes candidatures au même endroit
              </figcaption>
            </figure>
          </div>
        </section>

        {/*
          Preuve sociale fondateur : en attendant de vrais témoignages, un visage et une histoire
          réels. Fond blanc pour se détacher du dégradé du hero, 48px de part et d'autre.
        */}
        <section
          aria-label="Le mot du fondateur"
          className="relative isolate bg-white"
        >
          <figure
            className={`mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-12 text-center sm:flex-row sm:px-6 sm:text-left ${CONTENT}`}
          >
            <Image
              src="/images/founder.jpg"
              alt="Constantin, fondateur d'Applyfy"
              width={200}
              height={200}
              className="h-[200px] w-[200px] shrink-0 rounded-2xl object-cover grayscale"
            />
            <div>
              <blockquote className="text-lg leading-relaxed text-pretty text-slate-700 italic">
                « J&apos;ai créé Applyfy après avoir postulé à de nombreuses
                offres. Je me perdais vite et cela me frustrait. Je voulais un
                outil simple qui m&apos;aide à candidater, je l&apos;ai donc
                créé. »
              </blockquote>
              <figcaption className="mt-4 text-sm text-slate-500">
                — Constantin, fondateur d&apos;Applyfy
              </figcaption>
              <Link
                href="/about"
                className="mt-2 inline-block text-sm font-medium text-blue-600 underline-offset-4 hover:underline"
              >
                Notre histoire →
              </Link>
            </div>
          </figure>
        </section>

        {/* Les chiffres qui font mal (gris) : 80px de part et d'autre, chiffres agrandis. */}
        <section aria-labelledby="stats-title" className={BG_GRAY}>
          <Reveal className={`mx-auto max-w-6xl px-4 py-20 sm:px-6 ${CONTENT}`}>
            <p className={EYEBROW}>La réalité du marché</p>
            <h2
              id="stats-title"
              className={`mt-3 text-center text-3xl text-slate-900 sm:text-4xl ${H2}`}
            >
              Les chiffres qui font mal
            </h2>
            <ul className="mt-16 grid gap-14 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#e5e7eb]">
              {PAIN_STATS.map((stat) => (
                <li
                  key={stat.key}
                  className="flex flex-col items-center px-6 text-center"
                >
                  {/* Hauteur commune : chiffres et formulation qualitative alignés sur la même ligne. */}
                  <div className="flex min-h-20 items-end justify-center lg:min-h-24">
                    {stat.value ? (
                      <div className="flex items-baseline gap-2">
                        <CountUp
                          value={stat.value}
                          className={`text-brand text-7xl whitespace-nowrap sm:text-6xl lg:text-8xl ${H1}`}
                        />
                        <span
                          className={`text-brand text-2xl lg:text-3xl ${H2}`}
                        >
                          {stat.unit}
                        </span>
                      </div>
                    ) : (
                      <p
                        className={`text-brand text-5xl sm:text-4xl lg:text-5xl ${H1}`}
                      >
                        {stat.text}
                      </p>
                    )}
                  </div>
                  <p className="mt-4 max-w-[16rem] text-base leading-relaxed text-slate-600">
                    {stat.label}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-14 text-center text-xs text-slate-500">
              {PAIN_STATS_SOURCES}
            </p>
          </Reveal>
        </section>

        {/* Fonctionnalités (blanc) : blocs pleine largeur, texte et aperçu en alternance. */}
        <section aria-labelledby="features-title" className={BG_WHITE}>
          <div
            className={`mx-auto max-w-6xl px-4 sm:px-6 ${SECTION_Y} ${CONTENT}`}
          >
            <Reveal>
              <p className={EYEBROW}>Fonctionnalités</p>
              <h2
                id="features-title"
                className={`mt-3 text-center text-3xl text-slate-900 sm:text-4xl ${H2}`}
              >
                Tout ce qu&apos;il te faut pour décrocher ton job
              </h2>
            </Reveal>
            {/*
              4 blocs empilés, en alternance : texte à gauche pour le 1er et le 3e, aperçu à
              gauche pour le 2e et le 4e (le texte reste en premier dans le DOM pour la lecture).
              Sur mobile, texte puis aperçu l'un sous l'autre.
            */}
            <div className="mt-8">
              {FEATURES.map((feature, index) => (
                <Reveal
                  key={feature.title}
                  className={`flex flex-col gap-10 border-b border-gray-100 py-16 last:border-b-0 md:items-center md:gap-16 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  <div className="md:w-1/2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/20">
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <h3 className={`mt-5 text-2xl text-slate-900 ${H3}`}>
                      {feature.title}
                    </h3>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                  <div className="md:w-1/2">
                    <div className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow duration-200 hover:shadow-md">
                      <feature.preview />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Comment ça marche (gris) */}
        <section
          id="comment-ca-marche"
          aria-labelledby="steps-title"
          className={`scroll-mt-16 ${BG_GRAY}`}
        >
          <Reveal
            className={`mx-auto max-w-6xl px-4 sm:px-6 ${SECTION_Y} ${CONTENT}`}
          >
            <p className={EYEBROW}>Comment ça marche</p>
            <h2
              id="steps-title"
              className={`mt-3 text-center text-3xl text-slate-900 sm:text-4xl ${H2}`}
            >
              4 étapes, et ta recherche devient organisée
            </h2>
            <ol className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <span
                aria-hidden="true"
                className="absolute top-4 right-[12%] left-[12%] hidden h-px bg-blue-200 lg:block"
              />
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative text-center">
                  <span className="relative mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white ring-4 ring-[#f9fafb]">
                    {index + 1}
                  </span>
                  <h3 className={`mt-5 text-slate-900 ${H3}`}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* Pourquoi Applyfy ? (blanc) */}
        <section aria-labelledby="why-title" className={BG_WHITE}>
          <Reveal
            className={`mx-auto max-w-4xl px-4 sm:px-6 ${SECTION_Y} ${CONTENT}`}
          >
            <h2
              id="why-title"
              className={`text-center text-3xl text-slate-900 sm:text-4xl ${H2}`}
            >
              Pourquoi Applyfy ?
            </h2>
            <p className="mt-4 text-center text-lg text-slate-500">
              Ce que les autres outils ne font pas (ou font payer très cher).
            </p>
            <div className="relative mt-12 overflow-x-auto rounded-[16px] border border-[#e5e7eb] bg-white">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="sr-only">
                  Comparatif d&apos;Applyfy avec Huntr et Excel / Word
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-4 text-left font-medium text-slate-500"
                    >
                      <span className="sr-only">Fonctionnalité</span>
                    </th>
                    {COMPARISON_TOOLS.map((tool, index) => (
                      <th
                        key={tool.name}
                        scope="col"
                        className={`px-4 py-4 text-center font-semibold ${
                          index === 0
                            ? "bg-[#1E40AF] text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {tool.name}
                        {tool.price && (
                          <span
                            className={`mt-0.5 block text-xs font-normal ${
                              index === 0 ? "text-white/75" : "text-slate-500"
                            }`}
                          >
                            {tool.price}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-t border-[#e5e7eb]">
                      <th
                        scope="row"
                        className="px-4 py-3.5 text-left font-medium text-slate-700"
                      >
                        {row.feature}
                      </th>
                      {row.values.map((value, index) => {
                        const display = SUPPORT_DISPLAY[value];
                        return (
                          <td
                            key={COMPARISON_TOOLS[index].name}
                            className={`px-4 py-3.5 text-center ${display.className} ${
                              index === 0
                                ? "bg-green-50 text-2xl font-black"
                                : display.size
                            }`}
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
            <p className="mt-4 text-center text-xs text-slate-500">
              ~ = fonctionnalité partielle ou disponible uniquement sur plan
              payant
            </p>
          </Reveal>
        </section>

        {/* Tarifs & questions fréquentes (blanc) : 80px de part et d'autre. */}
        <section
          aria-labelledby="pricing-title"
          className="relative isolate bg-white"
        >
          <div className={`mx-auto max-w-4xl px-4 py-20 sm:px-6 ${CONTENT}`}>
            <h2
              id="pricing-title"
              className={`text-center text-3xl text-slate-900 sm:text-4xl ${H2}`}
            >
              Tarifs &amp; questions fréquentes
            </h2>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <article className="flex flex-col rounded-[12px] border border-[#e5e7eb] bg-white p-8">
                <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Gratuit pour toujours
                </span>
                <h3 className={`mt-5 text-lg text-slate-900 ${H3}`}>Gratuit</h3>
                <p className={`mt-1 text-4xl text-slate-900 ${H1}`}>0 €</p>
                <div className="mt-6 flex-1">
                  <PlanFeatures items={PLAN_FEATURES.free} />
                </div>
                <Link href="/signup" className={`mt-8 w-full ${BTN_SECONDARY}`}>
                  Commencer gratuitement
                </Link>
              </article>

              {/* Premium mis en avant : bordure bleue, fond bleuté. */}
              <article className="flex flex-col rounded-[12px] border border-blue-500 bg-blue-50/50 p-8 ring-1 ring-blue-500">
                <span className="self-start rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                  Bêta : offert jusqu&apos;au 31/12/2026
                </span>
                <h3 className={`mt-5 text-lg text-slate-900 ${H3}`}>Premium</h3>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className={`text-4xl text-slate-900 ${H1}`}>0 €</span>
                  <s className="text-lg text-slate-400">
                    <span className="sr-only">au lieu de </span>
                    {PREMIUM_PRICE_LABEL}
                  </s>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Pour les {BETA_MAX_TESTERS} bêta-testeurs jusqu&apos;au
                  31/12/2026, puis {PREMIUM_PRICE_LABEL} sans engagement.
                </p>
                <div className="mt-6 flex-1">
                  <PlanFeatures items={PLAN_FEATURES.premium} />
                </div>
                {/* Ouvre les conditions du programme beta (inscription ou connexion ensuite). */}
                <BetaJoinDialog
                  mode="link"
                  triggerClassName={`mt-8 w-full ${BTN_PRIMARY}`}
                />
              </article>
            </div>

            <div className="mt-16 divide-y divide-[#e5e7eb] border-y border-[#e5e7eb]">
              {FAQ.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="text-xl leading-none text-slate-400 transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pr-8 text-[15px] leading-relaxed text-slate-600">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Appel à l'action final (gris) */}
        <section aria-labelledby="cta-title" className={BG_GRAY}>
          <Reveal
            className={`mx-auto max-w-4xl px-4 text-center sm:px-6 ${SECTION_Y} ${CONTENT}`}
          >
            <h2
              id="cta-title"
              className={`text-3xl text-[#1E40AF] sm:text-4xl ${H2}`}
            >
              Prêt(e) à reprendre le contrôle de ta recherche ?
            </h2>
            <p className="mt-4 text-slate-600">
              Crée ton compte en une minute et ajoute ta première candidature.
            </p>
            <Link href="/signup" className={`mt-8 ${BTN_PRIMARY}`}>
              Commencer gratuitement
            </Link>
            <p className="mt-3 text-sm text-slate-500">{FRICTION_REDUCER}</p>
            <p className="mt-4 text-sm text-slate-500">
              J&apos;ai déjà un compte →{" "}
              <Link
                href="/login"
                className="font-medium text-blue-600 underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </Reveal>
        </section>
      </main>
    </div>
  );
}
