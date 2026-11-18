"use client";

import { useContext } from "react";

import { displayUrl, type CvData } from "@/lib/cv-builder-types";

import { INK, ModelContacts, ModelPage, MUTED, type ModelSettings } from "./cv-model-kit";
import { Link, Text, View } from "./cv-primitives";
import {
  absolute,
  BOLD,
  bulletRows,
  contacts,
  Dates,
  entryBlocks,
  FinanceLine,
  ITALIC,
  joined,
  Name,
  PAGE_WIDTH,
  Paragraph,
  readableOn,
  Section,
  sections,
  skillGroupDisplay,
  skillRows,
  TitlesContext,
  useLevelLabel,
} from "./cv-templates";

// Modèle « serif-centre » : en-tête centré sur un filet d'accent, titres de section centrés sur un filet
// beige, dates en italique à droite. Une colonne, fond blanc, pas de photo. Tailles en points pour le
// corps par défaut (10,5 pt, EB Garamond), converties de la maquette (794 px = A4, 1 px = 0,75 pt).

const RULE = "#D9CFC0";

function Heading({ children, color }: { children: string; color: string }) {
  return (
    <View style={{ borderBottomWidth: 0.75, borderColor: RULE, paddingBottom: 3, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 12, lineHeight: 1.2, color, textAlign: "center" }]}>{children}</Text>
    </View>
  );
}

/**
 * Compétences en lignes « Étiquette : valeurs » : les compétences simples à la suite après « Compétences : »,
 * un groupe (« Outils : a, b ») sur sa propre ligne. Un seul paragraphe où chaque compétence garde sa
 * place quel que soit son type (seul le séparateur change) : le champ en cours de saisie n'est jamais
 * recréé quand une compétence devient un groupe.
 */
function SkillLines({ skills }: { skills: CvData["skills"] }) {
  const t = useContext(TitlesContext);
  const levelLabel = useLevelLabel();
  const rows = skillRows(skills);
  return (
    <Text style={{ marginTop: 1 }}>
      {rows.length && !rows[0].group ? (
        <Text style={BOLD}>
          {t.skills}
          {t.colon}
        </Text>
      ) : null}
      {rows.map(({ skill: k, group }, i) => (
        <Text key={k.id}>
          {i === 0 ? "" : group || rows[i - 1].group ? "\n" : ", "}
          <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name)}>
            {k.name}
          </Text>
          {k.level ? ` (${levelLabel(k.level).toLowerCase()})` : ""}
        </Text>
      ))}
    </Text>
  );
}

export function SerifCentre({ data, settings }: { data: CvData; settings: ModelSettings }) {
  const t = useContext(TitlesContext);
  const s = sections(data);
  const items = contacts(data);
  // L'accent choisi, foncé si besoin pour rester lisible sur le blanc (contraste 4,5:1).
  const accent = readableOn(settings.accent, "#FFFFFF");
  const muted = { color: MUTED };
  const section = { marginTop: 12 };
  const entry = { marginTop: 7 };
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const dates = [ITALIC, muted, { marginLeft: 8 }];
  const heading = (title: string) => <Heading color={accent}>{title}</Heading>;

  return (
    <ModelPage settings={settings} lineHeight={1.3}>
      <Name data={data} style={[BOLD, { fontSize: 25.5, lineHeight: 1.15, color: accent, textAlign: "center" }]} />
      {data.personal.jobTitle ? (
        <Text edit="personal.jobTitle" style={[ITALIC, { fontSize: 12, marginTop: 2, color: "#374151", textAlign: "center" }]}>
          {data.personal.jobTitle}
        </Text>
      ) : null}
      {items.length ? (
        <ModelContacts items={items} settings={settings} width={PAGE_WIDTH - 2 * settings.horizontal} size={9.75} center top={5} style={muted} />
      ) : null}
      <View style={{ borderBottomWidth: 1.5, borderColor: accent, marginTop: 9 }} />

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
            const place = e.company || e.location;
            const head = (
              <>
                <View style={row}>
                  {place ? (
                    <Text style={[BOLD, { flex: 1 }]}>
                      <Text edit={`${base}.company`}>{e.company}</Text>
                      {e.company && e.location ? ", " : null}
                      {e.location ? <Text edit={`${base}.location`}>{e.location}</Text> : null}
                    </Text>
                  ) : (
                    <Text edit={`${base}.position`} style={[BOLD, { flex: 1 }]}>
                      {e.position}
                    </Text>
                  )}
                  <Dates base={base} start={e.startDate} end={e.endDate} current={e.current} style={dates} />
                </View>
                {place && e.position ? (
                  <Text edit={`${base}.position`} style={ITALIC}>
                    {e.position}
                  </Text>
                ) : null}
              </>
            );
            return entryBlocks(e.id, head, bulletRows(base, e.bullets, INK), (part, content) => ({
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
                    <Text style={{ flex: 1 }}>
                      {e.school ? (
                        <Text edit={`${base}.school`} style={BOLD}>
                          {e.school}
                        </Text>
                      ) : null}
                      {e.school && e.degree ? ", " : null}
                      {e.degree ? (
                        <Text edit={`${base}.degree`} style={e.school ? undefined : BOLD}>
                          {e.degree}
                        </Text>
                      ) : null}
                    </Text>
                    <Dates base={base} start={e.startDate} end={e.endDate} style={dates} />
                  </View>
                  {e.honors ? (
                    <Text edit={`${base}.honors`} style={[ITALIC, muted]}>
                      {e.honors}
                    </Text>
                  ) : null}
                  {bulletRows(base, e.bullets, INK)}
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

      {/* Lignes « Étiquette : valeurs ». */}
      {s.skills.length || s.languages.length || s.certifications.length || s.hasInterests ? (
        <Section style={section} heading={heading(t.skillsLanguages)}>
          {s.skills.length ? <SkillLines skills={s.skills} /> : null}
          {s.languages.length ? (
            <FinanceLine label={t.languages}>
              {joined(s.languages, (l) => (
                <>
                  <Text edit={`languages.${l.id}.name`}>{l.name}</Text>
                  {/* Tiret plutôt que parenthèses : un niveau comme « Courant (TOEIC 915) » en a déjà. */}
                  {l.level ? " — " : ""}
                  {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
                </>
              ))}
            </FinanceLine>
          ) : null}
          {s.certifications.length ? (
            <FinanceLine label={t.certifications}>
              {joined(s.certifications, (c) => (
                <>
                  <Text edit={`certifications.${c.id}.name`}>{c.name}</Text>
                  {c.issuer || c.date ? " (" : ""}
                  {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
                  {c.issuer && c.date ? ", " : ""}
                  {c.date ? <Text edit={`certifications.${c.id}.date`}>{c.date}</Text> : null}
                  {c.issuer || c.date ? ")" : ""}
                </>
              ))}
            </FinanceLine>
          ) : null}
          {s.hasInterests ? (
            <FinanceLine label={t.interests}>
              <Text edit="interests" multiline>
                {data.interests}
              </Text>
            </FinanceLine>
          ) : null}
        </Section>
      ) : null}
    </ModelPage>
  );
}
