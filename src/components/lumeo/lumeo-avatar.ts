import { createElement, type ReactElement, type SVGProps } from "react";

/**
 * Avatar de Lumeo, l'assistant du CV Builder : petit robot noir (#0A0A0A), antenne à boule
 * bleue, deux oreilles, yeux blancs en pilule, bouche bleue en arc. En mode sombre (ou avec
 * `inverse`), le corps passe en blanc et les yeux en noir ; le bleu ne change pas.
 *
 * Écrit sans JSX (createElement) pour être rendu tel quel par les tests (`node --test`).
 */

export const LUMEO_SIZES = [24, 36, 56, 72, 96] as const;
export type LumeoSize = (typeof LUMEO_SIZES)[number];

export const LUMEO_EXPRESSIONS = [
  "neutre",
  "content",
  "reflechit",
  "etonne",
  "salue",
  "felicite",
  "endormi",
  "desole",
] as const;
export type LumeoExpression = (typeof LUMEO_EXPRESSIONS)[number];

const INK = "#0A0A0A";
const BLUE = "#2563EB";
// Corps et traits du visage : variables CSS, inversées en mode sombre (classes sur le <svg>).
const BODY = `var(--lumeo-body, ${INK})`;
const FACE = `var(--lumeo-face, #FFFFFF)`;

// `sparkle` : marque les étincelles de « felicite » (animées une fois avec `celebrate`), jamais rendue.
type Shape = ["rect" | "circle" | "ellipse" | "path", SVGProps<SVGElement> & { sparkle?: true }];

const fill = (color: string) => ({ style: { fill: color } });
const line = (color: string, width = 3) => ({
  style: { fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const },
});

/** Yeux en pilule (neutres), décalables pour regarder ailleurs. */
const pillEyes = (dx = 0, dy = 0, h = 9): Shape[] => [
  ["rect", { x: 16 + dx, y: 21 + dy, width: 5, height: h, rx: 2.5, ...fill(FACE) }],
  ["rect", { x: 27 + dx, y: 21 + dy, width: 5, height: h, rx: 2.5, ...fill(FACE) }],
];
/** Yeux rieurs (arcs vers le haut). */
const happyEyes: Shape[] = [
  ["path", { d: "M15.5 27 Q18.5 21.5 21.5 27", ...line(FACE) }],
  ["path", { d: "M26.5 27 Q29.5 21.5 32.5 27", ...line(FACE) }],
];
const smile = (d = "M19 34.5 Q24 39 29 34.5"): Shape => ["path", { d, ...line(BLUE) }];
/** Étincelle à quatre branches (félicitations). */
const sparkle = (x: number, y: number, r: number): Shape => [
  "path",
  { d: `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`, ...fill(BLUE), sparkle: true },
];

