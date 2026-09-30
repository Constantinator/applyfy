import { DOCUMENT_LABELS, type ApplicationDocument } from "@/lib/types";

export function DocumentsList({ documents }: { documents: ApplicationDocument[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">Aucun document associé à cette candidature.</p>;
  }

  return (
    <ul className="space-y-3">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
                <path d="M14 3v5h5" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{DOCUMENT_LABELS[doc.kind]}</p>
              <p className="truncate text-xs text-slate-500">{doc.file_name}</p>
            </div>
          </div>
          <a
            href={`/candidatures/${doc.application_id}/documents/${doc.id}`}
            download={doc.file_name}
            className="rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
          >
            Télécharger
          </a>
        </li>
      ))}
    </ul>
  );
}
