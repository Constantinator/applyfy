"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { IconBell, IconSparkles } from "@/components/icons";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { ONBOARDING_OPEN_ATTRIBUTE, notifyOnboardingChange } from "@/lib/onboarding-tips";

const STORAGE_KEY = "applyfy_onboarding_done";

function isOnboardingDone() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // stockage indisponible (navigation privée stricte…) : pas de modal
  }
}

// Rien à écouter : la valeur ne change que via finish(), qui ferme aussi le modal.
const subscribeNothing = () => () => {};

/** Largeur d'un texte « tapé » lettre par lettre (police mono : 1 caractère = 1ch). */
const typed = (text: string) => ({ "--n": `${text.length}ch` }) as React.CSSProperties;

/*
 * Animations des cartes, en CSS pur. Le style de base de chaque élément est l'état final
 * de l'animation : avec « réduire les animations », la carte s'affiche simplement terminée.
 */
const ANIMATIONS_CSS = `
@keyframes oa-pop { from { opacity: 0; transform: scale(.6) } 60% { opacity: 1; transform: scale(1.08) } to { opacity: 1; transform: none } }
@keyframes oa-rise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes oa-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }

/* Carte 2 — formulaire rempli automatiquement (cycle de 7 s) */
@keyframes oa-type-1 { 0%, 3% { width: 0 } 15%, 88% { width: var(--n) } 95%, 100% { width: 0 } }
@keyframes oa-type-2 { 0%, 18% { width: 0 } 36%, 88% { width: var(--n) } 95%, 100% { width: 0 } }
@keyframes oa-type-3 { 0%, 39% { width: 0 } 50%, 88% { width: var(--n) } 95%, 100% { width: 0 } }
@keyframes oa-caret-1 { 0%, 16% { opacity: 1 } 17%, 100% { opacity: 0 } }
@keyframes oa-caret-2 { 0%, 17% { opacity: 0 } 18%, 37% { opacity: 1 } 38%, 100% { opacity: 0 } }
@keyframes oa-caret-3 { 0%, 38% { opacity: 0 } 39%, 52% { opacity: 1 } 53%, 100% { opacity: 0 } }
@keyframes oa-add-btn {
  0%, 52%, 64%, 76%, 100% { transform: none; box-shadow: 0 0 0 0 rgb(37 99 235 / 0) }
  58%, 68% { transform: scale(1.06); box-shadow: 0 0 0 6px rgb(37 99 235 / .25) }
  72% { transform: scale(.92); box-shadow: 0 0 0 0 rgb(37 99 235 / 0) }
}
@keyframes oa-add-done { 0%, 74% { opacity: 0 } 76%, 90% { opacity: 1 } 92%, 100% { opacity: 0 } }

/* Carte 3 — document réécrit par l'IA (cycle de 6 s) */
@keyframes oa-ai-btn {
  0%, 17%, 30%, 36%, 100% { transform: none; box-shadow: 0 0 0 0 rgb(79 70 229 / 0) }
  10%, 24% { transform: scale(1.05); box-shadow: 0 0 0 6px rgb(79 70 229 / .2) }
  33% { transform: scale(.93) }
}
@keyframes oa-rewrite { 0%, 38% { transform: scaleX(0) } 52%, 90% { transform: scaleX(1) } 97%, 100% { transform: scaleX(0) } }
@keyframes oa-shimmer {
  0%, 36% { opacity: 0; transform: translateX(-120%) skewX(-20deg) }
  38% { opacity: 1; transform: translateX(-120%) skewX(-20deg) }
  60% { opacity: 1; transform: translateX(320%) skewX(-20deg) }
  61%, 100% { opacity: 0; transform: translateX(320%) skewX(-20deg) }
}
@keyframes oa-fade-pop { 0%, 54% { opacity: 0; transform: translateY(4px) } 58%, 90% { opacity: 1; transform: none } 95%, 100% { opacity: 0 } }

/* Carte 4 — statut qui avance (cycle de 9 s, un tiers par statut) */
@keyframes oa-status { 0% { opacity: 0; transform: translateY(6px) } 3%, 30% { opacity: 1; transform: none } 34%, 100% { opacity: 0; transform: translateY(-6px) } }
@keyframes oa-progress { 0%, 30% { width: 0 } 36%, 63% { width: 50% } 69%, 96% { width: 100% } 100% { width: 0 } }

/* Carte 5 — notification de relance (cycle de 6 s) */
@keyframes oa-notif {
  0%, 8% { opacity: 0; transform: translateX(120%) }
  18%, 85% { opacity: 1; transform: none }
  95%, 100% { opacity: 0; transform: translateX(120%) }
}
@keyframes oa-ring { 0%, 18%, 33%, 100% { transform: rotate(0) } 21% { transform: rotate(16deg) } 24% { transform: rotate(-14deg) } 27% { transform: rotate(10deg) } 30% { transform: rotate(-6deg) } }

@media (prefers-reduced-motion: reduce) {
  .oa-scene, .oa-scene * { animation: none !important; }
}
`;

