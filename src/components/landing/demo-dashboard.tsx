"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  IconBell,
  IconBriefcase,
  IconChat,
  IconClock,
  IconGrid,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUser,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  APPLICATION_STATUSES,
  RESPONSE_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/types";

// Dashboard Applyfy simulé (données fictives), en thème clair comme l'app, affiché sur la
// landing. Reprend la structure du vrai dashboard (sidebar, cartes de
// statistiques, liste des candidatures) et, dans le panneau de détail, celle de la fiche
// candidature (en-tête et statuts, résumé de l'offre, Adapter mon CV, Lettre de motivation,
// Relancer, Historique, Notes), avec les vrais statuts de l'app.

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
  lastContact: string;
  contact: string;
  summary: string[];
  matches: string[];
  missing: string[];
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
    lastContact: "Il y a 4 jours",
    contact: "Équipe recrutement",
    summary: [
      "Services Cloud à grande échelle, en Go et TypeScript",
      "5 ans d'expérience backend, culture de la revue de code",
      "CDI, hybride à Paris",
    ],
    matches: ["API à fort trafic (2 M requêtes/jour)", "TypeScript en production"],
    missing: ["Go : à mettre en avant", "Systèmes distribués"],
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
    lastContact: "Hier",
    contact: "Camille, hiring manager",
    summary: [
      "Roadmap des paiements en Europe",
      "Travail avec ingénierie, design et conformité",
      "Expérience produit B2B attendue",
    ],
    matches: ["Lancement d'un parcours de paiement", "Pilotage d'équipes pluridisciplinaires"],
    missing: ["Réglementation des paiements (DSP2)"],
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
    lastContact: "Il y a 2 jours",
    contact: "Thomas, Design Lead",
    summary: [
      "Parcours santé clairs et rassurants",
      "De la recherche utilisateur aux maquettes",
      "Figma et tests utilisateurs",
    ],
    matches: ["Recherche utilisateur", "Portfolio d'applications mobiles"],
    missing: ["Design system à grande échelle"],
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
    lastContact: "Il y a 9 jours",
    contact: "Équipe Data",
    summary: [
      "Analyse de l'usage de la plateforme par les praticiens",
      "Tableaux de bord produit : SQL, dbt, Looker",
      "Stage de 6 mois",
    ],
    matches: ["SQL et tableaux de bord", "Suivi d'indicateurs produit"],
    missing: ["dbt", "Looker"],
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
    lastContact: "Aujourd'hui",
    contact: "Équipe recrutement",
    summary: [
      "Application web de covoiturage en React et TypeScript",
      "Performance et accessibilité",
      "Télétravail possible",
    ],
    matches: ["React et TypeScript", "Accessibilité (RGAA)"],
    missing: ["Tests de bout en bout (Playwright)"],
    followUp: false,
    events: [
      { label: "Candidature envoyée", date: "12 oct.", tone: "blue" },
      { label: "Candidature créée", date: "12 oct.", tone: "slate" },
    ],
    note: "CV adapté à l'offre : React, accessibilité et performance mis en avant.",
  },
];

const EVENT_DOTS: Record<DemoEvent["tone"], string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  red: "bg-red-500",
};

/** Carte de la fiche candidature (classe « card » de l'app). */
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
    <section className={`card p-4 ${className}`}>
      <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

// Boutons de la fiche : mêmes classes que dans l'app.
const PRIMARY_BUTTON = "btn-primary px-4 py-2 text-sm";
const SECONDARY_BUTTON = "btn-secondary px-4 py-2 text-sm";

const TOAST_CREATE = "Inscris-toi pour créer ta première candidature →";
const TOAST_FEATURE = "Inscris-toi pour accéder à cette fonctionnalité →";

type Screen = "dashboard" | "offres";

