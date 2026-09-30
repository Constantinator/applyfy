import { formatOfferDescription, parseFormattedText } from "@/lib/format-offer";

/** Affiche un texte au format « ## Titre / • puce / paragraphes » (cf. lib/format-offer). */
export function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  // Re-normalise à l'affichage : couvre aussi les textes saisis ou collés à la main.
  const blocks = parseFormattedText(formatOfferDescription(text));

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-slate-700 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3 key={i} className="pt-1 font-semibold text-slate-900">
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-slate-400">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
