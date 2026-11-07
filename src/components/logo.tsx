import Image from "next/image";

// Logos Applyfy (public/images) :
//   - applyfy-icon.png : la coche seule (512 × 512) ;
//   - applyfy-logo.png : la coche et le nom (900 × 320).

/** Nouveau logo : « A » en chevron et point bleu, puis le nom. Barre du haut de l'application. */
export function BrandLogo({ size = "sm" }: { size?: "sm" | "md" }) {
  const icon = { sm: "h-7 w-7", md: "h-8 w-8" }[size];
  const text = { sm: "text-[17px]", md: "text-lg" }[size];
  return (
    <span className="inline-flex items-center gap-2 text-ink dark:text-white">
      <svg viewBox="0 0 48 48" aria-hidden="true" className={`${icon} shrink-0`}>
        {/* currentColor : #0A0A0A en clair (text-ink), blanc en mode sombre. */}
        <path
          d="M9 38 L24 8 L39 38"
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="30" r="4.2" fill="#2563EB" />
      </svg>
      <span className={`${text} font-bold tracking-[-0.03em]`}>Applyfy</span>
    </span>
  );
}

/** Icône Applyfy + nom en texte, en bleu de marque (blue-600 = #1E40AF) : pages légales, désabonnement. */
export function Logo({ size = "md", withName = true }: { size?: "sm" | "md" | "lg"; withName?: boolean }) {
  const icon = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-11 w-11" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/images/applyfy-icon.png"
        alt=""
        width={512}
        height={512}
        priority
        className={`${icon} shrink-0`}
      />
      {withName && <span className={`${text} font-bold tracking-tight text-blue-600 dark:text-white`}>Applyfy</span>}
    </span>
  );
}

/** Logo complet (coche + nom) en image : landing page, connexion, inscription, pied de page. */
export function LogoFull({
  className = "h-9 w-auto",
  priority = true,
}: {
  className?: string;
  /** Chargement prioritaire : oui en haut de page, non dans le pied de page. */
  priority?: boolean;
}) {
  return (
    <Image src="/images/applyfy-logo.png" alt="Applyfy" width={900} height={320} priority={priority} className={className} />
  );
}
