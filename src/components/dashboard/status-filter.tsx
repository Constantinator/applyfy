export type FilterOption = { value: string; label: string; count: number };

export function StatusFilter({
  options,
  active,
  onChange,
}: {
  options: FilterOption[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label="Filtrer les candidatures" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand text-white shadow-sm shadow-blue-600/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {option.label}
            <span className={`ml-1.5 ${isActive ? "text-blue-100" : "text-slate-400"}`}>
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
