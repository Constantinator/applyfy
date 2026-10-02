/** Avertissement avant de regénérer un document déjà généré (CV amélioré, lettre). */
export function RegenerateWarning({
  document,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  /** Ex. « un CV », « une lettre ». */
  document: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">
        Tu as déjà généré {document} pour cette candidature. En regénérant, tu perdras tes
        modifications actuelles.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onConfirm} className="btn-primary px-4 py-2 text-sm">
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
