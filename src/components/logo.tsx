/** Logo Applyfy : pastille en dégradé bleu → cyan + nom. */
export function Logo({ size = "md", withName = true }: { size?: "sm" | "md" | "lg"; withName?: boolean }) {
  const box = { sm: "h-7 w-7 text-sm", md: "h-8 w-8 text-sm", lg: "h-10 w-10 text-base" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`bg-brand-gradient flex ${box} items-center justify-center rounded-xl font-bold text-white shadow-sm shadow-blue-600/20`}
      >
        A
      </span>
      {withName && <span className={`${text} font-bold tracking-tight text-slate-900`}>Applyfy</span>}
    </span>
  );
}
