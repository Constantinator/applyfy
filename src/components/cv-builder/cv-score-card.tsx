"use client";

import { useEffect, useId, useState } from "react";

import { READY_SCORE, scoreTone, type BannedInCv, type CvCorrection, type CvScore } from "@/lib/cv-score";

/** Couleurs du score : rouge sous 70, orange de 70 à 89, vert à partir de 90. */
export const SCORE_TONES = {
  red: { stroke: "#dc2626", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  orange: { stroke: "#f97316", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  green: { stroke: "#16a34a", bar: "bg-green-600", text: "text-green-700 dark:text-green-400" },
} as const;

/** Appréciation du score sur 100. */
export function scoreLabel(score: number) {
  if (score >= READY_SCORE) return "Prêt à postuler";
  return score >= 70 ? "Presque prêt" : "À retravailler";
}

/** Jauge circulaire du score sur 100. */
export function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const t = SCORE_TONES[scoreTone(score)];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`relative shrink-0 ${size === "lg" ? "h-32 w-32" : "h-20 w-20"}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" />
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
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${t.text} ${size === "lg" ? "text-3xl" : "text-xl"}`}>{score}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">sur 100</span>
      </p>
    </div>
  );
}

/**
 * Score du CV dans l'éditeur, recalculé à chaque modification : jauge, repère « 90 = prêt à
 * postuler » et les 3 corrections qui rapportent le plus. Un clic fait poser au coach une
 * question sur ce point ; `onPick` renvoie pourquoi rien n'est demandé (coach occupé, limite).
 */
export function CvScorePanel({
  score,
  banned = [],
  onPick,
  onAsk,
}: {
  score: CvScore;
  /** Formules de la liste noire présentes dans le CV. */
  banned?: BannedInCv[];
  onPick: (correction: CvCorrection) => string | null;
  /** Question ciblée du coach sur un point libre (formule à éviter). */
  onAsk?: (point: string) => string | null;
}) {
  const titleId = useId();
  const t = SCORE_TONES[scoreTone(score.score)];
  const top = score.corrections.slice(0, 3);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <section aria-labelledby={titleId} className="card space-y-4 p-4">
      <div className="flex items-center gap-4">
        <ScoreGauge score={score.score} size="sm" />
        <div className="min-w-0">
          <h2 id={titleId} className="font-semibold text-slate-900 dark:text-white">
            Score de ton CV
          </h2>
          <p className={`text-sm font-medium ${t.text}`}>{scoreLabel(score.score)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">90 = prêt à postuler</p>
        </div>
      </div>
      {top.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Corrections qui rapportent le plus
          </h3>
          <ul className="space-y-1.5">
            {top.map((c) => (
              <li key={`${c.category}-${c.elementId}-${c.message}`}>
                <button
                  type="button"
                  onClick={() => setNotice(onPick(c))}
                  title="Le coach te pose une question pour corriger ce point"
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
                >
                  <span>{c.message}</span>
                  <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300">+{c.points} pts</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {banned.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Formules à éviter
          </h3>
          <ul className="space-y-1.5">
            {banned.map((b) => (
              <li key={`${b.elementId}-${b.phrase}`}>
                <button
                  type="button"
                  disabled={!onAsk}
                  onClick={() => onAsk && setNotice(onAsk(`Formule à éviter « ${b.phrase} » dans ${b.where} : remplace-la par des faits concrets`))}
                  title="Le coach te pose une question pour remplacer cette formule"
                  className="flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-slate-200"
                >
                  <span aria-hidden="true" className="text-amber-600">
                    !
                  </span>
                  <span>
                    « {b.phrase} » dans {b.where}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
          {notice}
        </p>
      )}
    </section>
  );
}
