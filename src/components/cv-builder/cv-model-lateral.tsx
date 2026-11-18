"use client";

import { useContext, type ReactNode } from "react";

import { displayUrl, type CvData } from "@/lib/cv-builder-types";

import { contactDisplay, INK, ModelPage, MUTED, type ModelSettings } from "./cv-model-kit";
import { Link, Photo, Text, View } from "./cv-primitives";
import {
  absolute,
  BOLD,
  bulletRows,
  Contact,
  contacts,
  Dates,
  entryBlocks,
  mix,
  Name,
  Paragraph,
  readableOn,
  Section,
  sections,
  skillGroupDisplay,
  TitlesContext,
  useLevelLabel,
} from "./cv-templates";

// Modèle « lateral » : colonne claire à gauche (photo ronde facultative, coordonnées, compétences une par
// ligne, langues), parcours à droite (nom, titre, profil, expériences, formation, certifications).
// Tailles en points pour le corps par défaut (9 pt, Arimo), converties de la maquette (794 px = A4).
//
// Ordre de lecture (ATS) : la colonne principale est écrite la première, puis placée à droite par
// `row-reverse` ; dans le fichier PDF, nom, profil, expériences et formation précèdent donc la colonne.

/** Largeur de la colonne latérale (236 px), marge intérieure, photo (118 px). */
export const LATERAL_SIDE = 177;
const SIDE_PADDING = 16;
const PHOTO_SIZE = 88.5;
/** Fond de la colonne avec l'accent du modèle ; avec un accent choisi, une teinte très claire de cet accent. */
const SIDE_BG = "#E6EDF3";
const CONTACT_SIZE = 8.25;

function Heading({ children, color, rule }: { children: string; color: string; rule: string }) {
  return (
    <View style={{ borderBottomWidth: 0.75, borderColor: rule, paddingBottom: 2, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 10.5, lineHeight: 1.2, color }]}>{children}</Text>
    </View>
  );
}

