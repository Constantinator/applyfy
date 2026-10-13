"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  IconBell,
  IconBriefcase,
  IconChat,
  IconGrid,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUser,
} from "@/components/icons";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

// Dashboard Applyfy simulé (données fictives), en thème sombre : destiné à remplacer la
// capture d'écran de la landing. Reprend la structure du vrai dashboard (sidebar, cartes de
// statistiques, liste des candidatures) et, dans le panneau de détail, celle de la fiche
// candidature (en-tête, résumé de l'offre, Adapter mon CV, Lettre de motivation, Relancer,
// Historique, Notes), avec les vrais statuts de l'app.

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
  letter: string;
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
    letter:
      "Votre équipe Cloud construit des outils utilisés par des millions de développeurs : c'est précisément ce type d'impact que je recherche. En cinq ans, j'ai conçu une API de paiement traitant plus de 2 millions de requêtes par jour…",
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
    letter:
      "Ce qui me motive chez Stripe, c'est votre manière de rendre simples des problèmes très complexes. J'ai mené le lancement d'un parcours de remboursement qui a réduit les délais de 40 %…",
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
    letter:
      "Votre application est la preuve qu'une assurance santé peut être agréable à utiliser. Je souhaite mettre mes compétences en recherche utilisateur au service de vos membres…",
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
    letter:
      "Améliorer l'accès aux soins grâce à la donnée : c'est ce qui m'attire chez Doctolib. Lors de mon dernier stage, j'ai automatisé le suivi de 30 indicateurs produit…",
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
    letter:
      "Utilisateur de BlaBlaCar depuis mes études, je mesure chaque semaine l'importance d'une interface fluide. Je souhaite contribuer à votre application web…",
    followUp: false,
    events: [
      { label: "Candidature envoyée", date: "12 oct.", tone: "blue" },
      { label: "Candidature créée", date: "12 oct.", tone: "slate" },
    ],
    note: "CV adapté à l'offre : React, accessibilité et performance mis en avant.",
  },
];

/** Badges de statut, déclinés pour le thème sombre (mêmes teintes que l'app). */
const STATUS_STYLES: Record<ApplicationStatus, { badge: string; dot: string }> = {
  brouillon: { badge: "bg-slate-500/15 text-slate-300 ring-slate-500/30", dot: "bg-slate-400" },
  envoyee: { badge: "bg-blue-500/15 text-blue-300 ring-blue-400/30", dot: "bg-blue-400" },
  en_attente: {
    badge: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
    dot: "bg-indigo-400",
  },
  relancee: { badge: "bg-amber-500/15 text-amber-300 ring-amber-400/30", dot: "bg-amber-400" },
  entretien: { badge: "bg-violet-500/15 text-violet-300 ring-violet-400/30", dot: "bg-violet-400" },
  offre: { badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400" },
  refusee: { badge: "bg-red-500/15 text-red-300 ring-red-400/30", dot: "bg-red-400" },
};

const EVENT_DOTS: Record<DemoEvent["tone"], string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  red: "bg-red-400",
};

