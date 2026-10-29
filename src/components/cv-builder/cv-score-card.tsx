"use client";

import { useId } from "react";

import { READY_SCORE, scoreTone, type CvScore } from "@/lib/cv-score";

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
 * Score du CV dans l'éditeur, recalculé à chaque modification : jauge, appréciation et repère
 * « 90 = prêt à postuler ». Le coach traite lui-même les points à corriger.
 */
export function CvScorePanel({ score }: { score: CvScore }) {
  const titleId = useId();
  const t = SCORE_TONES[scoreTone(score.score)];
  return (
    <section aria-labelledby={titleId} className="card p-4">
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
    </section>
  );
}
