import Link from "next/link";
import { Fragment } from "react";

/** « applyfy.fr » dans le texte : lien vers l'inscription. */
function linkify(text: string, key: number) {
  return text.split(/(applyfy\.fr)/).map((part, index) =>
    part === "applyfy.fr" ? (
      <Link
        key={`${key}-${index}`}
        href="/signup"
        className="font-semibold text-blue-600 underline-offset-4 hover:underline"
      >
        {part}
      </Link>
    ) : (
      <Fragment key={`${key}-${index}`}>{part}</Fragment>
    ),
  );
}

/** Gras « **texte** » et liens vers Applyfy à l'intérieur d'une ligne. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-slate-900">
        {linkify(part.slice(2, -2), index)}
      </strong>
    ) : (
      <Fragment key={index}>{linkify(part, index)}</Fragment>
    ),
  );
}

/** Listes à puces « - » et numérotées « 1. ». */
const LISTS = [
  { item: /^- /, tag: "ul", className: "list-disc" },
  { item: /^\d+\. /, tag: "ol", className: "list-decimal marker:font-semibold" },
] as const;

/**
 * Corps d'un article du blog, à partir d'un Markdown simple : paragraphes (séparés par une
 * ligne vide), titres « ## », listes « - » et « 1. », **gras** et « applyfy.fr » en lien.
 * Rendu en éléments React, sans HTML brut.
 */
export function ArticleBody({ content }: { content: string }) {
  const blocks = content.trim().split(/\n\s*\n/);

  return (
    <div className="space-y-5 text-base leading-relaxed text-slate-600 sm:text-lg">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim());

        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return (
            <h2 key={index} className="pt-6 text-2xl font-bold tracking-tight text-slate-900">
              {inline(lines[0].slice(3))}
            </h2>
          );
        }

        // Une liste peut suivre directement une phrase d'introduction (« Ça te permet de : »).
        for (const list of LISTS) {
          const listStart = lines.findIndex((line) => list.item.test(line));
          if (listStart === -1 || !lines.slice(listStart).every((line) => list.item.test(line))) {
            continue;
          }
          const List = list.tag;
          return (
            <Fragment key={index}>
              {listStart > 0 && <p>{inline(lines.slice(0, listStart).join(" "))}</p>}
              <List className={`${list.className} space-y-2 pl-6 marker:text-blue-600`}>
                {lines.slice(listStart).map((line, item) => (
                  <li key={item}>{inline(line.replace(list.item, ""))}</li>
                ))}
              </List>
            </Fragment>
          );
        }

        return <p key={index}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
