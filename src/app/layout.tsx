import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";

import "./globals.css";

// Police unique du site (et des CV exportés), auto-hébergée par next/font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Applyfy — Suivi de candidatures pour ta recherche d'emploi",
  description: "Suis tes candidatures pour ton futur job, rédige et relance au bon moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
        <SiteFooter />
        {/* Mesure d'audience Vercel : sans cookie, actif seulement une fois déployé sur Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
