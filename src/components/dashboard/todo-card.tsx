import Link from "next/link";

import { IconBell, IconPencil, IconPlus, IconSparkles } from "@/components/icons";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { TODO_MAX_LINES, TODO_MAX_LINES_MOBILE, remainingTodo, type TodoItem } from "@/lib/dashboard-todo";
import { FOLLOW_UP_FILTER } from "@/lib/follow-up";

const LINKS_CLASS = "ui-link inline-flex min-h-11 items-center";
const ICON_BOX =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200";

/** « Voir les autres : 2 à relancer · 1 brouillon », chaque type menant à son filtre. */
function RemainingLinks({ items, shown, className }: { items: TodoItem[]; shown: number; className: string }) {
  const { relances, drafts } = remainingTodo(items, shown);
  if (relances + drafts === 0) return null;
  return (
    <p className={`mt-1 flex-wrap items-center gap-x-1.5 text-[13px] text-accent dark:text-blue-300 ${className}`}>
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
  const Icon = relance ? IconBell : IconPencil;
  return (
    <li
      className={`flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line-soft py-4 first:border-t-0 dark:border-slate-800 ${
        desktopOnly ? "hidden sm:flex" : "flex"
      }`}
    >
      <span aria-hidden="true" className={ICON_BOX}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[15px] font-semibold break-words text-ink dark:text-white">
          {relance ? `Relancer ${item.company}` : `Finir ta candidature chez ${item.company}`}
        </p>
        <p className="text-[13px] break-words text-muted dark:text-slate-300">
          {[item.position, item.delay].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Link
        href={relance ? `/candidatures/${item.id}#relance` : `/candidatures/${item.id}`}
        aria-label={relance ? `Écrire la relance à ${item.company}` : `Continuer ta candidature chez ${item.company}`}
        className="ui-btn-secondary w-full sm:w-auto"
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
    <section aria-labelledby="todo-title" className="ui-card min-w-0 p-5 sm:p-7">
      <h2 id="todo-title" className="ui-title">
        À faire aujourd&apos;hui
      </h2>

      {!hasRealApplication ? (
        <div className="mt-3 space-y-4">
          <p className="text-muted dark:text-slate-300">
            Ajoute l&apos;offre qui t&apos;intéresse : Applyfy t&apos;aide à adapter ton CV, à écrire ta lettre et à relancer au bon moment.
          </p>
          <OnboardingTip id="nouvelle-candidature" text="Clique ici pour ajouter une offre">
            <Link href="/candidatures/nouvelle" className="ui-btn-primary">
              <IconPlus className="h-4 w-4" />
              Ajouter ta première candidature
            </Link>
          </OnboardingTip>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden="true" className={ICON_BOX}>
            <IconSparkles className="h-5 w-5" />
          </span>
          <p className="min-w-0 text-muted dark:text-slate-300">
            Rien à faire pour l&apos;instant : tes candidatures sont à jour. Une nouvelle offre à tenter ?{" "}
            <Link href="/offres" className="ui-link underline">
              Trouver une offre
            </Link>
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-2">
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