function DemoStatusBadge({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Carte de la fiche candidature (équivalent sombre de la classe « card »). */
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
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      <h3 className="mb-3 font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

const NAV = [
  { label: "Tableau de bord", icon: IconGrid, active: true },
  { label: "Trouver une offre", icon: IconSearch, active: false },
  { label: "Nouvelle candidature", icon: IconPlus, active: false },
  { label: "Mon profil", icon: IconUser, active: false },
];

export function DemoDashboard() {
  const [openId, setOpenId] = useState<string | null>(null);
  // Dernière candidature ouverte : reste affichée pendant l'animation de fermeture.
  const [shownId, setShownId] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const open = APPLICATIONS.find((app) => app.id === openId) ?? null;
  const shown = APPLICATIONS.find((app) => app.id === shownId) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);

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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = [
    {
      label: "Candidatures",
      value: APPLICATIONS.length,
      icon: IconBriefcase,
      tone: "bg-white/10 text-slate-200",
    },
    {
      label: "Entretiens",
      value: APPLICATIONS.filter((a) => a.status === "entretien").length,
      icon: IconChat,
      tone: "bg-violet-500/15 text-violet-300",
    },
    {
      label: "Relances",
      value: APPLICATIONS.filter((a) => a.status === "relancee").length,
      icon: IconBell,
      tone: "bg-amber-500/15 text-amber-300",
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-950 text-left text-slate-100 ring-1 ring-white/10">
      {/* Barre de fenêtre du navigateur */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-2.5">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        </div>
        <div className="mx-auto w-full max-w-xs rounded-md bg-white/5 px-3 py-1 text-center text-xs text-slate-400">
          applyfy.fr/dashboard
        </div>
        <span aria-hidden="true" className="w-[52px]" />
      </div>

      <div className="relative flex min-h-[560px]">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-white/10 bg-slate-900/40 p-3 md:flex">
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <Image
              src="/images/applyfy-icon.png"
              alt=""
              width={512}
              height={512}
              className="h-7 w-7"
            />
            <span className="font-bold tracking-tight text-white">Applyfy</span>
          </div>
          {NAV.map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm whitespace-nowrap ${
                item.active ? "bg-white/10 font-medium text-white" : "text-slate-400"
              }`}
            >
              <item.icon className={`h-4 w-4 ${item.active ? "text-white" : "text-slate-500"}`} />
              {item.label}
            </span>
          ))}
        </aside>

        {/* Contenu principal */}
        <div className="min-w-0 flex-1 space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Mes candidatures</h2>
              <p className="mt-1 text-sm text-slate-400">
                Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-700"
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
                className="animate-demo-in rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-medium text-slate-400 sm:text-sm">{stat.label}</dt>
                  <span
                    className={`hidden h-8 w-8 items-center justify-center rounded-lg sm:flex ${stat.tone}`}
                  >
                    <stat.icon className="h-4 w-4" />
                  </span>
                </div>
                <dd className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] gap-4 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
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
                  className="animate-demo-in border-b border-white/5 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => openApplication(app.id)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_8rem_7rem_7rem] ${
                      openId === app.id ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-slate-200">
                        {app.company[0]}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {app.company}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {app.position} · {app.location}
                        </span>
                      </span>
                    </span>
                    <span>
                      <DemoStatusBadge status={app.status} />
                    </span>
                    <span className="hidden text-sm text-slate-300 sm:block">
                      {app.sentAt.replace(/ \d{4}$/, "")}
                    </span>
                    <span className="hidden text-sm text-slate-400 sm:block">
                      {app.lastContact}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500">Clique sur une candidature pour voir sa fiche.</p>
        </div>

        {/* Fiche candidature (panneau latéral) */}
        <div
          aria-hidden="true"
          onClick={() => setOpenId(null)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-label={shown ? `${shown.company} — ${shown.position}` : undefined}
          aria-hidden={!open}
          inert={!open}
          className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/10 bg-slate-900 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {shown && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                <span className="text-sm text-slate-400">← Retour au dashboard</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Fermer"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
                {/* En-tête : entreprise, statut, informations, changement de statut */}
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-xl font-bold tracking-tight text-white">
                          {shown.company}
                        </p>
                        <DemoStatusBadge status={shown.status} />
                      </div>
                      <p className="mt-1 text-slate-300">
                        {shown.position}
                        <span className="text-slate-500"> · {shown.location}</span>
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-slate-500">Date d&apos;envoi</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">{shown.sentAt}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Contact</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">{shown.contact}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Annonce</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">Voir l&apos;offre ↗</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="sm:w-44 sm:shrink-0">
                      <p className="text-xs font-medium text-slate-400">Statut de la candidature</p>
                      <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                        {STATUS_LABELS[shown.status]} ▾
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    <PanelCard
                      title={
                        <span className="flex items-center gap-2">
                          <IconSparkles className="h-4 w-4 text-slate-300" />
                          Résumé de l&apos;offre
                        </span>
                      }
                    >
                      <ul className="list-disc space-y-1 pl-5 text-slate-300 marker:text-slate-500">
                        {shown.summary.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </PanelCard>

                    <PanelCard title="Adapter mon CV">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-emerald-300">Ce qui matche</p>
                          <ul className="mt-1.5 space-y-1 text-slate-300">
                            {shown.matches.map((item) => (
                              <li key={item}>✓ {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-amber-300">Ce qui manque</p>
                          <ul className="mt-1.5 space-y-1 text-slate-300">
                            {shown.missing.map((item) => (
                              <li key={item}>+ {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </PanelCard>

                    <PanelCard title="Lettre de motivation">
                      <p className="text-xs text-slate-500">
                        Générée avec l&apos;IA, puis personnalisée.
                      </p>
                      <blockquote className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 leading-relaxed text-slate-300">
                        {shown.letter}
                      </blockquote>
                    </PanelCard>

                    {shown.followUp && (
                      <PanelCard title="Relancer" className="border-amber-400/30">
                        <p className="text-slate-400">
                          Pas de nouvelles depuis un moment : c&apos;est le bon moment pour
                          relancer.
                        </p>
                      </PanelCard>
                    )}
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
                            <span className="block text-slate-200">{event.label}</span>
                            <span className="block text-xs text-slate-500">{event.date}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </PanelCard>
                </div>

                <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                  <h3 className="mb-2 font-semibold text-white">Notes</h3>
                  <p className="leading-relaxed text-amber-100">{shown.note}</p>
                </section>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Message au clic sur « Nouvelle candidature » */}
      <div
        role="status"
        aria-live="polite"
        inert={!toast}
        className={`fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-2xl transition duration-300 ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {/* Contenu toujours présent : il reste visible pendant que le message s'efface. */}
        <>
          <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
            Inscris-toi pour créer ta première candidature →
          </Link>
          <button
            type="button"
            onClick={() => setToast(false)}
            aria-label="Fermer le message"
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </>
      </div>
    </div>
  );
}
