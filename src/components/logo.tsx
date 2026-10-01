/** Logo Applyfy : pastille en dégradé bleu → cyan + nom. */
export function Logo({ size = "md", withName = true }: { size?: "sm" | "md" | "lg"; withName?: boolean }) {
  // Pastille, lettre et arrondi agrandis ensemble (+20 à 30 %) pour garder les proportions.
  const box = {
    sm: "h-9 w-9 text-[18px] rounded-[0.95rem]",
    md: "h-10 w-10 text-[17.5px] rounded-[0.9375rem]",
    lg: "h-12 w-12 text-[19px] rounded-[0.9rem]",
  }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`bg-brand-gradient flex ${box} items-center justify-center font-bold text-white shadow-sm shadow-blue-600/20`}
      >
        A
      </span>
      {withName && <span className={`${text} font-bold tracking-tight text-slate-900`}>Applyfy</span>}
    </span>
  );
}
