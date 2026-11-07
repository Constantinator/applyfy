// Styles partagés des formulaires d'authentification (cf. utilitaires ui-input / ui-btn-primary).
export const inputClassName = "ui-input";

export const submitClassName = "ui-btn-primary w-full";

export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
      {message}
    </p>
  );
}
