"use client";

import { useEffect, useId, useRef, useState } from "react";

import { READY_SCORE, scoreLabel, scoreTone, type CvScore } from "@/lib/cv-score";

/** Couleurs du score : rouge sous 70, orange de 70 à 79, vert à partir de 80. */
export const SCORE_TONES = {
  red: { stroke: "#dc2626", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  orange: { stroke: "#f97316", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  green: { stroke: "#16a34a", bar: "bg-green-600", text: "text-green-700 dark:text-green-400" },
} as const;

/** Jauge circulaire du score sur 100. */
/**
 * `shown` (carte du tableau de bord) : valeur affichée pendant l'animation du score, la couleur
 * restant celle du score final.
 */
export function ScoreGauge({
  score,
  size = "lg",
  shown = score,
}: {
  score: number;
  size?: "sm" | "lg" | "card";
  shown?: number;
}) {
  const t = SCORE_TONES[scoreTone(score)];
  // Carte « Ton CV » du tableau de bord : 104 px, trait de 9 px, score en noir.
  if (size === "card") {
    const r = 47.5;
    const length = 2 * Math.PI * r;
    return (
      <span className="relative block h-[104px] w-[104px] shrink-0">
        <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="52" cy="52" r={r} fill="none" strokeWidth="9" className="stroke-track dark:stroke-slate-800" />
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke={t.stroke}
            strokeDasharray={length}
            strokeDashoffset={length * (1 - shown / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] leading-none font-bold text-ink dark:text-white">{shown}</span>
          <span className="mt-1 text-xs leading-none text-muted dark:text-slate-400">/ 100</span>
        </span>
      </span>
    );
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    // Uniquement des <span> : la jauge peut être placée dans un bouton.
    <span className={`relative block shrink-0 ${size === "lg" ? "h-32 w-32" : "h-20 w-20"}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-track dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={t.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${t.text} ${size === "lg" ? "text-3xl" : "text-xl"}`}>{score}</span>
        <span className="text-xs text-muted dark:text-slate-400">sur 100</span>
      </span>
    </span>
  );
}

/** Corrections affichées par catégorie dans le détail du score (les plus rentables). */
const DETAIL_MAX_LINES = 3;

/** Détail du score : les 5 catégories et, sous celles qui ne sont pas au maximum, ce qui manque. */
export function CvScoreDetail({ score }: { score: CvScore }) {
  return (
    <ul className="space-y-3">
      {score.categories.map((category) => {
        const incomplete = category.score < category.max;
        const lines = incomplete ? score.corrections.filter((c) => c.category === category.id) : [];
        const others = lines.length - DETAIL_MAX_LINES;
        return (
          <li key={category.id}>
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink dark:text-white">{category.label}</span>
              <span className={`shrink-0 font-semibold ${SCORE_TONES[scoreTone((category.score / category.max) * 100)].text}`}>
                {category.score}/{category.max}
              </span>
            </p>
            {incomplete && (
              <ul className="mt-1 space-y-0.5 text-xs text-prose dark:text-slate-300">
                {lines.slice(0, DETAIL_MAX_LINES).map((c) => (
                  <li key={c.id}>{c.message}</li>
                ))}
                {others > 0 && (
                  <li className="text-muted dark:text-slate-400">
                    et {others} {others > 1 ? "autres points" : "autre point"}
                  </li>
                )}
                {/* Points perdus sans correction : CV encore trop vide pour que la règle s'applique. */}
                {!lines.length && <li>Complète ton CV pour gagner ces points.</li>}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Score du CV dans l'éditeur, recalculé à chaque modification : jauge, appréciation et repère
 * « 80 = prêt à postuler ». Un clic sur la jauge ouvre le détail par catégorie. Le coach traite
 * lui-même les points à corriger.
 */
export function CvScorePanel({ score }: { score: CvScore }) {
  const titleId = useId();
  const detailId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = SCORE_TONES[scoreTone(score.score)];

  // Fermeture du détail : clic en dehors, ou Échap (le focus revient alors sur la jauge).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    // z-index à l'ouverture : le détail passe au-dessus des onglets et du chat, placés après dans la page.
    <section aria-labelledby={titleId} className={`ui-card relative p-4 ${open ? "z-20" : ""}`}>
      <div className="flex items-center gap-4">
        <div ref={rootRef} className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            aria-label={`Score de ${score.score} sur 100 : ${open ? "masquer" : "voir"} le détail`}
            title="Voir le détail du score"
            onClick={() => setOpen((value) => !value)}
            className="block rounded-full transition hover:ring-2 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none dark:hover:ring-slate-600 dark:focus-visible:ring-blue-500"
          >
            <ScoreGauge score={score.score} size="sm" />
          </button>
          {open && (
            <div
              id={detailId}
              className="absolute top-full left-0 z-30 mt-2 max-h-[60vh] w-[min(20rem,calc(100vw-3.5rem))] overflow-y-auto rounded-block border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:shadow-lg"
            >
              <CvScoreDetail score={score} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h2 id={titleId} className="font-semibold text-ink dark:text-white">
            Score de ton CV
          </h2>
          <p className={`text-sm font-medium ${t.text}`}>{scoreLabel(score.score)}</p>
          <p className="text-xs text-muted dark:text-slate-400">{READY_SCORE} = prêt à postuler</p>
        </div>
      </div>
    </section>
  );
}
