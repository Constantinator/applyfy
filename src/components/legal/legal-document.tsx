// Mise en forme commune des pages légales.

export const LEGAL_UPDATED_ON = "7 octobre 2026";
export const CONTACT_EMAIL = "constantinvarin@gmail.com";

export function LegalDocument({
  title,
  intro,
  updatedOn = LEGAL_UPDATED_ON,
  children,
}: {
  title: string;
  intro?: string;
  /** Date de dernière mise à jour propre à la page (par défaut, celle commune aux pages légales). */
  updatedOn?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {updatedOn}</p>
        {intro && <p className="mt-6 leading-relaxed text-slate-700">{intro}</p>}
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="space-y-3 leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-blue-600 [&_a:hover]:text-blue-500 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-slate-400">
        {children}
      </div>
    </section>
  );
}

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
