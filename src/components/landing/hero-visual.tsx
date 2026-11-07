import { SCORE_CATEGORIES, scoreLabel, SCORE_TOTAL } from "@/lib/cv-score";

// Visuel produit du hero : un CV, son score et le coach. Statique et sans JavaScript : c'est le
// premier écran de la landing. Le CV et le dialogue sont fictifs, et l'affichent.

/** Score du CV d'exemple ; son appréciation vient de la règle de l'app. */
const EXAMPLE_SCORE = 82;

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CATEGORIES = SCORE_CATEGORIES.map((category, index) =>
  index === 0 ? category.label : category.label.toLowerCase(),
);
const CATEGORIES_LABEL = `${CATEGORIES.slice(0, -1).join(", ")} et ${CATEGORIES.at(-1)}`;

const SECTION_TITLE =
  "border-b-[1.5px] border-ink pb-[3px] text-[9.5px] font-bold tracking-[.08em] md:text-[11px]";
const CV_LINE = "flex justify-between gap-3 text-[10.5px] md:text-xs";
const CV_LIST = "mt-1.5 list-disc pl-3.5 text-[10.5px] leading-[1.55] text-prose md:pl-4 md:text-xs md:leading-[1.6]";
const BUBBLE = "rounded-2xl px-3.5 py-[11px]";

function ScoreRing() {
  return (
    <div className="relative h-16 w-16 shrink-0 md:h-[86px] md:w-[86px]">
      <svg viewBox="0 0 104 104" aria-hidden="true" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={RADIUS} fill="none" stroke="#EEEEEE" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={RADIUS}
          fill="none"
          stroke="#16A34A"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - EXAMPLE_SCORE / SCORE_TOTAL)}
        />
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <b className="text-xl tracking-[-0.03em] md:text-[26px]">{EXAMPLE_SCORE}</b>
        <span className="text-[9px] text-muted md:text-[10px]">/ {SCORE_TOTAL}</span>
      </p>
    </div>
  );
}

export function HeroVisual() {
  return (
    <figure className="mx-auto mt-9 max-w-[1080px] text-left md:mt-14">
      <div className="flex flex-col gap-3 rounded-[26px] border border-line bg-box p-3.5 md:flex-row md:items-stretch md:gap-6 md:rounded-[32px] md:p-7">
        <div className="rounded-2xl border border-[#E4E4E7] bg-white px-[18px] pt-[18px] pb-4 shadow-[0_20px_50px_rgba(10,10,10,.06)] md:flex-[1.15] md:rounded-[20px] md:px-[34px] md:py-[30px]">
          <p className="text-center text-[15px] font-bold tracking-[.04em] md:text-xl">CAMILLE MARTIN</p>
          <p className="mt-0.5 text-center text-[10px] text-muted md:text-[11.5px]">
            Chargée de projet digital · Paris<span className="hidden md:inline"> · camille@email.fr</span>
          </p>

          <p className={`mt-3.5 md:mt-[18px] ${SECTION_TITLE}`}>EXPÉRIENCE</p>
          <div className={`mt-2 md:mt-2.5 ${CV_LINE}`}>
            <b>Atelier Lumen · Chargée de projet</b>
            <span className="shrink-0 text-muted">2022 – 2025</span>
          </div>
          <ul className={CV_LIST}>
            <li>Piloté 12 projets web pour des clients grands comptes, livrés dans les délais</li>
            <li className="rounded bg-blue-100 px-[3px]">Réduit de 30 % le temps de recette en mettant en place un plan de tests</li>
            <li className="hidden md:list-item">Coordonné une équipe de 5 personnes (design, dev, contenu)</li>
          </ul>
          <div className={`mt-3 hidden md:flex ${CV_LINE}`}>
            <b>Studio Orme · Assistante de production</b>
            <span className="shrink-0 text-muted">2020 – 2022</span>
          </div>
          <ul className={`hidden md:block ${CV_LIST}`}>
            <li>Suivi de 20 dossiers clients par mois, de la demande à la facturation</li>
          </ul>

          <p className={`mt-3 md:mt-4 ${SECTION_TITLE}`}>COMPÉTENCES</p>
          <p className="mt-1.5 text-[10.5px] text-prose md:mt-2 md:text-xs">
            <b>Gestion de projet :</b> Agile, Scrum, Jira
            <span className="hidden md:inline">
              {" "}
              · <b>Outils :</b> Notion, Figma, Google Analytics
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-[.85] md:gap-4">
          <div className="ui-card flex items-center gap-3.5 px-4 py-3.5 md:gap-[18px] md:p-5">
            <ScoreRing />
            <div>
              <p className="text-[14.5px] font-semibold md:text-[15px]">{scoreLabel(EXAMPLE_SCORE)}</p>
              <p className="mt-0.5 text-xs text-muted md:mt-[3px] md:text-[12.5px]">
                {CATEGORIES_LABEL} sont notés par des règles claires.
              </p>
            </div>
          </div>
          <div className="ui-card hidden flex-1 flex-col gap-2.5 px-5 py-[18px] text-[13px] md:flex">
            <p className="text-xs font-semibold text-muted">COACH</p>
            <p className={`max-w-[92%] bg-box ${BUBBLE}`}>Combien de projets as-tu pilotés chez Atelier Lumen ?</p>
            <p className={`self-end bg-ink text-white ${BUBBLE}`}>Une douzaine, tous livrés dans les délais.</p>
            <p className={`max-w-[92%] bg-box ${BUBBLE}`}>C&apos;est fait : j&apos;ai ajouté tes projets à ton CV.</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[13px] text-muted">Exemple fictif</figcaption>
    </figure>
  );
}
