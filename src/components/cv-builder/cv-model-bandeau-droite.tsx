"use client";

import { useContext } from "react";

import { displayUrl, type CvData } from "@/lib/cv-builder-types";

import { bandColors, INK, ModelContacts, ModelPage, MUTED, type ModelSettings } from "./cv-model-kit";
import { DensityContext, Link, Photo, Text, View } from "./cv-primitives";
import {
  absolute,
  BOLD,
  bulletRows,
  contacts,
  Dates,
  entryBlocks,
  InlineSkills,
  Name,
  PAGE_WIDTH,
  Paragraph,
  readableOn,
  Section,
  sections,
  TitlesContext,
} from "./cv-templates";

// Modèle « bandeau-droite » : bandeau d'accent pleine largeur en haut de la première page (nom, titre,
// coordonnées, photo ronde facultative à droite), puis une colonne aux dates à droite ; compétences et
// langues côte à côte en bas. Tailles en points pour le corps par défaut (9 pt, Arimo), converties de
// la maquette (794 px = A4, 1 px = 0,75 pt).

/** Photo ronde du bandeau (96 px), et espace qui la sépare du texte. */
const PHOTO_SIZE = 72;
const PHOTO_GAP = 18;

function Heading({ children, color }: { children: string; color: string }) {
  return (
    <View style={{ borderBottomWidth: 1.5, borderColor: color, paddingBottom: 2, marginBottom: 5 }}>
      <Text style={[BOLD, { fontSize: 9.75, lineHeight: 1.2, textTransform: "uppercase", color }]}>{children}</Text>
    </View>
  );
}

export function BandeauDroite({ data, settings }: { data: CvData; settings: ModelSettings }) {
  const t = useContext(TitlesContext);
  const s = sections(data);
  const items = contacts(data);
  const photo = data.personal.photo;
  // Bandeau : texte blanc ou sombre selon l'accent, contraste d'au moins 4,5:1 (cf. bandColors).
  const band = bandColors(settings.accent);
  const onBand = { color: band.text };
  // Titres : l'accent, foncé si besoin pour rester lisible sur le blanc.
  const accent = readableOn(settings.accent, "#FFFFFF");
  const muted = { color: MUTED };
  const section = { marginTop: 12 };
  const entry = { marginTop: 7 };
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const dates = [muted, { marginLeft: 8 }];
  const heading = (title: string) => <Heading color={accent}>{title}</Heading>;

  return (
    <ModelPage settings={settings} lineHeight={1.4}>
      {/* Premier bloc du flux : le bandeau n'existe qu'en haut de la première page. Il recouvre les marges
          de la page (marges négatives, en points exacts : hors de l'échelle de la taille du texte). */}
      <DensityContext value={1}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: -settings.vertical,
            marginHorizontal: -settings.horizontal,
            paddingHorizontal: settings.horizontal,
            paddingVertical: 22,
            backgroundColor: band.background,
          }}
        >
          <DensityContext value={settings.factor}>
            <View style={{ flex: 1 }}>
              <Name data={data} style={[BOLD, onBand, { fontSize: 23.25, lineHeight: 1.15 }]} />
              {data.personal.jobTitle ? (
                <Text edit="personal.jobTitle" style={[onBand, { fontSize: 11.25, marginTop: 2 }]}>
                  {data.personal.jobTitle}
                </Text>
              ) : null}
              {items.length ? (
                <ModelContacts
                  items={items}
                  settings={settings}
                  width={PAGE_WIDTH - 2 * settings.horizontal - (photo ? PHOTO_SIZE + PHOTO_GAP : 0)}
                  size={8.6}
                  top={6}
                  style={onBand}
                />
              ) : null}
            </View>
            {photo ? (
              <Photo src={photo} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, objectFit: "cover", marginLeft: PHOTO_GAP }} />
            ) : null}
          </DensityContext>
        </View>
      </DensityContext>

      {s.summary ? (
        <Section style={{ marginTop: 14 }} heading={heading(t.profile)}>
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
                  <Text style={muted}>
                    {e.position && e.company ? <Text edit={`${base}.company`}>{e.company}</Text> : null}
                    {/* Espace insécable avant « · » : le séparateur ne commence jamais une ligne. */}
                    {e.position && e.company && e.location ? " · " : null}
                    {e.location ? <Text edit={`${base}.location`}>{e.location}</Text> : null}
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
              style: { marginTop: 4 },
              content: (
                <>
                  <View style={row}>
                    <Text style={{ flex: 1 }}>
                      {e.degree ? (
                        <Text edit={`${base}.degree`} style={BOLD}>
                          {e.degree}
                        </Text>
                      ) : null}
                      {e.degree && e.school ? " · " : null}
                      {e.school ? (
                        <Text edit={`${base}.school`} style={e.degree ? undefined : BOLD}>
                          {e.school}
                        </Text>
                      ) : null}
                    </Text>
                    <Dates base={base} start={e.startDate} end={e.endDate} style={dates} />
                  </View>
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
                  {c.issuer ? " · " : ""}
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

      {s.hasInterests ? (
        <Section style={section} heading={heading(t.interests)}>
          <Text edit="interests" multiline>
            {data.interests}
          </Text>
        </Section>
      ) : null}

      {/* Compétences et langues côte à côte, en bas : un seul bloc, jamais coupé entre deux pages.
          Dans le fichier, les compétences précèdent les langues (ordre de lecture d'un ATS). */}
      {s.skills.length || s.languages.length ? (
        <View style={[section, { flexDirection: "row" }]} wrap={false}>
          {s.skills.length ? (
            <View style={s.languages.length ? { width: "50%", paddingRight: 12 } : { width: "100%" }}>
              {heading(t.skills)}
              <InlineSkills skills={s.skills} />
            </View>
          ) : null}
          {s.languages.length ? (
            <View style={s.skills.length ? { width: "50%", paddingLeft: 12 } : { width: "100%" }}>
              {heading(t.languages)}
              {s.languages.map((l) => (
                <Text key={l.id} style={{ marginTop: 1.5, color: INK }}>
                  <Text edit={`languages.${l.id}.name`} style={BOLD}>
                    {l.name}
                  </Text>
                  {l.level ? t.colon : ""}
                  {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ModelPage>
  );
}
