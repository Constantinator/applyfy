"use client";

import { cvSettings, CV_SECTION_TITLES, type CvData, type CvLang, type CvTemplateId } from "@/lib/cv-builder-types";

import { BandeauDroite } from "./cv-model-bandeau-droite";
import { type ModelSettings } from "./cv-model-kit";
import { Lateral } from "./cv-model-lateral";
import { SerifCentre } from "./cv-model-serif-centre";
import { AccentContext, AlignContext, LangContext, LegacyPages, TitlesContext, type LegacyTemplateId } from "./cv-templates";

// Aiguillage entre les modèles : les 6 premiers (cv-templates) et les modèles réglables, chacun dans
// son fichier.

type ModelId = Exclude<CvTemplateId, LegacyTemplateId>;

function Model({ id, data, settings }: { id: ModelId; data: CvData; settings: ModelSettings }) {
  switch (id) {
    case "serif-centre":
      return <SerifCentre data={data} settings={settings} />;
    case "bandeau-droite":
      return <BandeauDroite data={data} settings={settings} />;
    case "lateral":
      return <Lateral data={data} settings={settings} custom={data.style.accent} />;
  }
}

const LEGACY: readonly string[] = ["minimaliste", "classique", "moderne", "sidebar", "tech", "finance"] satisfies LegacyTemplateId[];
const isLegacy = (id: CvTemplateId): id is LegacyTemplateId => LEGACY.includes(id);

/** Les pages du CV dans le modèle choisi (dans un PrimitivesContext PDF ou HTML). */
export function CvPages({ data, templateId, language = "fr" }: { data: CvData; templateId: CvTemplateId; language?: CvLang }) {
  if (isLegacy(templateId)) return <LegacyPages data={data} templateId={templateId} language={language} />;
  return (
    <TitlesContext value={CV_SECTION_TITLES[language]}>
      <LangContext value={language}>
        <AlignContext value={data.style.align}>
          <AccentContext value={data.style.accent}>
            <Model id={templateId} data={data} settings={cvSettings(templateId, data.style)} />
          </AccentContext>
        </AlignContext>
      </LangContext>
    </TitlesContext>
  );
}
