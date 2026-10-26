import localFont from "next/font/local";

// Polices du CV et de la lettre : fichiers libres de public/fonts/cv (auto-hébergés par
// next/font), chacun aux proportions d'une police commerciale (noms affichés : cv-style).
// Chargées seulement sur les pages de l'éditeur : classe à poser sur un parent de l'éditeur.
// Les options de next/font doivent être écrites en toutes lettres (pas de fonction commune).

const gelasio = localFont({
  src: [
    { path: "../../public/fonts/cv/gelasio-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/gelasio-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/gelasio-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/gelasio-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-gelasio",
  display: "swap",
});

const garamond = localFont({
  src: [
    { path: "../../public/fonts/cv/eb-garamond-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/eb-garamond-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/eb-garamond-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/eb-garamond-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-garamond",
  display: "swap",
});

const carlito = localFont({
  src: [
    { path: "../../public/fonts/cv/carlito-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/carlito-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/carlito-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/carlito-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-carlito",
  display: "swap",
});

const arimo = localFont({
  src: [
    { path: "../../public/fonts/cv/arimo-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/arimo-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/arimo-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/arimo-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-arimo",
  display: "swap",
});

const caladea = localFont({
  src: [
    { path: "../../public/fonts/cv/caladea-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/caladea-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/caladea-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/caladea-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-caladea",
  display: "swap",
});

const tinos = localFont({
  src: [
    { path: "../../public/fonts/cv/tinos-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/cv/tinos-700.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/cv/tinos-400-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/cv/tinos-700-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cv-tinos",
  display: "swap",
});

export const cvFontVariables = [gelasio, garamond, carlito, arimo, caladea, tinos].map((f) => f.variable).join(" ");
