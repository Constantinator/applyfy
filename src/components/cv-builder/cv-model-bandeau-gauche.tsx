"use client";

import { useContext } from "react";

import { displayUrl, type CvData } from "@/lib/cv-builder-types";

import { bandColors, ColumnDates, DatedRow, ModelContacts, ModelPage, MUTED, type ModelSettings } from "./cv-model-kit";
import { DensityContext, Link, Photo, Text, View } from "./cv-primitives";
import {
  absolute,
  BOLD,
  bulletRows,
  contacts,
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

// Modèle « bandeau-gauche » : bandeau d'accent pleine largeur en haut de la première page (nom, titre,
// coordonnées sur une ligne, petite photo ronde facultative à droite), puis une colonne de dates à gauche
// pour les expériences, la formation et les certifications. Tailles en points pour le corps par défaut
// (9 pt, Arimo), converties de la maquette (794 px = A4, 1 px = 0,75 pt).

/** Photo ronde du bandeau (78 px) avec son anneau, et espace qui la sépare du texte. */
const PHOTO_SIZE = 58.5;
const PHOTO_RING = 1.5;
const PHOTO_GAP = 16;
/** Colonne des dates (96 px). */
const DATES_WIDTH = 72;

function Heading({ children, color }: { children: string; color: string }) {
  return (
    <View style={{ borderBottomWidth: 0.75, borderColor: color, paddingBottom: 2, marginBottom: 5 }}>
      <Text style={[BOLD, { fontSize: 9.4, lineHeight: 1.2, textTransform: "uppercase", color }]}>{children}</Text>
    </View>
  );
}

export function BandeauGauche({ data, settings }: { data: CvData; settings: ModelSettings }) {
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
  const dates = [muted, { fontSize: 8.25 }];
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
            paddingVertical: 20,
            backgroundColor: band.background,
          }}
        >
          <DensityContext value={settings.factor}>
            <View style={{ flex: 1 }}>
              <Name data={data} style={[BOLD, onBand, { fontSize: 21.75, lineHeight: 1.15 }]} />
              {data.personal.jobTitle ? (
                <Text edit="personal.jobTitle" style={[onBand, { fontSize: 10.5, marginTop: 2 }]}>
                  {data.personal.jobTitle}
                </Text>
              ) : null}
              {items.length ? (
                <ModelContacts
                  items={items}
                  settings={settings}
                  width={PAGE_WIDTH - 2 * settings.horizontal - (photo ? PHOTO_SIZE + PHOTO_GAP : 0)}
                  size={9}
                  top={5}
                  style={onBand}
                />
              ) : null}
            </View>
            {photo ? (
              // Anneau fin de la couleur du texte du bandeau (blanc sur un accent foncé) autour de la photo.
              <View
                style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  borderRadius: PHOTO_SIZE / 2,
                  backgroundColor: band.text,
                  marginLeft: PHOTO_GAP,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Photo
                  src={photo}
                  style={{ width: PHOTO_SIZE - 2 * PHOTO_RING, height: PHOTO_SIZE - 2 * PHOTO_RING, borderRadius: PHOTO_SIZE / 2 - PHOTO_RING, objectFit: "cover" }}
                />
              </View>
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
              <Text>
                {e.position ? (
                  <Text edit={`${base}.position`} style={BOLD}>
                    {e.position}
                  </Text>
                ) : null}
                {/* Espace insécable avant « · » : le séparateur ne commence jamais une ligne. */}
                {e.position && e.company ? "\u00A0· " : null}
                {e.company ? (
                  <Text edit={`${base}.company`} style={e.position ? undefined : BOLD}>
                    {e.company}
                  </Text>
                ) : null}
                {e.location ? <Text style={muted}>{", "}</Text> : null}
                {e.location ? (
                  <Text edit={`${base}.location`} style={muted}>
                    {e.location}
                  </Text>
                ) : null}
              </Text>
            );
            const side = <ColumnDates base={base} start={e.startDate} end={e.endDate} current={e.current} style={dates} />;
            // Les dates accompagnent le début de l'expérience ; la suite d'une expérience coupée garde le retrait.
            return entryBlocks(e.id, head, bulletRows(base, e.bullets, accent), (part, content) =>
              part === "only" || part === "first"
                ? { style: entry, content: <DatedRow width={DATES_WIDTH} side={side}>{content}</DatedRow> }
                : { style: { paddingLeft: DATES_WIDTH }, content },
            );
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
              style: { marginTop: 5 },
              content: (
                <DatedRow width={DATES_WIDTH} side={<ColumnDates base={base} start={e.startDate} end={e.endDate} style={dates} />}>
                  <Text>
                    {e.degree ? (
                      <Text edit={`${base}.degree`} style={BOLD}>
                        {e.degree}
                      </Text>
                    ) : null}
                    {e.degree && e.school ? "\u00A0· " : null}
                    {e.school ? (
                      <Text edit={`${base}.school`} style={e.degree ? undefined : BOLD}>
                        {e.school}
                      </Text>
                    ) : null}
                  </Text>
                  {e.honors ? (
                    <Text edit={`${base}.honors`} style={muted}>
                      {e.honors}
                    </Text>
                  ) : null}
                  {bulletRows(base, e.bullets, accent)}
                </DatedRow>
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
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
            style: { marginTop: 3 },
            content: (
              <DatedRow
                width={DATES_WIDTH}
                side={
                  c.date ? (
                    <Text edit={`certifications.${c.id}.date`} style={dates}>
                      {c.date}
                    </Text>
                  ) : null
                }
              >
                <Text>
                  <Text edit={`certifications.${c.id}.name`} style={BOLD}>
                    {c.name}
                  </Text>
                  {c.issuer ? "\u00A0· " : ""}
                  {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
                </Text>
              </DatedRow>
            ),
          }))}
        />
      ) : null}

      {s.skills.length ? (
        <Section style={section} heading={heading(t.skills)}>
          <InlineSkills skills={s.skills} />
        </Section>
      ) : null}

      {/* Langues sur une ligne : « Français — Natif · Anglais — Courant ». */}
      {s.languages.length ? (
        <Section style={section} heading={heading(t.languages)}>
          <Text style={{ marginTop: 1.5 }}>
            {s.languages.map((l, i) => (
              <Text key={l.id}>
                {i > 0 ? "\u00A0· " : ""}
                <Text edit={`languages.${l.id}.name`} style={BOLD}>
                  {l.name}
                </Text>
                {/* Tiret plutôt que parenthèses : un niveau comme « Courant (TOEIC 915) » en a déjà. */}
                {l.level ? " — " : ""}
                {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
              </Text>
            ))}
          </Text>
        </Section>
      ) : null}

      {s.hasInterests ? (
        <Section style={section} heading={heading(t.interests)}>
          <Text edit="interests" multiline>
            {data.interests}
          </Text>
        </Section>
      ) : null}
    </ModelPage>
  );
}
