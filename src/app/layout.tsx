import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { MetaPixel } from "@/components/consent/meta-pixel";
import { SiteFooter } from "@/components/site-footer";
import { pageMetadata, SITE_URL } from "@/lib/seo";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
        <SiteFooter />
        {/* Meta Pixel : chargé seulement après acceptation dans le bandeau de consentement. */}
        <MetaPixel />
        {/* Mesure d'audience Vercel : sans cookie, actif seulement une fois déployé sur Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