// Navigation de la démo : « Tableau de bord » et « Trouver une offre » changent d'écran,
// les autres liens affichent le message d'inscription.
const NAV: { label: string; icon: typeof IconGrid; screen: Screen | null }[] = [
  { label: "Tableau de bord", icon: IconGrid, screen: "dashboard" },
  { label: "Trouver une offre", icon: IconSearch, screen: "offres" },
  { label: "Nouvelle candidature", icon: IconPlus, screen: null },
  { label: "Mon profil", icon: IconUser, screen: null },
];

const SCREEN_URLS: Record<Screen, string> = {
  dashboard: "applyfy.fr/dashboard",
  offres: "applyfy.fr/offres",
};

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

/** Faux champ de la recherche d'offres (style « input ») : un clic affiche le message. */
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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={onClick}
        className="input flex items-center gap-2 py-2.5 text-left text-slate-500"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        <span className="truncate">{value}</span>
        {!Icon && <span className="ml-auto text-slate-400">▾</span>}
      </button>
    </div>
  );
}

/** Écran « Trouver une offre » de la démo (calqué sur /offres). */
function DemoOffers({ onFeature }: { onFeature: () => void }) {
  return (
    <div className="min-w-0 flex-1 space-y-6 p-5 sm:p-7">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trouver une offre</h2>
        <p className="mt-1 text-sm text-slate-500">
          Trouve ton prochain job et ajoute-le en un clic à tes candidatures.
        </p>
      </div>

      <button
        type="button"
        onClick={onFeature}
        className="inline-flex items-center gap-3 text-sm font-medium text-slate-700"
      >
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-200">
          <span className="h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm" />
        </span>
        Recommandations personnalisées
      </button>

      <div role="search" className="card animate-demo-in space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FakeField
            label="Mot-clé"
            value="Product, data, business…"
            icon={IconSearch}
            onClick={onFeature}
          />
          <FakeField
            label="Localisation"
            value="Paris, Lille, Montpellier"
            icon={IconMapPin}
            onClick={onFeature}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FakeField label="Type de contrat" value="Tous les contrats" onClick={onFeature} />
          <FakeField label="Secteur" value="Tous les secteurs" onClick={onFeature} />
          <button type="button" onClick={onFeature} className="btn-primary px-6 py-2.5 text-sm">
            <IconSearch className="h-4 w-4" />
            Rechercher
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-900">{OFFERS.length} offres</strong>
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {OFFERS.map((offer, index) => (
            <li
              key={offer.id}
              style={{ animationDelay: `${150 + index * 110}ms` }}
              className="animate-demo-in"
            >
              <button
                type="button"
                onClick={onFeature}
                className="card block h-full w-full p-5 text-left transition hover:ring-1 hover:ring-blue-300"
              >
                <span className="block text-base leading-snug font-bold text-slate-900">
                  {offer.title}
                </span>
                <span className="mt-1 block text-sm font-medium text-slate-700">
                  {offer.company}
                </span>
                <span className="mt-3 flex items-end justify-between gap-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <IconMapPin className="h-3.5 w-3.5 text-slate-300" />
                      {offer.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock className="h-3.5 w-3.5 text-slate-300" />
                      {offer.published}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconBriefcase className="h-3.5 w-3.5 text-slate-300" />
                      {offer.contract}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#6B7280] ring-1 ring-slate-200">
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

  const stats = [
    {
      label: "Candidatures",
      value: APPLICATIONS.length,
      icon: IconBriefcase,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Entretiens",
      value: APPLICATIONS.filter((a) => a.status === "entretien").length,
      icon: IconChat,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Relances",
      value: APPLICATIONS.filter((a) => a.status === "relancee").length,
      icon: IconBell,
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-50 text-left text-slate-900">
      {/* Barre de fenêtre du navigateur */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto w-full max-w-xs rounded-md bg-white px-3 py-1 text-center text-xs text-slate-500 ring-1 ring-slate-200">
          {SCREEN_URLS[screen]}
        </div>
        <span aria-hidden="true" className="w-[52px]" />
      </div>

      <div className="relative flex min-h-[560px]">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 md:flex">
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <Image
              src="/images/applyfy-icon.png"
              alt=""
              width={512}
              height={512}
              className="h-7 w-7"
            />
            <span className="font-bold tracking-tight text-slate-900">Applyfy</span>
          </div>
          {NAV.map((item) => {
            const active = item.screen === screen;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.screen)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm whitespace-nowrap transition ${
                  active
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-slate-900" : "text-slate-400"}`} />
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Navigation compacte sur mobile (la sidebar est masquée) */}
          <nav
            aria-label="Navigation de la démo"
            className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
          >
            {NAV.map((item) => {
              const active = item.screen === screen;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.screen)}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-slate-100 text-slate-900" : "text-slate-600"
                  }`}
                >
                  <item.icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {screen === "offres" ? (
            <DemoOffers key="offres" onFeature={() => showToast(TOAST_FEATURE)} />
          ) : (
            <div key="dashboard" className="min-w-0 flex-1 space-y-6 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Mes candidatures
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(TOAST_CREATE)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  <IconPlus className="h-4 w-4" />
                  Nouvelle candidature
                </button>
              </div>

              <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                {stats.map((stat, index) => (
                  <div
                    key={stat.label}
                    style={{ animationDelay: `${index * 80}ms` }}
                    className="animate-demo-in card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <dt className="text-xs font-medium text-slate-500 sm:text-sm">
                        {stat.label}
                      </dt>
                      <span
                        className={`hidden h-8 w-8 items-center justify-center rounded-lg sm:flex ${stat.tone}`}
                      >
                        <stat.icon className="h-4 w-4" />
                      </span>
                    </div>
                    <dd className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="card overflow-hidden">
                <div className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
                  <span>Entreprise / poste</span>
                  <span>Statut</span>
                  <span>Envoi</span>
                  <span>Dernier contact</span>
                </div>
                <ul>
                  {APPLICATIONS.map((app, index) => (
                    <li
                      key={app.id}
                      // Les lignes arrivent une à une après les statistiques.
                      style={{ animationDelay: `${300 + index * 110}ms` }}
                      className="animate-demo-in border-b border-slate-100 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => openApplication(app.id)}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] ${
                          openId === app.id ? "bg-slate-100" : ""
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                            {app.company[0]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {app.company}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {app.position} · {app.location}
                            </span>
                          </span>
                        </span>
                        <span>
                          <StatusBadge status={app.status} />
                        </span>
                        <span className="hidden text-sm text-slate-700 sm:block">
                          {app.sentAt.replace(/ \d{4}$/, "")}
                        </span>
                        <span className="hidden text-sm text-slate-600 sm:block">
                          {app.lastContact}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-500">
                Clique sur une candidature pour voir sa fiche.
              </p>
            </div>
          )}
        </div>

        {/* Fiche candidature (panneau latéral) */}
        <div
          aria-hidden="true"
          onClick={() => setOpenId(null)}
          className={`absolute inset-0 bg-slate-900/20 transition-opacity duration-300 ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-label={shown ? `${shown.company} — ${shown.position}` : undefined}
          aria-hidden={!open}
          inert={!open}
          className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {shown && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
                <span className="text-sm text-slate-500">← Retour au dashboard</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Fermer"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
                {/* En-tête : entreprise, statut, informations, changement de statut */}
                <section className="card p-4">
                  {/* Empilé, comme la fiche sous la largeur lg (le panneau est plus étroit). */}
                  <div className="flex flex-col gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-xl font-bold tracking-tight text-slate-900">
                          {shown.company}
                        </p>
                        <StatusBadge status={shown.status} />
                      </div>
                      <p className="mt-1 text-slate-600">
                        {shown.position}
                        <span className="text-slate-400"> · {shown.location}</span>
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-slate-500">Date d&apos;envoi</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">{shown.sentAt}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Contact</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">{shown.contact}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Annonce</dt>
                          <dd className="mt-0.5 font-medium text-blue-600">Voir l&apos;offre ↗</dd>
                        </div>
                      </dl>
                    </div>
                    {/* Comme StatusChanger : menu déroulant + « Changer le statut ». */}
                    <div className="flex flex-col gap-2">
                      <label htmlFor="demo-status" className="text-sm font-medium text-slate-700">
                        Statut de la candidature
                      </label>
                      <div className="flex gap-2">
                        <select
                          id="demo-status"
                          // Reste sur le statut actuel : la démo ne modifie rien.
                          value={shown.status}
                          onChange={() => showToast(TOAST_FEATURE)}
                          className="input min-w-0 flex-1 py-2"
                        >
                          {APPLICATION_STATUSES.filter((s) => !RESPONSE_STATUSES.includes(s)).map(
                            (status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ),
                          )}
                          <optgroup label="Réponse reçue">
                            {RESPONSE_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={PRIMARY_BUTTON}
                        >
                          Changer le statut
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    <PanelCard
                      title={
                        <span className="flex items-center gap-2">
                          <IconSparkles className="h-4 w-4 text-slate-500" />
                          Résumé de l&apos;offre
                        </span>
                      }
                    >
                      <ul className="list-disc space-y-1 pl-5 text-slate-700 marker:text-slate-400">
                        {shown.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </PanelCard>

                    <PanelCard title="Adapter mon CV">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-emerald-700">Ce qui matche</p>
                          <ul className="mt-1.5 space-y-1 text-slate-700">
                            {shown.matches.map((item) => (
                              <li key={item}>✓ {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Ce qui manque</p>
                          <ul className="mt-1.5 space-y-1 text-slate-700">
                            {shown.missing.map((item) => (
                              <li key={item}>+ {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={PRIMARY_BUTTON}
                        >
                          Ouvrir l&apos;éditeur de CV
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={SECONDARY_BUTTON}
                        >
                          Analyser mon CV
                        </button>
                      </div>
                    </PanelCard>

                    {/* Comme dans l'app : la lettre s'ouvre depuis l'éditeur, pas affichée ici. */}
                    <PanelCard title="Lettre de motivation">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={PRIMARY_BUTTON}
                        >
                          Ouvrir l&apos;éditeur de lettre
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={SECONDARY_BUTTON}
                        >
                          Générer ma lettre de motivation
                        </button>
                      </div>
                    </PanelCard>

                    {/* Toutes les candidatures ; mise en avant quand une relance est due. */}
                    <PanelCard
                      title="Relancer"
                      className={shown.followUp ? "border-amber-300 ring-1 ring-amber-200" : ""}
                    >
                      <p className="text-slate-500">
                        {shown.followUp
                          ? "Pas de nouvelles depuis un moment : c'est le bon moment pour relancer."
                          : "Personnalise le message avant de l'envoyer."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => showToast(TOAST_FEATURE)}
                          className={PRIMARY_BUTTON}
                        >
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
                            <span className="block text-slate-800">{event.label}</span>
                            <span className="block text-xs text-slate-500">{event.date}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </PanelCard>
                </div>

                <section className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 shadow-sm">
                  <h3 className="mb-2 font-semibold text-slate-900">Notes</h3>
                  <p className="leading-relaxed text-slate-700">{shown.note}</p>
                </section>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Message au clic sur « Nouvelle candidature » et sur les boutons de la fiche */}
      <div
        role="status"
        aria-live="polite"
        inert={!toast.visible}
        className={`fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-xl shadow-slate-900/10 transition duration-300 ${
          toast.visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {/* Contenu toujours présent : il reste visible pendant que le message s'efface. */}
        <>
          <Link
            href="/login"
            className="font-semibold text-blue-600 underline-offset-4 hover:underline"
          >
            {toast.text}
          </Link>
          <button
            type="button"
            onClick={hideToast}
            aria-label="Fermer le message"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        </>
      </div>
    </div>
  );
}
