import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Markdown minimal des messages de l'IA dans le chat : sauts de ligne, listes à puces (« - » ou
// « * » en début de ligne) et **gras**. Rendu en éléments React, sans HTML brut. Liens
// [texte](/page) seulement si `links` est fourni et accepte l'adresse (sinon : le texte seul).

const BULLET = /^\s*[-*]\s+(.*)$/;

/** Filtre des liens : l'adresse à suivre, ou null pour n'afficher que le texte. */
export type ChatLinkFilter = (href: string) => string | null;

const LINK = /(\[[^\]\n]+\]\([^)\s]+\))/;
const LINK_PARTS = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

/** Liens d'un morceau de texte sans gras. */
function withLinks(text: string, links: ChatLinkFilter, key: string): ReactNode[] {
  return text.split(LINK).map((part, index) => {
    const match = LINK_PARTS.exec(part);
    if (!match) return <Fragment key={`${key}-${index}`}>{part}</Fragment>;
    const href = links(match[2]);
    return href ? (
      <Link key={`${key}-${index}`} href={href} className="ui-link font-medium">
        {match[1]}
      </Link>
    ) : (
      <Fragment key={`${key}-${index}`}>{match[1]}</Fragment>
    );
  });
}

/** **gras** à l'intérieur d'une ligne (et liens filtrés si `links` est fourni). */
function inline(text: string, links?: ChatLinkFilter): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : links ? (
      <Fragment key={index}>{withLinks(part, links, String(index))}</Fragment>
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

export function ChatMarkdown({ text, links }: { text: string; links?: ChatLinkFilter }) {
  return (
    <div>
      {toBlocks(text).map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className="mb-3 list-disc pl-5 last:mb-0">
            {block.lines.map((line, i) => (
              <li key={i} className="mb-1.5 last:mb-0">
                {inline(line, links)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="mb-3 last:mb-0">
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line, links)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
