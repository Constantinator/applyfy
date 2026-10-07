"use client";

import { useState, useTransition } from "react";

import { completeOfferDescriptionAction } from "@/app/actions/applications";
import { OFFER_DESCRIPTION_MAX_LENGTH } from "@/lib/offer-limits";

/**
 * Bandeau d'une description d'offre incomplète (extrait Adzuna ou France Travail, le site
 * d'origine bloquant la lecture) : l'utilisateur colle la description complète, qui
 * remplace l'extrait. La fiche est ensuite rafraîchie et le bandeau disparaît.
 */
export function OfferDescriptionCompleter({
  applicationId,
  offerUrl,
}: {
  applicationId: string;
  /** Offre d'origine, où copier la description. */
  offerUrl: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await completeOfferDescriptionAction(applicationId, text);
      if (!result.ok) setError(result.error);
      // Succès : la fiche est revalidée côté serveur, ce bandeau n'est plus affiché.
    });
  }

  return (
    <div role="status" className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-base leading-5">
          ⚠️
        </span>
        <p className="text-amber-900">
          La description de cette offre est incomplète. Pour une analyse CV et une lettre de motivation
          plus précises, colle la description complète ci-dessous.
          {offerUrl && (
            <>
              {" "}
              <a
                href={offerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
              >
                Voir l&apos;offre complète ↗
              </a>
            </>
          )}
        </p>
      </div>

      {editing ? (
        <div className="space-y-2">
          <label htmlFor="offer-description-full" className="sr-only">
            Description complète de l&apos;offre
          </label>
          <textarea
            id="offer-description-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            maxLength={OFFER_DESCRIPTION_MAX_LENGTH}
            autoFocus
            placeholder="Colle ici la description complète copiée depuis le site de l'offre…"
            className="input bg-white leading-relaxed"
          />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending || !text.trim()}
              className="btn-primary px-4 py-2 text-sm"
            >
              {pending ? "Enregistrement…" : "Enregistrer la description"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="btn-primary px-4 py-2 text-sm">
          Compléter la description
        </button>
      )}
    </div>
  );
}