/** Champ de faux formulaire dont la valeur se tape toute seule. */
function TypedField({ label, value, index }: { label: string; value: string; index: 1 | 2 | 3 }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-0.5 flex h-7 items-center rounded-md bg-white px-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700">
        <span
          className="overflow-hidden whitespace-nowrap"
          style={{ ...typed(value), animation: `oa-type-${index} 7s steps(${value.length}) infinite` }}
        >
          {value}
        </span>
        <span className="opacity-0" style={{ animation: `oa-caret-${index} 7s linear infinite` }}>
          <span className="block h-4 w-px bg-blue-600" style={{ animation: "oa-blink .8s linear infinite" }} />
        </span>
      </div>
    </div>
  );
}

function WelcomeScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span style={{ animation: "oa-pop .6s cubic-bezier(.22,1,.36,1) both" }}>
        <Logo size="lg" />
      </span>
      <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        <span className="block" style={{ animation: "oa-rise .5s ease-out .5s both" }}>
          Toutes tes candidatures.
        </span>
        <span className="text-brand block dark:text-blue-400" style={{ animation: "oa-rise .5s ease-out 1.1s both" }}>
          Un seul endroit.
        </span>
      </p>
    </div>
  );
}

function AddApplicationScene() {
  return (
    <div className="flex h-full items-center justify-center p-5">
      <div className="w-full max-w-xs space-y-2 rounded-xl bg-slate-50/80 p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700">
        <div className="grid grid-cols-2 gap-2">
          <TypedField label="Entreprise" value="Spotify" index={1} />
          <TypedField label="Poste" value="Product Designer" index={2} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TypedField label="Date d'envoi" value="14/10/2026" index={3} />
          </div>
          <span
            className="bg-brand relative inline-flex h-7 items-center rounded-md px-3 text-xs font-semibold text-white"
            style={{ animation: "oa-add-btn 7s ease-in-out infinite" }}
          >
            Ajouter
            <span
              className="absolute inset-0 inline-flex items-center justify-center rounded-md bg-emerald-600 opacity-0"
              style={{ animation: "oa-add-done 7s linear infinite" }}
            >
              ✓ Ajoutée
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

const DOCUMENT_LINES = ["92%", "78%", "86%", "64%", "82%"];

function AdaptDocumentScene() {
  return (
    <div className="flex h-full items-center justify-center p-5">
      <div className="relative w-full max-w-xs overflow-hidden rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex items-center justify-between gap-2">
          <span className="h-2.5 w-20 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white"
            style={{ animation: "oa-ai-btn 6s ease-in-out infinite" }}
          >
            <IconSparkles className="h-3 w-3" />
            Adapter avec l&apos;IA
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {DOCUMENT_LINES.map((width, i) => (
            <div key={i} className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-700" style={{ width }}>
              <div
                className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-blue-500 to-indigo-500"
                style={{ animation: `oa-rewrite 6s ease-out ${i * 0.12}s infinite both` }}
              />
            </div>
          ))}
        </div>
        <span
          className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30"
          style={{ animation: "oa-fade-pop 6s ease-out infinite" }}
        >
          ✓ Adapté à l&apos;offre
        </span>
        {/* Reflet qui balaie le document pendant la réécriture. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/70 to-transparent opacity-0 dark:via-white/15"
          style={{ animation: "oa-shimmer 6s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}

const STATUS_STEPS = [
  { status: "envoyee", label: "Envoyée" },
  { status: "relancee", label: "Relancée" },
  { status: "entretien", label: "Entretien" },
] as const;

function StatusScene() {
  return (
    <div className="flex h-full items-center justify-center p-5">
      <div className="w-full max-w-xs space-y-4 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
            S
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">Spotify</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Product Designer</span>
          </span>
          {/* Les trois badges sont superposés ; un seul est visible à la fois. */}
          <span className="grid justify-items-end">
            {STATUS_STEPS.map(({ status }, i) => (
              <span
                key={status}
                className={`col-start-1 row-start-1 ${i < STATUS_STEPS.length - 1 ? "opacity-0" : ""}`}
                style={{ animation: `oa-status 9s ease-in-out ${i * 3}s infinite both` }}
              >
                <StatusBadge status={status} />
              </span>
            ))}
          </span>
        </div>
        <div>
          <div className="relative mx-2 h-1 rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="bg-brand absolute inset-y-0 left-0 w-full rounded-full"
              style={{ animation: "oa-progress 9s ease-in-out infinite" }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {STATUS_STEPS.map(({ label }) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowUpScene() {
  return (
    <div className="relative h-full p-5">
      {/* Faux tableau de bord en arrière-plan. */}
      <div className="space-y-2 opacity-60">
        {[70, 55, 62].map((width) => (
          <div
            key={width}
            className="flex items-center gap-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            <span className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-2 rounded-full bg-slate-200 dark:bg-slate-700" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
      <div
        className="absolute top-4 right-4 left-12 flex items-start gap-3 rounded-xl bg-white p-3 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 sm:left-auto sm:w-72 dark:bg-slate-800 dark:ring-slate-700"
        style={{ animation: "oa-notif 6s cubic-bezier(.22,1,.36,1) infinite" }}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
          <span className="origin-top" style={{ animation: "oa-ring 6s ease-in-out infinite" }}>
            <IconBell className="h-4.5 w-4.5" />
          </span>
          <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">
            Il est temps de relancer Spotify !
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            Pas de réponse depuis 7 jours
          </span>
        </span>
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: "Bienvenue sur Applyfy",
    description:
      "Applyfy t'aide à organiser ta recherche, adapter tes candidatures et ne jamais oublier de relancer.",
    Scene: WelcomeScene,
  },
  {
    title: "Ajoute une candidature",
    description:
      "Colle l'URL de l'offre et Applyfy extrait automatiquement l'entreprise, le poste et les infos clés. En 10 secondes.",
    Scene: AddApplicationScene,
  },
  {
    title: "CV & Lettre de motivation",
    description: "Analyse ton CV et ta lettre, modifie-les toi-même ou laisse l'IA les adapter à l'offre.",
    Scene: AdaptDocumentScene,
  },
  {
    title: "Suivi d'avancement",
    description: "Change le statut à chaque étape. Visualise où tu en es d'un coup d'œil.",
    Scene: StatusScene,
  },
  {
    title: "Système de relance",
    description: "Applyfy te prévient quand il est temps de relancer. Ne laisse plus passer une opportunité.",
    Scene: FollowUpScene,
  },
];

/** Présentation en 5 cartes animées, affichée une seule fois (mémoire dans le navigateur). */
export function OnboardingModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Côté serveur : jamais de modal (la mémoire est dans le navigateur).
  const done = useSyncExternalStore(subscribeNothing, isOnboardingDone, () => true);
  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0);
  const open = !done && !closed;

  // Fenêtre modale native : focus piégé, Échap, arrière-plan inerte.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Stockage indisponible : le modal est simplement fermé pour cette page.
    }
    dialogRef.current?.close();
    setClosed(true);
    // Fermé : les bulles d'aide peuvent apparaître.
    notifyOnboardingChange();
  }

  if (!open) return null;

  const isLast = index === CARDS.length - 1;
  const { title, description, Scene } = CARDS[index];
  const goTo = (next: number) => setIndex(Math.min(Math.max(next, 0), CARDS.length - 1));

  return (
    <dialog
      ref={dialogRef}
      {...{ [ONBOARDING_OPEN_ATTRIBUTE]: "" }}
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(index + 1);
        if (e.key === "ArrowLeft") goTo(index - 1);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-slate-900"
    >
      <style>{ANIMATIONS_CSS}</style>

      <div className="relative p-5 sm:p-6">
        <button
          type="button"
          onClick={finish}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* key : l'animation repart du début à chaque changement de carte. */}
        <div
          key={index}
          aria-hidden="true"
          className="oa-scene h-48 overflow-hidden rounded-xl bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10"
        >
          <Scene />
        </div>

        <div className="mt-5 min-h-24">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Étape {index + 1} sur {CARDS.length}
          </p>
          <h2 id="onboarding-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p id="onboarding-description" className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className={`btn-secondary px-4 py-2 text-sm ${index === 0 ? "invisible" : ""}`}
          >
            Précédent
          </button>

          <div className="flex items-center gap-1.5">
            {CARDS.map((card, i) => (
              <button
                key={card.title}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Aller à l'étape ${i + 1}`}
                aria-current={i === index ? "step" : undefined}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "bg-brand w-5" : "w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button type="button" autoFocus onClick={finish} className="btn-primary px-4 py-2 text-sm">
              C&apos;est parti !
            </button>
          ) : (
            <button type="button" autoFocus onClick={() => goTo(index + 1)} className="btn-primary px-4 py-2 text-sm">
              Suivant
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
