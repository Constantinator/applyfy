import type { Metadata } from "next";

import { DemoDashboard } from "@/components/landing/demo-dashboard";

// Aperçu du dashboard de démonstration avant son intégration à la landing. Publique, mais
// hors navigation, hors sitemap et non indexée.
export const metadata: Metadata = {
  title: "Aperçu du dashboard de démo — Applyfy",
  robots: { index: false, follow: false },
};

export default function DemoPreviewPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 sm:py-20">
      <div className="w-full max-w-6xl">
        <DemoDashboard />
      </div>
    </main>
  );
}
