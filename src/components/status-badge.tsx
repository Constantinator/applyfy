import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  brouillon: "bg-slate-100 text-slate-700 ring-slate-200",
  envoyee: "bg-blue-50 text-blue-700 ring-blue-200",
  en_attente: "bg-sky-50 text-sky-700 ring-sky-200",
  relancee: "bg-amber-50 text-amber-800 ring-amber-200",
  entretien: "bg-violet-50 text-violet-700 ring-violet-200",
  offre: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  refusee: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