export function Lateral({ data, settings, custom }: { data: CvData; settings: ModelSettings; /** Accent choisi ; vide : celui du modèle. */ custom: string }) {
  const t = useContext(TitlesContext);
  const levelLabel = useLevelLabel();
  const s = sections(data);
  const items = contacts(data);
  const photo = data.personal.photo;
  const sideBg = custom ? mix(custom, "#FFFFFF", 0.88) : SIDE_BG;
  // L'accent, foncé si besoin pour un contraste de 4,5:1 : sur le blanc à droite, sur le fond clair à gauche.
  const accent = readableOn(settings.accent, "#FFFFFF");
  const sideAccent = readableOn(settings.accent, sideBg);
  const muted = { color: MUTED };
  const section = { marginTop: 12 };
  const entry = { marginTop: 7 };
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const dates = [muted, { marginLeft: 8 }];
  const heading = (title: string) => (
    <Heading color={accent} rule="#CBD5E1">
      {title}
    </Heading>
  );
  const sideHeading = (title: string) => (
    <Heading color={sideAccent} rule={mix(sideAccent, sideBg, 0.6)}>
      {title}
    </Heading>
  );
  // Coordonnées : une par ligne ; e-mail ou URL plus large que la colonne coupé à un endroit naturel.
  const sideSection = { marginTop: 14 };
  const line = (key: string, content: ReactNode) => ({ key, style: { marginTop: 2.5 }, content });

  return (
    <ModelPage settings={settings} lineHeight={1.4} bleed>
      {/* Fond de la colonne, répété sur toute la hauteur de chaque page. */}
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: LATERAL_SIDE, backgroundColor: sideBg }} />
      <View style={{ flexDirection: "row-reverse" }}>
        <View style={{ flex: 1, paddingLeft: 22, paddingRight: settings.horizontal }}>
          <Name data={data} style={[BOLD, { fontSize: 23.25, lineHeight: 1.15 }]} />
          {data.personal.jobTitle ? (
            <Text edit="personal.jobTitle" style={{ fontSize: 11.25, marginTop: 2, color: accent }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}

          {s.summary ? (
            <Section style={section} heading={heading(t.profile)}>
              <Paragraph edit="summary">{s.summary}</Paragraph>
            </Section>
          ) : null}

          {s.experiences.length ? (
            <Section
              style={section}
              heading={heading(t.experiences)}
              blocks={s.experiences.flatMap((e) => {
                const base = `experiences.${e.id}`;
                const head = (
                  <>
                    <View style={row}>
                      <Text edit={`${base}.${e.position ? "position" : "company"}`} style={[BOLD, { flex: 1 }]}>
                        {e.position || e.company}
                      </Text>
                      <Dates base={base} start={e.startDate} end={e.endDate} current={e.current} style={dates} />
                    </View>
                    {(e.position && e.company) || e.location ? (
                      <Text>
                        {e.position && e.company ? (
                          <Text edit={`${base}.company`} style={{ color: accent }}>
                            {e.company}
                          </Text>
                        ) : null}
                        {/* Espace insécable avant « · » : le séparateur ne commence jamais une ligne. */}
                        {e.position && e.company && e.location ? <Text style={muted}>{"\u00A0· "}</Text> : null}
                        {e.location ? (
                          <Text edit={`${base}.location`} style={muted}>
                            {e.location}
                          </Text>
                        ) : null}
                      </Text>
                    ) : null}
                  </>
                );
                return entryBlocks(e.id, head, bulletRows(base, e.bullets, accent), (part, content) => ({
                  style: part === "only" || part === "first" ? entry : undefined,
                  content,
                }));
              })}
            />
          ) : null}

          {s.education.length ? (
            <Section
              style={section}
              heading={heading(t.education)}
              blocks={s.education.map((e) => {
                const base = `education.${e.id}`;
                // Une formation ne se coupe jamais : un seul bloc, puces comprises.
                return {
                  key: e.id,
                  style: entry,
                  content: (
                    <>
                      <View style={row}>
                        <Text edit={`${base}.${e.degree ? "degree" : "school"}`} style={[BOLD, { flex: 1 }]}>
                          {e.degree || e.school}
                        </Text>
                        <Dates base={base} start={e.startDate} end={e.endDate} style={dates} />
                      </View>
                      {e.degree && e.school ? (
                        <Text edit={`${base}.school`} style={{ color: accent }}>
                          {e.school}
                        </Text>
                      ) : null}
                      {e.honors ? (
                        <Text edit={`${base}.honors`} style={muted}>
                          {e.honors}
                        </Text>
                      ) : null}
                      {bulletRows(base, e.bullets, accent)}
                    </>
                  ),
                };
              })}
            />
          ) : null}

          {s.projects.length ? (
            <Section
              style={section}
              heading={heading(t.projects)}
              blocks={s.projects.map((p) => ({
                key: p.id,
                style: entry,
                content: (
                  <>
                    <View style={row}>
                      <Text edit={`projects.${p.id}.name`} style={[BOLD, { flex: 1 }]}>
                        {p.name}
                      </Text>
                      {p.link ? (
                        <Link src={absolute(p.link)} edit={`projects.${p.id}.link`} style={[muted, { marginLeft: 8, textDecoration: "none" }]}>
                          {displayUrl(p.link)}
                        </Link>
                      ) : null}
                    </View>
                    {p.description ? <Paragraph edit={`projects.${p.id}.description`}>{p.description}</Paragraph> : null}
                  </>
                ),
              }))}
            />
          ) : null}

          {s.certifications.length ? (
            <Section
              style={section}
              heading={heading(t.certifications)}
              blocks={s.certifications.map((c) => ({
                key: c.id,
                style: [row, { marginTop: 3 }],
                content: (
                  <>
                    <Text style={{ flex: 1 }}>
                      <Text edit={`certifications.${c.id}.name`} style={BOLD}>
                        {c.name}
                      </Text>
                      {c.issuer ? "\u00A0· " : ""}
                      {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
                    </Text>
                    {c.date ? (
                      <Text edit={`certifications.${c.id}.date`} style={dates}>
                        {c.date}
                      </Text>
                    ) : null}
                  </>
                ),
              }))}
            />
          ) : null}
        </View>

        <View style={{ width: LATERAL_SIDE, paddingHorizontal: SIDE_PADDING }}>
          {photo ? (
            <Photo src={photo} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, objectFit: "cover", alignSelf: "center" }} />
          ) : null}
          {items.length ? (
            <Section
              style={photo ? sideSection : undefined}
              heading={sideHeading(t.contact)}
              blocks={items.map((c) => line(c.field, <Contact item={c} display={contactDisplay(c, settings, LATERAL_SIDE - 2 * SIDE_PADDING, CONTACT_SIZE)} style={{ fontSize: CONTACT_SIZE, color: INK }} />))}
            />
          ) : null}
          {s.skills.length ? (
            <Section
              style={photo || items.length ? sideSection : undefined}
              heading={sideHeading(t.skills)}
              blocks={s.skills.map((k) =>
                line(
                  k.id,
                  <Text>
                    <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name, true)}>
                      {k.name}
                    </Text>
                    {k.level ? <Text style={muted}>{`\u00A0· ${levelLabel(k.level)}`}</Text> : null}
                  </Text>,
                ),
              )}
            />
          ) : null}
          {s.languages.length ? (
            <Section
              style={photo || items.length || s.skills.length ? sideSection : undefined}
              heading={sideHeading(t.languages)}
              blocks={s.languages.map((l) =>
                line(
                  l.id,
                  <Text>
                    <Text edit={`languages.${l.id}.name`} style={BOLD}>
                      {l.name}
                    </Text>
                    {l.level ? t.colon : ""}
                    {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
                  </Text>,
                ),
              )}
            />
          ) : null}
          {s.hasInterests ? (
            <Section style={photo || items.length || s.skills.length || s.languages.length ? sideSection : undefined} heading={sideHeading(t.interests)}>
              <Text edit="interests" multiline>
                {data.interests}
              </Text>
            </Section>
          ) : null}
        </View>
      </View>
    </ModelPage>
  );
}
