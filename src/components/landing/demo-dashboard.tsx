"use client";

import Image from "next/image";
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
// statistiques, liste des candidatures) et les vrais statuts de l'app.

type DemoApplication = {
  id: string;
  company: string;
  position: string;
  location: string;
  status: ApplicationStatus;
  sentAt: string;
  lastContact: string;
  description: string;
  letter: string;
  note: string;
};

const APPLICATIONS: DemoApplication[] = [
  {
    id: "google",
    company: "Google",
    position: "Développeur Senior",
    location: "Paris",
    status: "en_attente",
    sentAt: "8 oct.",
    lastContact: "Il y a 4 jours",
    description:
      "Concevoir et faire évoluer des services à grande échelle au sein de l'équipe Cloud. Stack Go et TypeScript, revues de code exigeantes, forte culture de la qualité.",
    letter:
      "Votre équipe Cloud construit des outils utilisés par des millions de développeurs : c'est précisément ce type d'impact que je recherche. En cinq ans chez Qonto, j'ai conçu une API de paiement traitant plus de 2 millions de requêtes par jour…",
    note: "Référé par Julien (promo 2019). Relancer le 18 oct. si pas de réponse.",
  },
  {
    id: "stripe",
    company: "Stripe",
    position: "Product Manager",
    location: "Paris · Hybride",
    status: "entretien",
    sentAt: "2 oct.",
    lastContact: "Hier",
    description:
      "Piloter la roadmap des paiements en Europe, en lien avec les équipes ingénierie, design et conformité. Expérience B2B et goût pour les produits techniques.",
    letter:
      "Ce qui me motive chez Stripe, c'est votre manière de rendre simples des problèmes très complexes. Chez Alan, j'ai mené le lancement d'un parcours de remboursement qui a réduit les délais de 40 %…",
    note: "Entretien avec la hiring manager mardi 14 h. Préparer un cas produit sur les paiements récurrents.",
  },
  {
    id: "alan",
    company: "Alan",
    position: "UX Designer",
    location: "Paris",
    status: "relancee",
    sentAt: "26 sept.",
    lastContact: "Il y a 2 jours",
    description:
      "Imaginer des parcours santé clairs et rassurants pour les membres Alan, de la recherche utilisateur jusqu'aux maquettes haute fidélité.",
    letter:
      "Votre application est la preuve qu'une assurance santé peut être agréable à utiliser. Je souhaite mettre mes compétences en recherche utilisateur au service de vos membres…",
    note: "Relance envoyée par email. Portfolio mis à jour avec le projet de fin d'études.",
  },
  {
    id: "doctolib",
    company: "Doctolib",
    position: "Data Analyst",
    location: "Levallois-Perret",
    status: "refusee",
    sentAt: "19 sept.",
    lastContact: "Il y a 9 jours",
    description:
      "Analyser l'usage de la plateforme par les praticiens et construire les tableaux de bord des équipes produit (SQL, dbt, Looker).",
    letter:
      "Améliorer l'accès aux soins grâce à la donnée : c'est ce qui m'attire chez Doctolib. Lors de mon stage chez Back Market, j'ai automatisé le suivi de 30 indicateurs produit…",
    note: "Refus après le test technique. Retour demandé pour progresser en SQL avancé.",
  },
  {
    id: "blablacar",
    company: "BlaBlaCar",
    position: "Frontend Engineer",
    location: "Paris · Télétravail",
    status: "envoyee",
    sentAt: "Aujourd'hui",
    lastContact: "Aujourd'hui",
    description:
      "Développer l'application web de covoiturage en React et TypeScript, avec une attention particulière à la performance et à l'accessibilité.",
    letter:
      "Utilisateur de BlaBlaCar depuis mes études, je mesure chaque semaine l'importance d'une interface fluide. Je souhaite contribuer à votre application web…",
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
  const open = APPLICATIONS.find((app) => app.id === openId) ?? null;
  const shown = APPLICATIONS.find((app) => app.id === shownId) ?? null;

  function openApplication(id: string) {
    setOpenId(id);
    setShownId(id);
  }
  const closeRef = useRef<HTMLButtonElement>(null);

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

  const stats = [
    {
      label: "Candidatures",
      value: APPLICATIONS.length,
      icon: IconBriefcase,
      tone: "bg-blue-500/15 text-blue-300",
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
                item.active ? "bg-blue-500/15 font-medium text-blue-200" : "text-slate-400"
              }`}
            >
              <item.icon
                className={`h-4 w-4 ${item.active ? "text-blue-300" : "text-slate-500"}`}
              />
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
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/40">
              <IconPlus className="h-4 w-4" />
              Nouvelle candidature
            </span>
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
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_6rem_7rem] gap-4 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
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
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem] ${
                      openId === app.id ? "bg-white/[0.05]" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-sm font-bold text-blue-200">
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
                    <span className="hidden text-sm text-slate-300 sm:block">{app.sentAt}</span>
                    <span className="hidden text-sm text-slate-400 sm:block">
                      {app.lastContact}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500">Clique sur une candidature pour voir son détail.</p>
        </div>

        {/* Panneau latéral de détail */}
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
          className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-slate-900 shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {shown && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 font-bold text-blue-200">
                    {shown.company[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{shown.company}</p>
                    <p className="truncate text-sm text-slate-400">{shown.position}</p>
                  </div>
                </div>
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
              <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <DemoStatusBadge status={shown.status} />
                  <span>{shown.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>Envoyée : {shown.sentAt}</span>
                </div>
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Le poste
                  </h3>
                  <p className="mt-2 leading-relaxed text-slate-300">{shown.description}</p>
                </section>
                <section>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <IconSparkles className="h-3.5 w-3.5 text-blue-300" />
                    Lettre de motivation · générée avec l&apos;IA
                  </h3>
                  <blockquote className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 leading-relaxed text-slate-300">
                    {shown.letter}
                  </blockquote>
                </section>
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Ma note
                  </h3>
                  <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 leading-relaxed text-amber-100">
                    {shown.note}
                  </p>
                </section>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
