// Styles partagés des formulaires d'authentification (cf. utilitaires input / btn-primary).
export const inputClassName = "input py-2.5";

export const submitClassName = "btn-primary w-full px-4 py-2.5";

export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
      {message}
    </p>
  );
}
