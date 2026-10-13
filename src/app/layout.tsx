import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AdTrackers } from "@/components/consent/ad-trackers";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { DARK_MODE_ENABLED } from "@/lib/theme";

import "./globals.css";

// Police unique du site (et des CV exportés), auto-hébergée par next/font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Valeurs par défaut (pages sans métadonnées propres) ; metadataBase rend absolues les URL
// de partage et canoniques.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMetadata({
    title: "Applyfy — Gère tes candidatures et décroche ton job",
    description:
      "Applyfy centralise tes candidatures, adapte ton CV et ta lettre pour chaque offre, et te rappelle quand relancer. Gratuit.",
  }),
};

// Thème appliqué avant l'affichage (pas de flash clair) : choix enregistré (« theme »),
// sinon réglage du système. N'a d'effet que sur les pages de l'app (cf. globals.css).
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : la classe « dark » est ajoutée par THEME_SCRIPT avant React.
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      {/* Mode sombre désactivé pour l'instant (DARK_MODE_ENABLED, src/lib/theme.ts). */}
      {DARK_MODE_ENABLED && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </head>
      )}
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
        <SiteFooter />
        {/* Meta Pixel et Google Ads : chargés seulement après acceptation dans le bandeau. */}
        <AdTrackers />
        {/* Mesure d'audience Vercel : sans cookie, actif seulement une fois déployé sur Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
