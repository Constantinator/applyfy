import Link from "next/link";

import { BrandLogo } from "@/components/logo";

// Pages légales (mentions légales, confidentialité, CGU) : publiques, sans sidebar.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[68px] w-full max-w-[832px] items-center justify-between px-4 sm:px-8">
          <Link href="/" aria-label="Applyfy, accueil">
            <BrandLogo />
          </Link>
          <Link href="/" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink">
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>
      <main className="ui-page-narrow flex-1">{children}</main>
    </div>
  );
}
