import { LUMEO_TEXTS } from "@/lib/lumeo-texts";

import { LumeoAvatar, type LumeoExpression } from "./lumeo-avatar";

/** Bandeau du chat de Lumeo : avatar, nom (titre de la section) et ligne d'accroche. */
export function LumeoHeader({ id, expression = "neutre" }: { id: string; expression?: LumeoExpression }) {
  return (
    <div className="flex items-center gap-3">
      <LumeoAvatar size={56} expression={expression} />
      <div className="min-w-0">
        <h2 id={id} className="font-semibold text-ink dark:text-white">
          {LUMEO_TEXTS.name}
        </h2>
        <p className="mt-0.5 text-sm text-muted dark:text-slate-400">{LUMEO_TEXTS.tagline}</p>
      </div>
    </div>
  );
}
