import Image from "next/image";

// Logos Applyfy (public/images) :
//   - applyfy-icon.png : la coche seule (512 × 512) ;
//   - applyfy-logo.png : la coche et le nom (900 × 320).

/** Icône Applyfy + nom en texte (sidebar, pages légales). */
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
      {withName && <span className={`${text} font-bold tracking-tight text-slate-900`}>Applyfy</span>}
    </span>
  );
}

/** Logo complet (coche + nom) en image : landing page, connexion, inscription. */
export function LogoFull({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Image src="/images/applyfy-logo.png" alt="Applyfy" width={900} height={320} priority className={className} />
  );
}
