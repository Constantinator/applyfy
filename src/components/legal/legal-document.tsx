// Mise en forme commune des pages légales.

export const LEGAL_UPDATED_ON = "14 octobre 2026";
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
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">Dernière mise à jour : {updatedOn}</p>
        {intro && <p className="mt-6 leading-relaxed text-ink">{intro}</p>}
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="ui-title-sm text-ink">{title}</h2>
      <div className="space-y-3 leading-relaxed text-ink [&_a]:font-medium [&_a]:text-accent [&_a:hover]:text-ink [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted">
        {children}
      </div>
    </section>
  );
}

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
