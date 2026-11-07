"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { HERO_EXAMPLE_SCORE } from "@/components/landing/hero-visual";
import { ScoreGauge } from "@/components/cv-builder/cv-score-card";
import {
  IconBell,
  IconBriefcase,
  IconClock,
  IconMapPin,
  IconSearch,
  IconSparkles,
  IconUser,
} from "@/components/icons";
import { BrandLogo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { READY_SCORE, SCORE_CATEGORIES } from "@/lib/cv-score";
import { todoCountLabel } from "@/lib/dashboard-todo";
import {
  APPLICATION_STATUSES,
  RESPONSE_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/types";

// Applyfy simulé (données fictives) sur la landing : barre du haut de l'application, écrans Tableau
// de bord, Candidatures et Trouver une offre, et fiche candidature en panneau latéral, avec les
// vrais statuts. Aucun titre (h1-h6) à l'intérieur : la démo ne compte pas dans le plan de la page.

type DemoEvent = {
  label: string;
  date: string;
  tone: "slate" | "blue" | "amber" | "violet" | "red";
};

type DemoApplication = {
  id: string;
  company: string;
  position: string;
  location: string;
  status: ApplicationStatus;
  sentAt: string;
  /** Jours depuis l'envoi, à la date fictive de la démo (12 oct.). */
  sentDaysAgo: number;
  lastContact: string;
  contact: string;
  summary: string[];
  /** Aperçu de l'onglet « Mots-clés » du CV Builder : taux et mots-clés manquants. */
  keywordRate: number;
  missingKeywords: { group: string; items: string[] }[];
  followUp: boolean;
  events: DemoEvent[];
  note: string;
};

const APPLICATIONS: DemoApplication[] = [
  {
    id: "google",
    company: "Google",
    position: "Développeur Senior",
    location: "Paris",
    status: "en_attente",
    sentAt: "8 oct. 2026",
    sentDaysAgo: 4,
    lastContact: "Il y a 4 jours",
    contact: "Équipe recrutement",
    summary: [
      "Services Cloud à grande échelle, en Go et TypeScript",
      "5 ans d'expérience backend, culture de la revue de code",
      "CDI, hybride à Paris",
    ],
    keywordRate: 62,
    missingKeywords: [
      { group: "Compétences techniques", items: ["Go", "Systèmes distribués"] },
      { group: "Compétences comportementales", items: ["Mentorat"] },
    ],
    followUp: false,
    events: [
      { label: "Candidature envoyée", date: "8 oct.", tone: "blue" },
      { label: "Candidature créée", date: "7 oct.", tone: "slate" },
    ],
    note: "Référé par Julien (promo 2019). Relancer le 18 oct. si pas de réponse.",
  },
  {
    id: "stripe",
    company: "Stripe",
    position: "Product Manager",
    location: "Paris · Hybride",
    status: "entretien",
    sentAt: "2 oct. 2026",
    sentDaysAgo: 10,
    lastContact: "Hier",
    contact: "Camille, hiring manager",
    summary: [
      "Roadmap des paiements en Europe",
      "Travail avec ingénierie, design et conformité",
      "Expérience produit B2B attendue",
    ],
    keywordRate: 71,
    missingKeywords: [
      { group: "Compétences techniques", items: ["DSP2", "Paiements"] },
      { group: "Compétences comportementales", items: ["Leadership"] },
    ],
    followUp: false,
    events: [
      { label: "Statut modifié : Entretien", date: "11 oct.", tone: "violet" },
      { label: "Réponse reçue", date: "10 oct.", tone: "violet" },
      { label: "Candidature envoyée", date: "2 oct.", tone: "blue" },
    ],
    note: "Entretien mardi 14 h avec la hiring manager. Préparer un cas produit sur les paiements récurrents.",
  },
  {
    id: "alan",
    company: "Alan",
    position: "UX Designer",
    location: "Paris",
    status: "relancee",
    sentAt: "26 sept. 2026",
    sentDaysAgo: 16,
    lastContact: "Il y a 2 jours",
    contact: "Thomas, Design Lead",
    summary: [
      "Parcours santé clairs et rassurants",
      "De la recherche utilisateur aux maquettes",
      "Figma et tests utilisateurs",
    ],
    keywordRate: 68,
    missingKeywords: [
      { group: "Compétences techniques", items: ["Design system"] },
      { group: "Compétences comportementales", items: ["Empathie"] },
    ],
    followUp: true,
    events: [
      { label: "Relance", date: "10 oct.", tone: "amber" },
      { label: "Candidature envoyée", date: "26 sept.", tone: "blue" },
    ],
    note: "Relance envoyée par email. Portfolio mis à jour avec le projet de fin d'études.",
  },
  {
    id: "doctolib",
    company: "Doctolib",
    position: "Data Analyst",
    location: "Levallois-Perret",
    status: "refusee",
    sentAt: "19 sept. 2026",
    sentDaysAgo: 23,
    lastContact: "Il y a 9 jours",
    contact: "Équipe Data",
    summary: [
      "Analyse de l'usage de la plateforme par les praticiens",
      "Tableaux de bord produit : SQL, dbt, Looker",
      "Stage de 6 mois",
    ],
    keywordRate: 58,
    missingKeywords: [
      { group: "Compétences techniques", items: ["dbt", "Looker"] },
      { group: "Compétences comportementales", items: ["Autonomie"] },
    ],
    followUp: false,
    events: [
      { label: "Statut modifié : Refusée", date: "3 oct.", tone: "red" },
      { label: "Candidature envoyée", date: "19 sept.", tone: "blue" },
    ],
    note: "Refus après le test technique. Retour demandé pour progresser en SQL avancé.",
  },
  {
    id: "blablacar",
    company: "BlaBlaCar",
    position: "Frontend Engineer",
    location: "Paris · Télétravail",
    status: "envoyee",
    sentAt: "12 oct. 2026",
    sentDaysAgo: 0,
    lastContact: "Aujourd'hui",
    contact: "Équipe recrutement",
    summary: [
      "Application web de covoiturage en React et TypeScript",
      "Performance et accessibilité",
      "Télétravail possible",
    ],
    keywordRate: 74,
    missingKeywords: [
      { group: "Compétences techniques", items: ["Playwright", "Next.js"] },
      { group: "Compétences comportementales", items: ["Esprit d'équipe"] },
    ],
    followUp: false,
    events: [
      { label: "Candidature envoyée", date: "12 oct.", tone: "blue" },
      { label: "Candidature créée", date: "12 oct.", tone: "slate" },
    ],
    note: "CV adapté à l'offre : React, accessibilité et performance mis en avant.",
  },
];

const EVENT_DOTS: Record<DemoEvent["tone"], string> = {
  slate: "bg-line-strong",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  red: "bg-red-500",
};

/** Carte de la fiche candidature. */
function PanelCard({
  title,
  children,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-card p-4 ${className}`}>
      <p className="mb-3 font-semibold text-ink">{title}</p>
      {children}
    </section>
  );
}

const TOAST_CREATE = "Inscris-toi pour créer ta première candidature";
const TOAST_FEATURE = "Inscris-toi pour accéder à cette fonctionnalité";

type Screen = "dashboard" | "candidatures" | "offres";

// Barre du haut : mêmes liens que l'application. Sans écran : le message d'inscription.
const NAV: { label: string; screen: Screen | null }[] = [
  { label: "Tableau de bord", screen: "dashboard" },
  { label: "Candidatures", screen: "candidatures" },
  { label: "Trouver une offre", screen: "offres" },
  { label: "CV Builder", screen: null },
];

const SCREEN_URLS: Record<Screen, string> = {
  dashboard: "applyfy.fr/dashboard",
  candidatures: "applyfy.fr/candidatures",
  offres: "applyfy.fr/offres",
};

const FIRST_NAME = "Camille";

const PAGE_TITLE = "text-[28px] leading-[1.1] font-bold tracking-[-0.035em] text-ink sm:text-[40px]";
const CARD_TITLE = "ui-title";

type DemoOffer = {
  id: string;
  title: string;
  company: string;
  location: string;
  contract: string;
  published: string;
  source: "France Travail" | "Adzuna";
};

const OFFERS: DemoOffer[] = [
  {
    id: "qonto",
    title: "Product Manager Junior",
    company: "Qonto",
    location: "Paris",
    contract: "CDI",
    published: "Il y a 2 jours",
    source: "France Travail",
  },
  {
    id: "swile",
    title: "Business Developer — Stage 6 mois",
    company: "Swile",
    location: "Montpellier",
    contract: "Stage",
    published: "Hier",
    source: "Adzuna",
  },
  {
    id: "decathlon",
    title: "Data Analyst en alternance",
    company: "Decathlon",
    location: "Lille",
    contract: "Alternance",
    published: "Il y a 3 jours",
    source: "France Travail",
  },
  {
    id: "ledger",
    title: "Customer Success Manager",
    company: "Ledger",
    location: "Paris · Hybride",
    contract: "CDD",
    published: "Aujourd'hui",
    source: "Adzuna",
  },
];

/** Faux champ de la recherche d'offres : un clic affiche le message. */
function FakeField({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  icon?: typeof IconSearch;
  onClick: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <button type="button" onClick={onClick} className="ui-input flex items-center gap-2 text-left text-muted">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted" />}
        <span className="truncate">{value}</span>
        {!Icon && <span className="ml-auto text-muted">▾</span>}
      </button>
    </div>
  );
}

/** Écran « Trouver une offre » de la démo (calqué sur /offres). */
function DemoOffers({ onFeature }: { onFeature: () => void }) {
  return (
    <div className="min-w-0 flex-1 space-y-6 p-5 sm:p-8">
      <div>
        <p className={PAGE_TITLE}>Trouver une offre</p>
        <p className="mt-2 text-sm text-muted">
          Trouve ton prochain job et ajoute-le en un clic à tes candidatures.
        </p>
      </div>

      <button
        type="button"
        onClick={onFeature}
        className="ui-focus inline-flex min-h-11 items-center gap-3 text-sm font-medium text-ink"
      >
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-track">
          <span className="h-5 w-5 translate-x-0.5 rounded-full bg-white" />
        </span>
        Recommandations personnalisées
      </button>

      <div role="search" className="ui-card animate-demo-in space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FakeField label="Mot-clé" value="Product, data, business…" icon={IconSearch} onClick={onFeature} />
          <FakeField label="Localisation" value="Paris, Lille, Montpellier" icon={IconMapPin} onClick={onFeature} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FakeField label="Type de contrat" value="Tous les contrats" onClick={onFeature} />
          <FakeField label="Trier par" value="Le plus récent" onClick={onFeature} />
          <button type="button" onClick={onFeature} className="ui-btn-primary">
            <IconSearch className="h-4 w-4" />
            Rechercher
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-muted">
          <strong className="font-semibold text-ink">{OFFERS.length} offres</strong>
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {OFFERS.map((offer, index) => (
            <li key={offer.id} style={{ animationDelay: `${150 + index * 110}ms` }} className="animate-demo-in">
              <button
                type="button"
                onClick={onFeature}
                className="ui-card ui-focus block h-full w-full p-5 text-left transition-colors hover:border-line-strong"
              >
                <span className="block text-base leading-snug font-bold text-ink">{offer.title}</span>
                <span className="mt-1 block text-sm font-medium text-prose">{offer.company}</span>
                <span className="mt-3 flex items-end justify-between gap-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <IconMapPin className="h-3.5 w-3.5" />
                      {offer.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock className="h-3.5 w-3.5" />
                      {offer.published}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconBriefcase className="h-3.5 w-3.5" />
                      {offer.contract}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-pill px-2 py-0.5 text-[11px] text-muted">
                    {offer.source}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Écran « Tableau de bord » de la démo (calqué sur /dashboard). */
function DemoHome({
  onFeature,
  onOpen,
}: {
  onFeature: () => void;
  onOpen: (id: string) => void;
}) {
  const todo = APPLICATIONS.filter((app) => app.followUp);
  const sentThisWeek = APPLICATIONS.filter((app) => app.sentDaysAgo < 7).length;
  const weakPoint = SCORE_CATEGORIES.find((category) => category.id === "keywords")?.label;
  const tiles = [
    ["Envoyées", APPLICATIONS.length],
    ["Réponses", APPLICATIONS.filter((app) => RESPONSE_STATUSES.includes(app.status)).length],
    ["Entretiens", APPLICATIONS.filter((app) => app.status === "entretien").length],
  ] as const;

  return (
    <div className="min-w-0 flex-1 space-y-6 p-5 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Lundi 12 octobre</p>
          <p className={`mt-1 ${PAGE_TITLE}`}>Bonjour {FIRST_NAME}</p>
          <p className="mt-2 text-[15px] text-muted sm:text-[17px]">
            Tu as <strong className="font-semibold text-ink">{todoCountLabel(todo.length)}</strong> pour faire avancer tes candidatures.
          </p>
        </div>
        <button
          type="button"
          onClick={onFeature}
          className="ui-focus flex w-full items-center rounded-full border border-line-strong bg-white py-1.5 pr-1.5 pl-5 text-left lg:max-w-[420px]"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-muted">Colle le lien d&apos;une offre</span>
          <span className="ui-btn-primary ml-2 shrink-0">Importer l&apos;offre</span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section style={{ animationDelay: "80ms" }} className="ui-card animate-demo-in p-5 sm:p-7">
            <p className={CARD_TITLE}>À faire aujourd&apos;hui</p>
            <ul className="mt-2">
              {todo.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line-soft py-4 first:border-t-0">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-box text-ink">
                    <IconBell className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-[15px] font-semibold text-ink">Relancer {app.company}</p>
                    <p className="text-[13px] text-muted">
                      {app.position} · Envoyée il y a {app.sentDaysAgo} jours
                    </p>
                  </div>
                  <button type="button" onClick={() => onOpen(app.id)} className="ui-btn-secondary w-full sm:w-auto">
                    Écrire la relance
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section style={{ animationDelay: "240ms" }} className="ui-card animate-demo-in p-5 sm:p-7">
            <p className={CARD_TITLE}>Ma semaine</p>
            <p className="mt-5 text-[44px] leading-none font-bold tracking-[-0.04em] text-ink">
              {sentThisWeek}
              <span className="ml-2 text-[15px] font-normal tracking-normal text-muted">
                envoyée{sentThisWeek > 1 ? "s" : ""} cette semaine
              </span>
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {tiles.map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-block bg-[#F8F8F8] px-3 py-3.5 sm:px-4">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 text-2xl font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section style={{ animationDelay: "160ms" }} className="ui-card animate-demo-in flex h-fit min-w-0 flex-col gap-4 p-5 sm:p-7">
          <p className={CARD_TITLE}>Ton CV</p>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <ScoreGauge score={HERO_EXAMPLE_SCORE} size="card" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">CV Product Manager</p>
              <p className="mt-1 text-[13px] text-muted">
                {HERO_EXAMPLE_SCORE >= READY_SCORE ? "Ton CV est prêt à postuler" : `Encore ${READY_SCORE - HERO_EXAMPLE_SCORE} points pour être prêt à postuler`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#F6F6F6] px-3.5 py-3">
            <p className="min-w-0 text-[13px] text-ink">
              Point faible : <strong className="font-semibold">{weakPoint}</strong>
            </p>
            <button type="button" onClick={onFeature} className="ui-btn-secondary">
              Améliorer
            </button>
          </div>
          <button type="button" onClick={onFeature} className="ui-btn-primary w-full">
            Continuer avec le coach
          </button>
        </section>
      </div>
    </div>
  );
}

/** Écran « Candidatures » de la démo : la liste, un clic ouvre la fiche. */
function DemoApplications({
  openId,
  onOpen,
  onCreate,
}: {
  openId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={PAGE_TITLE}>Candidatures</p>
          <p className="mt-2 text-sm text-muted">
            Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
          </p>
        </div>
        <button type="button" onClick={onCreate} className="ui-btn-primary">
          Nouvelle candidature
        </button>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] gap-4 border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted sm:grid">
          <span>Entreprise / poste</span>
          <span>Statut</span>
          <span>Envoi</span>
          <span>Dernier contact</span>
        </div>
        <ul>
          {APPLICATIONS.map((app, index) => (
            <li
              key={app.id}
              // Les lignes arrivent une à une.
              style={{ animationDelay: `${index * 110}ms` }}
              className="animate-demo-in border-b border-line-soft last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpen(app.id)}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] ${
                  openId === app.id ? "bg-pill" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-box text-sm font-bold text-ink">
                    {app.company[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{app.company}</span>
                    <span className="block truncate text-xs text-muted">
                      {app.position} · {app.location}
                    </span>
                  </span>
                </span>
                <span>
                  <StatusBadge status={app.status} />
                </span>
                <span className="hidden text-sm text-prose sm:block">{app.sentAt.replace(/ \d{4}$/, "")}</span>
                <span className="hidden text-sm text-muted sm:block">{app.lastContact}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">Clique sur une candidature pour voir sa fiche.</p>
    </div>
  );
}

export function DemoDashboard() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [openId, setOpenId] = useState<string | null>(null);
  // Dernière candidature ouverte : reste affichée pendant l'animation de fermeture.
  const [shownId, setShownId] = useState<string | null>(null);
  // Message « Inscris-toi » : texte selon le bouton cliqué ; id relance le minuteur à chaque clic.
  const [toast, setToast] = useState({ text: TOAST_CREATE, id: 0, visible: false });
  const open = APPLICATIONS.find((app) => app.id === openId) ?? null;
  const shown = APPLICATIONS.find((app) => app.id === shownId) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);

  function showToast(text: string) {
    setToast((current) => ({ text, id: current.id + 1, visible: true }));
  }

  function hideToast() {
    setToast((current) => ({ ...current, visible: false }));
  }

  /** Lien de navigation : change d'écran, ou message d'inscription (liens sans écran). */
  function navigate(target: Screen | null) {
    if (!target) {
      showToast(TOAST_FEATURE);
      return;
    }
    setOpenId(null);
    setScreen(target);
  }

  function openApplication(id: string) {
    setOpenId(id);
    setShownId(id);
  }

  // Panneau ouvert : Échap le ferme, le focus va sur la croix.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Message « Inscris-toi » : disparaît seul après quelques secondes.
  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(hideToast, 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.visible]);

  const navButton = (active: boolean) =>
    `ui-focus flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors lg:min-h-0 lg:py-2 ${
      active ? "bg-pill text-ink" : "text-nav hover:text-ink"
    }`;

  const navLinks = NAV.map((item) => (
    <button
      key={item.label}
      type="button"
      onClick={() => navigate(item.screen)}
      aria-current={item.screen === screen ? "page" : undefined}
      className={navButton(item.screen === screen)}
    >
      {item.label}
    </button>
  ));

  return (
    <div className="bg-white text-left text-ink">
      {/* Barre de fenêtre du navigateur, avec la mention « Exemple fictif » toujours visible. */}
      <div className="flex items-center gap-3 border-b border-line bg-box px-4 py-2.5">
        <div aria-hidden="true" className="hidden gap-1.5 sm:flex">
          <span className="h-3 w-3 rounded-full bg-line-strong" />
          <span className="h-3 w-3 rounded-full bg-line-strong" />
          <span className="h-3 w-3 rounded-full bg-line-strong" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full border border-line bg-white px-3 py-1 text-center text-xs text-muted sm:mx-auto sm:max-w-xs">
          {SCREEN_URLS[screen]}
        </div>
        <span className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Exemple fictif</span>
      </div>

      {/* Barre du haut de l'application. */}
      <div className="border-b border-line">
        <div className="flex h-[68px] items-center gap-3 px-4 sm:px-8">
          <BrandLogo />
          <nav aria-label="Navigation de la démo" className="ml-5 hidden items-center gap-0.5 lg:flex">
            {navLinks}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={() => showToast(TOAST_CREATE)} className="ui-btn-primary hidden lg:inline-flex">
              Nouvelle candidature
            </button>
            <button
              type="button"
              onClick={() => showToast(TOAST_FEATURE)}
              aria-label="Menu du compte"
              className="ui-focus flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white lg:h-[38px] lg:w-[38px]"
            >
              <IconUser className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Sur mobile : les mêmes liens, dans une ligne qui défile. */}
        <nav aria-label="Navigation de la démo, mobile" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
          {navLinks}
        </nav>
      </div>

      <div className="relative flex min-h-[560px] overflow-hidden">
        {screen === "offres" ? (
          <DemoOffers key="offres" onFeature={() => showToast(TOAST_FEATURE)} />
        ) : screen === "candidatures" ? (
          <DemoApplications
            key="candidatures"
            openId={openId}
            onOpen={openApplication}
            onCreate={() => showToast(TOAST_CREATE)}
          />
        ) : (
          <DemoHome key="dashboard" onFeature={() => showToast(TOAST_FEATURE)} onOpen={openApplication} />
        )}

        {/* Fiche candidature (panneau latéral) */}
        <div
          aria-hidden="true"
          onClick={() => setOpenId(null)}
          className={`absolute inset-0 bg-ink/20 transition-opacity duration-300 ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-label={shown ? `${shown.company} : ${shown.position}` : undefined}
          aria-hidden={!open}
          inert={!open}
          className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {shown && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-2">
                <span className="text-sm text-muted">Retour à la page</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Fermer"
                  className="ui-focus flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
                {/* En-tête : entreprise, statut, informations, changement de statut */}
                <section className="ui-card p-4">
                  <div className="flex flex-col gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-xl font-bold tracking-tight text-ink">{shown.company}</p>
                        <StatusBadge status={shown.status} />
                      </div>
                      <p className="mt-1 text-prose">
                        {shown.position}
                        <span className="text-muted"> · {shown.location}</span>
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-muted">Date d&apos;envoi</dt>
                          <dd className="mt-0.5 font-medium text-ink">{shown.sentAt}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Contact</dt>
                          <dd className="mt-0.5 font-medium text-ink">{shown.contact}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Annonce</dt>
                          <dd className="mt-0.5 font-medium text-accent">Voir l&apos;offre</dd>
                        </div>
                      </dl>
                    </div>
                    {/* Comme StatusChanger : menu déroulant + « Changer le statut ». */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="demo-status" className="text-sm font-medium text-ink">
                        Statut de la candidature
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <select
                          id="demo-status"
                          // Reste sur le statut actuel : la démo ne modifie rien.
                          value={shown.status}
                          onChange={() => showToast(TOAST_FEATURE)}
                          className="ui-input min-w-40 flex-1"
                        >
                          {APPLICATION_STATUSES.filter((s) => !RESPONSE_STATUSES.includes(s)).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                          <optgroup label="Réponse reçue">
                            {RESPONSE_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button type="button" onClick={() => showToast(TOAST_FEATURE)} className="ui-btn-primary">
                          Changer le statut
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="min-w-0 space-y-4 lg:col-span-2">
                    <PanelCard
                      title={
                        <span className="flex items-center gap-2">
                          <IconSparkles className="h-4 w-4 text-muted" />
                          Résumé de l&apos;offre
                        </span>
                      }
                    >
                      <ul className="list-disc space-y-1 pl-5 text-prose marker:text-muted">
                        {shown.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </PanelCard>

                    <PanelCard title="CV">
                      <p className="text-sm text-muted">{shown.keywordRate} % de correspondance avec l&apos;offre</p>
                      <div className="mt-3 space-y-3">
                        {shown.missingKeywords.map((category) => (
                          <div key={category.group}>
                            <p className="text-xs font-semibold text-muted">{category.group}</p>
                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                              {category.items.map((keyword) => (
                                <li key={keyword} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
                                  {keyword}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => showToast(TOAST_FEATURE)} className="ui-btn-primary">
                          Adapter mon CV à l&apos;offre
                        </button>
                      </div>
                    </PanelCard>

                    {/* Comme dans l'app : la lettre s'ouvre depuis l'éditeur, pas affichée ici. */}
                    <PanelCard title="Lettre de motivation">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => showToast(TOAST_FEATURE)} className="ui-btn-primary">
                          Ouvrir l&apos;éditeur de lettre
                        </button>
                        <button type="button" onClick={() => showToast(TOAST_FEATURE)} className="ui-btn-secondary">
                          Générer ma lettre de motivation
                        </button>
                      </div>
                    </PanelCard>

                    {/* Toutes les candidatures ; mise en avant quand une relance est due. */}
                    <PanelCard title="Relancer" className={shown.followUp ? "border-ink" : ""}>
                      <p className="text-muted">
                        {shown.followUp
                          ? "Pas de nouvelles depuis un moment : c'est le bon moment pour relancer."
                          : "Personnalise le message avant de l'envoyer."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => showToast(TOAST_FEATURE)} className="ui-btn-primary">
                          Envoyer une relance
                        </button>
                      </div>
                    </PanelCard>
                  </div>

                  <PanelCard title="Historique" className="h-fit">
                    <ol className="space-y-3">
                      {shown.events.map((event) => (
                        <li key={`${event.label}-${event.date}`} className="flex gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_DOTS[event.tone]}`}
                          />
                          <span>
                            <span className="block text-ink">{event.label}</span>
                            <span className="block text-xs text-muted">{event.date}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </PanelCard>
                </div>

                <section className="ui-card-soft p-4">
                  <p className="mb-2 font-semibold text-ink">Notes</p>
                  <p className="leading-relaxed text-prose">{shown.note}</p>
                </section>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Message au clic sur les boutons sans écran et sur ceux de la fiche */}
      <div
        role="status"
        aria-live="polite"
        inert={!toast.visible}
        className={`fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-block border border-line-strong bg-white py-1.5 pr-1.5 pl-4 text-sm text-ink transition duration-300 ${
          toast.visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {/* Contenu toujours présent : il reste visible pendant que le message s'efface. */}
        <Link href="/signup" className="ui-link inline-flex min-h-11 items-center underline-offset-4 hover:underline">
          {toast.text}
        </Link>
        <button
          type="button"
          onClick={hideToast}
          aria-label="Fermer le message"
          className="ui-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
