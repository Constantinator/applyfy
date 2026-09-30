import { EVENT_LABELS, type ApplicationEvent, type ApplicationEventType } from "@/lib/types";

const DOT_STYLES: Record<ApplicationEventType, string> = {
  creation: "bg-slate-400",
  envoi: "bg-blue-500",
  relance: "bg-amber-500",
  reponse: "bg-violet-500",
  changement_statut: "bg-slate-500",
  note: "bg-slate-300",
};

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Aucune action pour l&apos;instant.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {events.map((event) => {
        const isLong = (event.content?.length ?? 0) > 120;
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT_STYLES[event.type]}`}
            />
            <p className="text-sm font-medium text-slate-900">{EVENT_LABELS[event.type]}</p>
            <time dateTime={event.created_at} className="text-xs text-slate-500">
              {dateTimeFormatter.format(new Date(event.created_at))}
            </time>
            {event.content &&
              (isLong ? (
                <details className="mt-1 text-sm text-slate-600">
                  <summary className="cursor-pointer text-indigo-600 hover:text-indigo-500">
                    Voir le message
                  </summary>
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 whitespace-pre-line">
                    {event.content}
                  </p>
                </details>
              ) : (
                <p className="mt-1 text-sm text-slate-600">{event.content}</p>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
