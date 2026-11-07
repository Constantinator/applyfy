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
            className={`ui-focus min-h-11 rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:min-h-0 ${
              isActive
                ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                : "bg-white dark:bg-slate-900 text-muted dark:text-slate-300 ring-1 ring-line-strong dark:ring-slate-700 hover:bg-pill hover:text-ink dark:hover:bg-slate-800"
            }`}
          >
            {option.label}
            <span className={`ml-1.5 ${isActive ? "text-white/70 dark:text-slate-600" : "text-muted dark:text-slate-400"}`}>
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
