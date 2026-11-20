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
    // 10 px entre les lignes : pastilles de 34 px, zones tactiles de 44 px sans chevauchement.
    <div role="group" aria-label="Filtrer les candidatures" className="flex flex-wrap gap-x-2 gap-y-2.5">
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={`ui-focus ui-hit relative rounded-full px-3.5 py-2 text-[13px] leading-[18px] transition-colors ${
              isActive
                ? "bg-ink font-semibold text-white dark:bg-white dark:text-slate-900"
                : "bg-card font-medium text-[#3F3F46] ring-1 ring-line-strong ring-inset hover:bg-[#E9E9EB] dark:bg-slate-800 dark:ring-0 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {option.label}
            <span className="ml-1.5">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
