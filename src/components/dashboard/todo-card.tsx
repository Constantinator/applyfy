import Link from "next/link";

import { IconBell, IconDocument, IconPlus, IconSparkles } from "@/components/icons";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { TODO_MAX_LINES, TODO_MAX_LINES_MOBILE, remainingTodo, type TodoItem } from "@/lib/dashboard-todo";
import { FOLLOW_UP_FILTER } from "@/lib/follow-up";

const LINKS_CLASS =
  "inline-flex min-h-11 items-center font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300";

/** « Voir les autres : 2 à relancer · 1 brouillon », chaque type menant à son filtre. */
function RemainingLinks({ items, shown, className }: { items: TodoItem[]; shown: number; className: string }) {
  const { relances, drafts } = remainingTodo(items, shown);
  if (relances + drafts === 0) return null;
  return (
    <p className={`mt-2 flex-wrap items-center gap-x-2 border-t border-slate-100 pt-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 ${className}`}>
      <span>Voir les autres :</span>
      {relances > 0 && (
        <Link href={`/candidatures?filtre=${FOLLOW_UP_FILTER}`} className={LINKS_CLASS}>
          {relances} à relancer
        </Link>
      )}
      {relances > 0 && drafts > 0 && <span aria-hidden="true">·</span>}
      {drafts > 0 && (
        <Link href="/candidatures?filtre=brouillon" className={LINKS_CLASS}>
          {drafts} brouillon{drafts > 1 ? "s" : ""}
        </Link>
      )}
    </p>
  );
}

function TodoLine({ item, desktopOnly }: { item: TodoItem; desktopOnly: boolean }) {
  const relance = item.kind === "relance";
  const Icon = relance ? IconBell : IconDocument;
  return (
    <li
      className={`flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 py-3.5 first:border-t-0 dark:border-slate-800 ${
        desktopOnly ? "hidden sm:flex" : "flex"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          relance
            ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            : "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-semibold break-words text-slate-900 dark:text-white">
          {relance ? `Relancer ${item.company}` : `Finir ta candidature chez ${item.company}`}
        </p>
        <p className="text-sm break-words text-slate-600 dark:text-slate-300">
          {[item.position, item.delay].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Link
        href={relance ? `/candidatures/${item.id}#relance` : `/candidatures/${item.id}`}
        aria-label={relance ? `Écrire la relance à ${item.company}` : `Continuer ta candidature chez ${item.company}`}
        className="btn-secondary min-h-11 w-full px-4 text-sm sm:w-auto"
      >
        {relance ? "Écrire la relance" : "Continuer"}
      </Link>
    </li>
  );
}

/**
 * Carte « À faire aujourd'hui ». `hasRealApplication` : au moins une candidature autre que
 * l'exemple créé à l'inscription ; sinon, invitation à ajouter la première.
 */
export function TodoCard({ items, hasRealApplication }: { items: TodoItem[]; hasRealApplication: boolean }) {
  return (
    <section aria-labelledby="todo-title" className="card min-w-0 p-5 sm:p-6">
      <h2 id="todo-title" className="text-lg font-semibold text-slate-900 dark:text-white">
        À faire aujourd&apos;hui
      </h2>

      {!hasRealApplication ? (
        <div className="mt-3 space-y-4">
          <p className="text-slate-600 dark:text-slate-300">
            Ajoute l&apos;offre qui t&apos;intéresse : Applyfy t&apos;aide à adapter ton CV, à écrire ta lettre et à relancer au bon moment.
          </p>
          <OnboardingTip id="nouvelle-candidature" text="Clique ici pour ajouter une offre">
            <Link href="/candidatures/nouvelle" className="btn-primary min-h-11 px-5 text-sm">
              <IconPlus className="h-4 w-4" />
              Ajouter ta première candidature
            </Link>
          </OnboardingTip>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <IconSparkles className="h-5 w-5" />
          </span>
          <p className="min-w-0 text-slate-600 dark:text-slate-300">
            Rien à faire pour l&apos;instant : tes candidatures sont à jour. Une nouvelle offre à tenter ?{" "}
            <Link href="/offres" className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300">
              Trouver une offre
            </Link>
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-1">
            {items.slice(0, TODO_MAX_LINES).map((item, index) => (
              <TodoLine key={item.id} item={item} desktopOnly={index >= TODO_MAX_LINES_MOBILE} />
            ))}
          </ul>
          {/* Le reste dépend du nombre de lignes visibles : une version par largeur. */}
          <RemainingLinks items={items} shown={TODO_MAX_LINES_MOBILE} className="flex sm:hidden" />
          <RemainingLinks items={items} shown={TODO_MAX_LINES} className="hidden sm:flex" />
        </>
      )}
    </section>
  );
}