/** Traits propres à chaque expression (yeux, bouche, détail), dessinés par-dessus la tête. */
const FACES: Record<LumeoExpression, Shape[]> = {
  neutre: [...pillEyes(), smile("M19.5 35 Q24 37.5 28.5 35")],
  content: [...happyEyes, smile("M18 33.5 Q24 40 30 33.5")],
  // Regard vers le haut, bouche plate : il cherche.
  reflechit: [...pillEyes(1.5, -2, 7), ["path", { d: "M20 35.5 H28", ...line(BLUE) }]],
  etonne: [
    ["circle", { cx: 18.5, cy: 25, r: 3.5, ...fill(FACE) }],
    ["circle", { cx: 29.5, cy: 25, r: 3.5, ...fill(FACE) }],
    ["ellipse", { cx: 24, cy: 35.5, rx: 2.5, ry: 3, ...fill(BLUE) }],
  ],
  // Clin d'œil et main levée.
  salue: [
    ["rect", { x: 16, y: 21, width: 5, height: 9, rx: 2.5, ...fill(FACE) }],
    ["path", { d: "M26.5 26.5 Q29.5 22 32.5 26.5", ...line(FACE) }],
    smile("M18 33.5 Q24 40 30 33.5"),
    ["path", { d: "M41 27 Q45.5 22 44.5 13", ...line(BODY, 2.5) }],
    ["circle", { cx: 44.5, cy: 10, r: 3.5, ...fill(BODY) }],
  ],
  felicite: [
    ...happyEyes,
    ["path", { d: "M18 33 Q24 42 30 33 Z", ...fill(BLUE), ...line(BLUE, 2) }],
    sparkle(5.5, 9, 5.5),
    sparkle(42.5, 8, 4.5),
  ],
  endormi: [
    ["path", { d: "M15.5 26 Q18.5 29 21.5 26", ...line(FACE) }],
    ["path", { d: "M26.5 26 Q29.5 29 32.5 26", ...line(FACE) }],
    ["path", { d: "M21.5 35.5 H26.5", ...line(BLUE) }],
    ["path", { d: "M38 2.5 H44 L38 9 H44", ...line(BLUE, 2) }],
  ],
  // Sourcils relevés au centre, bouche vers le bas.
  desole: [
    ["path", { d: "M15.5 20.5 L21 18.5", ...line(FACE, 2.5) }],
    ["path", { d: "M27 18.5 L32.5 20.5", ...line(FACE, 2.5) }],
    ...pillEyes(0, 3, 7),
    smile("M19.5 37 Q24 33 28.5 37"),
  ],
};

/** Tête, oreilles et antenne, communes à toutes les expressions. */
const HEAD: Shape[] = [
  ["path", { d: "M24 13 V7", ...line(BODY, 2.5) }],
  ["rect", { x: 5, y: 22, width: 5, height: 10, rx: 2, ...fill(BODY) }],
  ["rect", { x: 38, y: 22, width: 5, height: 10, rx: 2, ...fill(BODY) }],
  ["rect", { x: 9, y: 12, width: 30, height: 30, rx: 9, ...fill(BODY) }],
];

export type LumeoAvatarProps = {
  size?: LumeoSize;
  expression?: LumeoExpression;
  /** Utilisé seul (sans texte « Lumeo » à côté) : annoncé aux lecteurs d'écran. */
  standalone?: boolean;
  /** Version blanche, pour un fond sombre hors mode sombre. */
  inverse?: boolean;
  /** « felicite » : les deux étincelles grossissent une fois (sauf animation réduite). */
  celebrate?: boolean;
  className?: string;
};

export function LumeoAvatar({
  size = 36,
  expression = "neutre",
  standalone = false,
  inverse = false,
  celebrate = false,
  className = "",
}: LumeoAvatarProps): ReactElement {
  const shapes = [...HEAD, ...FACES[expression]];
  return createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 48 48",
      width: size,
      height: size,
      "data-expression": expression,
      ...(standalone ? { role: "img", "aria-label": "Lumeo" } : { "aria-hidden": true, focusable: "false" }),
      style: inverse ? { "--lumeo-body": "#FFFFFF", "--lumeo-face": INK } : undefined,
      // Classes écrites en entier (lues telles quelles par Tailwind).
      className: `shrink-0 dark:[--lumeo-body:#FFFFFF] dark:[--lumeo-face:#0A0A0A] ${className}`.trim(),
    },
    // Boule de l'antenne : pulse doucement pendant la réflexion, sauf si l'animation est réduite.
    createElement("circle", {
      key: "ball",
      cx: 24,
      cy: 5.5,
      r: 3.5,
      style: { fill: BLUE },
      className: expression === "reflechit" ? "animate-pulse motion-reduce:animate-none" : undefined,
    }),
    ...shapes.map(([tag, { sparkle: isSparkle, ...props }], i) =>
      createElement(tag, {
        key: i,
        ...props,
        ...(isSparkle && celebrate ? { className: "animate-sparkle-once" } : {}),
      }),
    ),
  );
}
