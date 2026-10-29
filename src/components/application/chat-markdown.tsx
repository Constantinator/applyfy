import { Fragment, type ReactNode } from "react";

// Markdown minimal des messages de l'IA dans le chat : sauts de ligne, listes à puces (« - » ou
// « * » en début de ligne) et **gras**. Rendu en éléments React, sans HTML brut.

const BULLET = /^\s*[-*]\s+(.*)$/;

/** **gras** à l'intérieur d'une ligne. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

type Block = { kind: "list" | "paragraph"; lines: string[] };

/** Lignes regroupées en paragraphes (séparés par une ligne vide) et en listes (puces consécutives). */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const bullet = line.match(BULLET);
    const last = blocks.at(-1);
    if (bullet) {
      if (last?.kind === "list") last.lines.push(bullet[1]);
      else blocks.push({ kind: "list", lines: [bullet[1]] });
    } else if (!line.trim()) {
      blocks.push({ kind: "paragraph", lines: [] }); // ligne vide : le paragraphe suivant est nouveau
    } else if (last?.kind === "paragraph" && last.lines.length) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "paragraph", lines: [line] });
    }
  }
  return blocks.filter((b) => b.lines.length);
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div>
      {toBlocks(text).map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className="mb-3 list-disc pl-5 last:mb-0">
            {block.lines.map((line, i) => (
              <li key={i} className="mb-1.5 last:mb-0">
                {inline(line)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="mb-3 last:mb-0">
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
