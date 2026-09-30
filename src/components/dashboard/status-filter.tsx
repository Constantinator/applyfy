import Link from "next/link";

export type FilterOption = { value: string; label: string; count: number };

export function StatusFilter({
  options,
  active,
}: {
  options: FilterOption[];
  active: string;
}) {
  return (
    <nav aria-label="Filtrer les candidatures" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <Link
            key={option.value}
            href={option.value === "toutes" ? "/dashboard" : `/dashboard?filtre=${option.value}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {option.label}
            <span className={`ml-1.5 ${isActive ? "text-slate-300" : "text-slate-400"}`}>
              {option.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
