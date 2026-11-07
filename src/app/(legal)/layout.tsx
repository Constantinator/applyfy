import Link from "next/link";

import { SiteHeader } from "@/components/site/site-header";

// Pages légales (mentions légales, confidentialité, CGU) : publiques, sans sidebar.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />
      <main className="ui-page flex-1">
        <div className="mx-auto max-w-[720px]">
          <Link
            href="/"
            className="ui-focus -mt-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink"
          >
            Retour à l&apos;accueil
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
