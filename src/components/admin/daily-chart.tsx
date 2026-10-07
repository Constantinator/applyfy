"use client";

import { useState } from "react";

type Point = { day: string; value: number };

const W = 640;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 32 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const dayLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const formatDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

/** Graduations entières « rondes » de l'axe des valeurs. */
function ticks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 4));
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

/**
 * Graphique d'une série quotidienne (une seule série : pas de légende, le titre la nomme).
 * Barres (« bar ») ou courbe en escalier (« line »), infobulle au survol de chaque jour.
 */
export function DailyChart({
  points,
  type,
  label,
  unit,
}: {
  points: Point[];
  type: "bar" | "line";
  /** Description accessible du graphique. */
  label: string;
  /** Unité de l'infobulle, ex. « inscrits ». */
  unit: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const yTicks = ticks(max);
  const top = yTicks[yTicks.length - 1] || 1;
  const slot = PLOT_W / points.length;
  const x = (i: number) => PAD.left + i * slot;
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const barW = Math.max(2, slot - 2); // 2 px d'espace entre les barres

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "H"}${x(i) + slot / 2} V${y(p.value)}`)
    .join(" ")
    .replace(/^M([\d.]+) V/, "M$1 ");

  const active = hovered === null ? null : points[hovered];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full overflow-visible">
        {/* Grille et axe des valeurs, en retrait. */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px]">
              {t}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="stroke-slate-300" />
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <text
            key={i}
            x={x(i) + slot / 2}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-slate-400 text-[10px]"
          >
            {formatDay(points[i].day)}
          </text>
        ))}

        {type === "bar"
          ? points.map((p, i) => {
              const h = y(0) - y(p.value);
              if (h <= 0) return null;
              const r = Math.min(4, h, barW / 2);
              const left = x(i) + (slot - barW) / 2;
              // Haut arrondi (4 px), base droite posée sur l'axe.
              return (
                <path
                  key={p.day}
                  d={`M${left} ${y(0)} V${y(p.value) + r} Q${left} ${y(p.value)} ${left + r} ${y(p.value)} H${left + barW - r} Q${left + barW} ${y(p.value)} ${left + barW} ${y(p.value) + r} V${y(0)} Z`}
                  className={hovered === i ? "fill-blue-700" : "fill-blue-600"}
                />
              );
            })
          : points.length > 0 && (
              <path d={linePath} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-blue-600" />
            )}

        {hovered !== null && (
          <line
            x1={x(hovered) + slot / 2}
            x2={x(hovered) + slot / 2}
            y1={PAD.top}
            y2={y(0)}
            className="stroke-slate-300"
            strokeDasharray="3 3"
          />
        )}
        {type === "line" && active && (
          <circle
            cx={x(hovered!) + slot / 2}
            cy={y(active.value)}
            r={4.5}
            strokeWidth={2}
            className="fill-blue-600 stroke-white"
          />
        )}

        {/* Zones de survol : toute la hauteur de chaque jour. */}
        {points.map((p, i) => (
          <rect
            key={p.day}
            x={x(i)}
            y={PAD.top}
            width={slot}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {active && hovered !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${((x(hovered) + slot / 2) / W) * 100}%` }}
        >
          <span className="text-slate-300">{formatDay(active.day)}</span> ·{" "}
          <strong className="font-semibold">
            {active.value} {unit}
          </strong>
        </div>
      )}
    </div>
  );
}
