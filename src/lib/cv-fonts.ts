import { EB_Garamond, Playfair_Display } from "next/font/google";

// Polices web optionnelles du CV et de la lettre (auto-hébergées par next/font), chargées
// seulement sur les pages de l'éditeur. Classe à poser sur un parent de l'éditeur.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-garamond", display: "swap" });

export const cvFontVariables = `${playfair.variable} ${garamond.variable}`;
