import { EVENT_LABELS, type ApplicationEvent } from "@/lib/types";

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris", // horodatages réels : affichés à l'heure de Paris

});

export function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted dark:text-slate-400">Aucune action pour l&apos;instant.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => {
        const isLong = (event.content?.length ?? 0) > 120;
        return (
          <li key={event.id} className="relative pl-[22px]">
            <span
              aria-hidden="true"
              className="absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full bg-ink dark:bg-white"
            />
            <p className="text-sm font-semibold text-ink dark:text-white">{EVENT_LABELS[event.type]}</p>
            <time dateTime={event.created_at} className="text-[13px] text-muted dark:text-slate-400">
              {dateTimeFormatter.format(new Date(event.created_at))}
            </time>
            {event.content &&
              (isLong ? (
                <details className="mt-1 text-sm text-muted dark:text-slate-300">
                  <summary className="cursor-pointer text-accent dark:text-blue-400 hover:text-accent">
                    Voir le message
                  </summary>
                  <p className="mt-2 rounded-block bg-surface dark:bg-slate-800/50 p-3 whitespace-pre-line">
                    {event.content}
                  </p>
                </details>
              ) : (
                <p className="mt-1 text-sm text-muted dark:text-slate-300">{event.content}</p>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
