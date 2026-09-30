import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

const STATUS_STYLES: Record<ApplicationStatus, { badge: string; dot: string }> = {
  brouillon: { badge: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  envoyee: { badge: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  en_attente: { badge: "bg-cyan-50 text-cyan-700 ring-cyan-200", dot: "bg-cyan-500" },
  relancee: { badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  entretien: { badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  offre: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  refusee: { badge: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
