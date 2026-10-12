import { Fragment } from "react";

/** Gras « **texte** » à l'intérieur d'une ligne. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * Corps d'un article du blog, à partir d'un Markdown simple : paragraphes (séparés par une
 * ligne vide), titres « ## », listes « - » et **gras**. Rendu en éléments React, sans HTML brut.
 */
export function ArticleBody({ content }: { content: string }) {
  const blocks = content.trim().split(/\n\s*\n/);

  return (
    <div className="space-y-5 text-base leading-relaxed text-slate-600 sm:text-lg">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim());

        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return (
            <h2
              key={index}
              className="pt-6 text-2xl font-bold tracking-tight text-slate-900"
            >
              {inline(lines[0].slice(3))}
            </h2>
          );
        }

        // Une liste peut suivre directement une phrase d'introduction (« Ça te permet de : »).
        const listStart = lines.findIndex((line) => line.startsWith("- "));
        if (
          listStart !== -1 &&
          lines.slice(listStart).every((line) => line.startsWith("- "))
        ) {
          return (
            <Fragment key={index}>
              {listStart > 0 && (
                <p>{inline(lines.slice(0, listStart).join(" "))}</p>
              )}
              <ul className="list-disc space-y-2 pl-6 marker:text-blue-600">
                {lines.slice(listStart).map((line, item) => (
                  <li key={item}>{inline(line.slice(2))}</li>
                ))}
              </ul>
            </Fragment>
          );
        }

        return <p key={index}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
