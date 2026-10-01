"use client";

import { useSearchParams } from "next/navigation";

/** Confirmation affichée sur l'accueil après la suppression du compte (?compte=supprime). */
export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("compte") !== "supprime") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <p
        role="status"
        className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200"
      >
        Ton compte et toutes tes données ont été supprimés. Merci d&apos;avoir utilisé Applyfy, et
        bonne continuation dans ta recherche !
      </p>
    </div>
  );
}
