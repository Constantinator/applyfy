"use client";

import { cvSettings, CV_SECTION_TITLES, type CvData, type CvLang, type CvTemplateId } from "@/lib/cv-builder-types";

import { SerifCentre } from "./cv-model-serif-centre";
import { AccentContext, AlignContext, LangContext, LegacyPages, TitlesContext } from "./cv-templates";

// Aiguillage entre les modèles : les 6 premiers (cv-templates, rendu inchangé) et les modèles réglables,
// chacun dans son fichier.

/** Les pages du CV dans le modèle choisi (dans un PrimitivesContext PDF ou HTML). */
export function CvPages({ data, templateId, language = "fr" }: { data: CvData; templateId: CvTemplateId; language?: CvLang }) {
  if (templateId !== "serif-centre") return <LegacyPages data={data} templateId={templateId} language={language} />;
  const settings = cvSettings(templateId, data.style);
  return (
    <TitlesContext value={CV_SECTION_TITLES[language]}>
      <LangContext value={language}>
        <AlignContext value={data.style.align}>
          <AccentContext value={data.style.accent}>
            <SerifCentre data={data} settings={settings} />
          </AccentContext>
        </AlignContext>
      </LangContext>
    </TitlesContext>
  );
}
