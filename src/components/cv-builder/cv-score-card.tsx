"use client";

import { useId, useState } from "react";

import { READY_SCORE, scoreTone, type BannedInCv, type CvScore } from "@/lib/cv-score";

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

/** Point affiché sous le score : correction du score ou formule à éviter. */
type Point = { id: string; message: string; points: number | null };

/**
 * Points de la session : ceux du premier calcul (ouverture de l'éditeur), puis ceux apparus
 * depuis, dans l'ordre. Un point absent du calcul en cours est corrigé.
 */
function useSessionPoints(current: Point[]) {
  const [shown, setShown] = useState(current);
  const added = current.filter((p) => !shown.some((s) => s.id === p.id));
  // Nouveaux points ajoutés pendant le rendu (mise à jour d'état guidée par les props).
  if (added.length) setShown([...shown, ...added]);
  const byId = new Map(current.map((p) => [p.id, p]));
  return [...shown, ...added].map((p) => ({ ...(byId.get(p.id) ?? p), fixed: !byId.has(p.id) }));
}

function PointList({ title, points }: { title: string; points: (Point & { fixed: boolean })[] }) {
  if (!points.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <ul className="space-y-1.5">
        {points.map((p) => (
          <li
            key={p.id}
            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
              p.fixed
                ? "border-green-200 bg-green-50/50 text-slate-400 dark:border-green-400/20 dark:bg-green-500/5 dark:text-slate-500"
                : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            <span className={`flex gap-2 ${p.fixed ? "line-through" : ""}`}>
              {p.fixed && (
                <span aria-hidden="true" className="text-green-600 no-underline dark:text-green-400">
                  ✓
                </span>
              )}
              <span>
                {p.message}
                {p.fixed && <span className="sr-only"> (corrigé)</span>}
              </span>
            </span>
            {p.points !== null && !p.fixed && (
              <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300">+{p.points} pts</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Score du CV dans l'éditeur, recalculé à chaque modification : jauge, repère « 90 = prêt à
 * postuler », points à corriger et formules à éviter. Informatif : le coach traite lui-même les
 * points un par un. Les points de l'ouverture restent affichés, barrés une fois corrigés.
 */
export function CvScorePanel({ score, banned = [] }: { score: CvScore; banned?: BannedInCv[] }) {
  const titleId = useId();
  const t = SCORE_TONES[scoreTone(score.score)];
  const corrections = useSessionPoints(
    score.corrections.filter((c) => !c.jargon).map((c) => ({ id: c.id, message: c.message, points: c.points })),
  );
  const formulas = useSessionPoints(
    banned.map((b) => ({ id: `${b.elementId}:${b.phrase}`, message: `« ${b.phrase} » dans ${b.where}`, points: null })),
  );
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
      <PointList title="Points à corriger" points={corrections} />
      <PointList title="Formules à éviter" points={formulas} />
    </section>
  );
}
