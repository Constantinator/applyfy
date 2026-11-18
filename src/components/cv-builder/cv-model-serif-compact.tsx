"use client";

import { useContext } from "react";

import { displayUrl, type CvData } from "@/lib/cv-builder-types";

import { ColumnDates, DatedRow, INK, ModelContacts, ModelPage, MUTED, type ModelSettings } from "./cv-model-kit";
import { DensityContext, Link, Photo, Text, View } from "./cv-primitives";
import {
  absolute,
  BOLD,
  BulletRow,
  bulletLines,
  contacts,
  entryBlocks,
  InlineSkills,
  ITALIC,
  Name,
  PAGE_WIDTH,
  Paragraph,
  readableOn,
  Section,
  sections,
  TitlesContext,
} from "./cv-templates";

// Modèle « serif-compact » : très dense. En-tête centré (nom en accent, coordonnées sur une ligne, photo
// ronde facultative à droite) sur un filet d'accent ; dates dans une colonne à gauche pour les
// expériences, la formation et les certifications. Tailles en points pour le corps par défaut (8,7 pt,
// Gelasio, interligne 1,32), converties de la maquette (794 px = A4, 1 px = 0,75 pt).

/** Photo ronde de l'en-tête (66 px), et espace qui la sépare des coordonnées. */
const PHOTO_SIZE = 49.5;
const PHOTO_GAP = 12;
/** Colonne des dates (86 px). */
const DATES_WIDTH = 64.5;

function Heading({ children, color }: { children: string; color: string }) {
  return (
    <View style={{ borderBottomWidth: 0.5, borderColor: color, paddingBottom: 1.5, marginBottom: 3 }}>
      <Text style={[BOLD, { fontSize: 8.7, lineHeight: 1.2, textTransform: "uppercase", color }]}>{children}</Text>
    </View>
  );
}

/** Puces serrées : 2,5 pt au-dessus de la première, 0,75 pt entre deux. */
function compactBullets(base: string, items: string[]) {
  return bulletLines(items).map((b, i) => <BulletRow key={b.index} base={base} index={b.index} text={b.text} top={i === 0 ? 2.5 : 0.75} color={INK} />);
}

export function SerifCompact({ data, settings }: { data: CvData; settings: ModelSettings }) {
  const t = useContext(TitlesContext);
  const s = sections(data);
  const items = contacts(data);
  const photo = data.personal.photo;
  // L'accent choisi, foncé si besoin pour rester lisible sur le blanc (contraste 4,5:1).
  const accent = readableOn(settings.accent, "#FFFFFF");
  const muted = { color: MUTED };
  const section = { marginTop: 8 };
  const entry = { marginTop: 4.5 };
  const dates = [ITALIC, muted, { fontSize: 8.25 }];
  const heading = (title: string) => <Heading color={accent}>{title}</Heading>;
  const width = PAGE_WIDTH - 2 * settings.horizontal;

  return (
    <ModelPage settings={settings} lineHeight={1.32}>
      {/* En-tête centré sur la page, avec ou sans photo : la photo est posée à droite, hors du flux
          (position absolue, en points exacts), et l'en-tête garde au moins sa hauteur. */}
      <DensityContext value={1}>
        <View style={{ minHeight: photo ? PHOTO_SIZE : 0, justifyContent: "center" }}>
          <DensityContext value={settings.factor}>
            <Name data={data} style={[BOLD, { fontSize: 18.75, lineHeight: 1.15, color: accent, textAlign: "center" }]} />
            {data.personal.jobTitle ? (
              <Text edit="personal.jobTitle" style={[ITALIC, { fontSize: 9.75, marginTop: 1, textAlign: "center" }]}>
                {data.personal.jobTitle}
              </Text>
            ) : null}
            {items.length ? (
              // Avec une photo : coordonnées rétrécies des deux côtés, pour rester centrées sans la toucher.
              <View style={{ paddingHorizontal: photo ? PHOTO_SIZE + PHOTO_GAP : 0 }}>
                <ModelContacts items={items} settings={settings} width={width - (photo ? 2 * (PHOTO_SIZE + PHOTO_GAP) : 0)} size={8.25} center top={3} margin={4} style={muted} />
              </View>
            ) : null}
          </DensityContext>
          {photo ? (
            <Photo src={photo} style={{ position: "absolute", top: 0, right: 0, width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, objectFit: "cover" }} />
          ) : null}
        </View>
      </DensityContext>
      <View style={{ borderBottomWidth: 1.125, borderColor: accent, marginTop: 6 }} />

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
              <Text>
                {e.position ? (
                  <Text edit={`${base}.position`} style={BOLD}>
                    {e.position}
                  </Text>
                ) : null}
                {e.position && e.company ? ", " : null}
                {e.company ? (
                  <Text edit={`${base}.company`} style={e.position ? ITALIC : BOLD}>
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
            return entryBlocks(e.id, head, compactBullets(base, e.bullets), (part, content) =>
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
              style: { marginTop: 3 },
              content: (
                <DatedRow width={DATES_WIDTH} side={<ColumnDates base={base} start={e.startDate} end={e.endDate} style={dates} />}>
                  <Text>
                    {e.degree ? (
                      <Text edit={`${base}.degree`} style={BOLD}>
                        {e.degree}
                      </Text>
                    ) : null}
                    {e.degree && e.school ? ", " : null}
                    {e.school ? (
                      <Text edit={`${base}.school`} style={e.degree ? ITALIC : BOLD}>
                        {e.school}
                      </Text>
                    ) : null}
                  </Text>
                  {e.honors ? (
                    <Text edit={`${base}.honors`} style={muted}>
                      {e.honors}
                    </Text>
                  ) : null}
                  {compactBullets(base, e.bullets)}
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
                    <Link src={absolute(p.link)} edit={`projects.${p.id}.link`} style={[ITALIC, muted, { marginLeft: 8, textDecoration: "none" }]}>
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
            style: { marginTop: 2 },
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
                  {c.issuer ? ", " : ""}
                  {c.issuer ? (
                    <Text edit={`certifications.${c.id}.issuer`} style={ITALIC}>
                      {c.issuer}
                    </Text>
                  ) : null}
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
