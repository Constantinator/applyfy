"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  displayUrl,
  interestList,
  SKILL_LEVELS,
  skillLevelValue,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";

import { Link, Page, Photo, Text, View, type StyleProp } from "./cv-primitives";

// Les 5 modèles du CV Builder, écrits une fois avec les briques de cv-primitives : rendus
// en PDF (téléchargement) et en HTML modifiable (aperçu de l'éditeur). Chaque texte relié
// à un champ porte `edit` : il se modifie directement dans l'aperçu.

const BOLD = { fontWeight: "bold" };

/** Alignement des paragraphes et des puces (réglage « Alignement » de l'éditeur). */
const AlignContext = createContext<"left" | "justify">("left");

/** Paragraphe modifiable (profil, description de projet), à l'alignement choisi. */
function Paragraph({ edit, children, style }: { edit: string; children: string; style?: StyleProp }) {
  const align = useContext(AlignContext);
  return (
    <Text edit={edit} multiline style={[{ textAlign: align }, ...(Array.isArray(style) ? style : [style])]}>
      {children}
    </Text>
  );
}
const levelLabel = (level: string) => SKILL_LEVELS.find((l) => l.value === level && l.value)?.label ?? "";

type ContactItem = { field: "email" | "phone" | "city" | "linkedin" | "website" | "github"; label: string; href?: string };

function contacts(data: CvData): ContactItem[] {
  const p = data.personal;
  const items: (ContactItem | false)[] = [
    !!p.email && { field: "email", label: p.email, href: `mailto:${p.email}` },
    !!p.phone && { field: "phone", label: p.phone },
    !!p.city && { field: "city", label: p.city },
    !!p.linkedin && { field: "linkedin", label: displayUrl(p.linkedin), href: p.linkedin },
    !!p.website && { field: "website", label: displayUrl(p.website), href: p.website },
    !!p.github && { field: "github", label: displayUrl(p.github), href: p.github },
  ];
  return items.filter((c): c is ContactItem => c !== false);
}

const absolute = (href: string) => (/^(https?:|mailto:)/i.test(href) ? href : `https://${href}`);

/** Coordonnée : lien cliquable dans le PDF, sans soulignement. */
function Contact({ item, style }: { item: ContactItem; style?: StyleProp }) {
  const edit = `personal.${item.field}`;
  if (!item.href) {
    return (
      <Text edit={edit} style={style}>
        {item.label}
      </Text>
    );
  }
  return (
    <Link src={absolute(item.href)} edit={edit} style={[{ textDecoration: "none" }, ...(Array.isArray(style) ? style : [style])]}>
      {item.label}
    </Link>
  );
}

/** « Prénom Nom », chaque partie modifiable. */
function Name({ data, style }: { data: CvData; style?: StyleProp }) {
  return (
    <Text style={style}>
      <Text edit="personal.firstName" placeholder="Prénom">
        {data.personal.firstName}
      </Text>{" "}
      <Text edit="personal.lastName" placeholder="Nom">
        {data.personal.lastName}
      </Text>
    </Text>
  );
}

/** « 09/2022 – Aujourd'hui », début et fin modifiables. */
function Dates({ base, start, end, current, style }: { base: string; start: string; end?: string; current?: boolean; style?: StyleProp }) {
  const hasEnd = current || !!end?.trim();
  if (!start.trim() && !hasEnd) return null;
  return (
    <Text style={style}>
      {start.trim() ? <Text edit={`${base}.startDate`}>{start}</Text> : null}
      {start.trim() && hasEnd ? " – " : null}
      {current ? "Aujourd'hui" : end?.trim() ? <Text edit={`${base}.endDate`}>{end}</Text> : null}
    </Text>
  );
}

function Bullets({ base, items, color, style }: { base: string; items: string[]; color?: string; style?: StyleProp }) {
  const align = useContext(AlignContext);
  const lines = items.map((text, index) => ({ text, index })).filter((b) => b.text.trim());
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 3 }}>
      {lines.map((b) => (
        <View key={b.index} style={{ flexDirection: "row", marginTop: 1.5 }} wrap={false}>
          <Text style={[{ width: 10, color: color ?? "#111827" }, ...(Array.isArray(style) ? style : [style])]}>•</Text>
          <Text edit={`${base}.bullets.${b.index}`} style={[{ flex: 1, textAlign: align }, ...(Array.isArray(style) ? style : [style])]}>
            {b.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Contenu des sections, dans l'ordre d'affichage (éléments vides masqués). */
function sectionsOf(data: CvData) {
  return {
    summary: data.summary.trim() ? data.summary : "",
    experiences: data.experiences.filter((e) => e.position || e.company),
    education: data.education.filter((e) => e.school || e.degree),
    skills: data.skills.filter((s) => s.name.trim()),
    languages: data.languages.filter((l) => l.name.trim()),
    certifications: data.certifications.filter((c) => c.name.trim()),
    projects: data.projects.filter((p) => p.name.trim()),
    hasInterests: interestList(data).length > 0,
  };
}

/** Liste à puces : un élément par ligne, rendu par `render`. */
function ItemList<T extends { id: string }>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  return (
    <View>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: "row", marginTop: 1.5 }} wrap={false}>
          <Text style={{ width: 10 }}>•</Text>
          <Text style={{ flex: 1 }}>{render(item)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Modèles à une colonne : minimaliste, classique, moderne bleu, tech
// ---------------------------------------------------------------------------

type Theme = {
  accent: string;
  muted: string;
  headerAlign: "left" | "center";
  Heading: (props: { children: string }) => ReactNode;
};

function SingleColumn({ data, theme, variant }: { data: CvData; theme: Theme; variant: CvTemplateId }) {
  const s = sectionsOf(data);
  const items = contacts(data);
  const center = theme.headerAlign === "center";
  const photo = (variant === "moderne" || variant === "tech") && data.personal.photo;
  const muted = { color: theme.muted };
  const section = { marginTop: 12 };
  const entry = { marginTop: 7 };
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const Heading = theme.Heading;

  // Tech : GitHub et portfolio mis en avant sous l'en-tête, retirés des coordonnées.
  const highlighted = variant === "tech" ? items.filter((c) => c.field === "github" || c.field === "website") : [];
  const headerContacts = items.filter((c) => !highlighted.includes(c));

  return (
    <Page style={{ fontFamily: data.style.font, fontSize: 9.5, lineHeight: 1.4, color: "#111827", paddingVertical: 36, paddingHorizontal: 42 }}>
      <View style={[row, { alignItems: "center" }]}>
        <View style={{ flex: 1, textAlign: theme.headerAlign }}>
          <Name
            data={data}
            style={[
              BOLD,
              { fontSize: 22, lineHeight: 1.15, color: variant === "moderne" ? theme.accent : "#111827" },
              center && { textTransform: "uppercase" },
            ]}
          />
          {data.personal.jobTitle ? (
            <Text edit="personal.jobTitle" style={{ fontSize: 11.5, marginTop: 3, color: variant === "tech" ? theme.accent : "#374151" }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}
          {headerContacts.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start", marginTop: 6 }}>
              {headerContacts.map((c, i) => (
                <View key={c.field} style={{ flexDirection: "row" }}>
                  {i > 0 && <Text style={[muted, { marginHorizontal: 5 }]}>·</Text>}
                  <Contact item={c} style={[muted, { fontSize: 9 }]} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {photo ? <Photo src={photo} style={{ width: 72, height: 72, borderRadius: 36, objectFit: "cover", marginLeft: 16 }} /> : null}
      </View>

      {highlighted.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
          {highlighted.map((c) => (
            <View
              key={c.field}
              style={{ flexDirection: "row", marginRight: 8, marginTop: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7 }}
            >
              <Text style={[BOLD, { color: theme.accent, fontSize: 8.5, marginRight: 4 }]}>
                {c.field === "github" ? "GitHub" : "Portfolio"}
              </Text>
              <Contact item={c} style={{ fontSize: 8.5, color: "#111827" }} />
            </View>
          ))}
        </View>
      ) : null}

      {variant === "minimaliste" && <View style={{ borderBottomWidth: 0.75, borderColor: "#111827", marginTop: 10 }} />}

      {s.summary ? (
        <View style={section}>
          <Heading>Profil</Heading>
          <Paragraph edit="summary">
            {s.summary}
          </Paragraph>
        </View>
      ) : null}

      {s.experiences.length ? (
        <View style={section}>
          <Heading>Expériences</Heading>
          {s.experiences.map((e) => {
            const base = `experiences.${e.id}`;
            const body = (
              <>
                <View style={row} wrap={false}>
                  <Text style={[BOLD, { flex: 1 }]}>
                    <Text edit={`${base}.position`}>{e.position}</Text>
                    {e.position && e.company ? (variant === "classique" ? ", " : " — ") : null}
                    <Text edit={`${base}.company`}>{e.company}</Text>
                  </Text>
                  <Dates base={base} start={e.startDate} end={e.endDate} current={e.current} style={[muted, { fontSize: 9, marginLeft: 8 }]} />
                </View>
                {e.location ? (
                  <Text edit={`${base}.location`} style={[muted, { fontSize: 9 }]}>
                    {e.location}
                  </Text>
                ) : null}
                <Bullets base={base} items={e.bullets} color={variant === "tech" || variant === "moderne" ? theme.accent : undefined} />
              </>
            );
            if (variant !== "tech") {
              return (
                <View key={e.id} style={entry}>
                  {body}
                </View>
              );
            }
            // Timeline verticale : filet coloré et point devant chaque expérience.
            return (
              <View key={e.id} style={{ paddingLeft: 14, paddingTop: 5, paddingBottom: 4, borderLeftWidth: 1.5, borderColor: "#A7F3D0", marginLeft: 4 }}>
                <View style={{ position: "absolute", left: -5.25, top: 8, width: 9, height: 9, borderRadius: 4.5, backgroundColor: theme.accent }} />
                {body}
              </View>
            );
          })}
        </View>
      ) : null}

      {s.education.length ? (
        <View style={section}>
          <Heading>Formation</Heading>
          {s.education.map((e) => {
            const base = `education.${e.id}`;
            return (
              <View key={e.id} style={entry} wrap={false}>
                <View style={row}>
                  <Text edit={`${base}.${e.degree ? "degree" : "school"}`} style={[BOLD, { flex: 1 }]}>
                    {e.degree || e.school}
                  </Text>
                  <Dates base={base} start={e.startDate} end={e.endDate} style={[muted, { fontSize: 9, marginLeft: 8 }]} />
                </View>
                {e.degree && e.school ? <Text edit={`${base}.school`}>{e.school}</Text> : null}
                {e.honors ? (
                  <Text edit={`${base}.honors`} style={muted}>
                    {e.honors}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {s.skills.length ? (
        <View style={section} wrap={false}>
          <Heading>Compétences</Heading>
          {variant === "tech" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {s.skills.map((k) => (
                <Text
                  key={k.id}
                  style={{ backgroundColor: "#ECFDF5", color: "#065F46", borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 8, marginRight: 5, marginTop: 5, fontSize: 8.5 }}
                >
                  <Text edit={`skills.${k.id}.name`}>{k.name}</Text>
                  {k.level ? ` · ${levelLabel(k.level)}` : ""}
                </Text>
              ))}
            </View>
          ) : variant === "moderne" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {s.skills.map((k) => (
                <View key={k.id} style={{ width: "50%", paddingRight: 12, marginTop: 4 }}>
                  <View style={row}>
                    <Text edit={`skills.${k.id}.name`}>{k.name}</Text>
                    {k.level ? <Text style={[muted, { fontSize: 8.5 }]}>{levelLabel(k.level)}</Text> : null}
                  </View>
                  {k.level ? (
                    <View style={{ height: 3, backgroundColor: "#DBEAFE", borderRadius: 1.5, marginTop: 2 }}>
                      <View style={{ height: 3, width: `${skillLevelValue(k.level) * 25}%`, backgroundColor: theme.accent, borderRadius: 1.5 }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <ItemList
              items={s.skills}
              render={(k) => (
                <>
                  <Text edit={`skills.${k.id}.name`}>{k.name}</Text>
                  {k.level ? ` (${levelLabel(k.level).toLowerCase()})` : ""}
                </>
              )}
            />
          )}
        </View>
      ) : null}

      {s.languages.length ? (
        <View style={section} wrap={false}>
          <Heading>Langues</Heading>
          <ItemList
            items={s.languages}
            render={(l) => (
              <>
                <Text edit={`languages.${l.id}.name`}>{l.name}</Text>
                {l.level ? " : " : ""}
                {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
              </>
            )}
          />
        </View>
      ) : null}

      {s.projects.length ? (
        <View style={section}>
          <Heading>Projets</Heading>
          {s.projects.map((p) => (
            <View key={p.id} style={entry} wrap={false}>
              <View style={row}>
                <Text edit={`projects.${p.id}.name`} style={BOLD}>
                  {p.name}
                </Text>
                {p.link ? (
                  <Link
                    src={absolute(p.link)}
                    edit={`projects.${p.id}.link`}
                    style={{ textDecoration: "none", fontSize: 9, color: variant === "minimaliste" || variant === "classique" ? theme.muted : theme.accent }}
                  >
                    {displayUrl(p.link)}
                  </Link>
                ) : null}
              </View>
              {p.description ? (
                <Paragraph edit={`projects.${p.id}.description`}>
                  {p.description}
                </Paragraph>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {s.certifications.length ? (
        <View style={section} wrap={false}>
          <Heading>Certifications</Heading>
          {s.certifications.map((c) => (
            <View key={c.id} style={[row, { marginTop: 3 }]}>
              <Text style={{ flex: 1 }}>
                <Text edit={`certifications.${c.id}.name`} style={BOLD}>
                  {c.name}
                </Text>
                {c.issuer ? " — " : ""}
                {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
              </Text>
              {c.date ? (
                <Text edit={`certifications.${c.id}.date`} style={[muted, { fontSize: 9 }]}>
                  {c.date}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {s.hasInterests ? (
        <View style={section} wrap={false}>
          <Heading>Centres d&apos;intérêt</Heading>
          <Text edit="interests">{data.interests}</Text>
        </View>
      ) : null}
    </Page>
  );
}

const MINIMALISTE: Theme = {
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ borderBottomWidth: 0.5, borderColor: "#9CA3AF", paddingBottom: 2, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 10.5 }]}>{children}</Text>
    </View>
  ),
};

const CLASSIQUE: Theme = {
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "center",
  Heading: ({ children }) => (
    <View style={{ borderBottomWidth: 1, borderColor: "#111827", paddingBottom: 2, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }]}>{children}</Text>
    </View>
  ),
};

const MODERNE: Theme = {
  accent: "#1E40AF",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ marginBottom: 5 }}>
      <Text style={[BOLD, { fontSize: 11.5, color: "#1E40AF" }]}>{children}</Text>
      <View style={{ height: 2, width: 36, backgroundColor: "#1E40AF", marginTop: 2.5 }} />
    </View>
  ),
};

const TECH: Theme = {
  accent: "#059669",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <View style={{ width: 4, height: 11, backgroundColor: "#059669", borderRadius: 1, marginRight: 6 }} />
      <Text style={[BOLD, { fontSize: 11, letterSpacing: 0.3 }]}>{children}</Text>
    </View>
  ),
};

// ---------------------------------------------------------------------------
// Modèle 4 : sidebar sombre (30 %) + colonne blanche
// ---------------------------------------------------------------------------

const SIDEBAR_BG = "#1E293B";

const SideHeading = ({ children }: { children: string }) => (
  <Text style={[BOLD, { fontSize: 9.5, letterSpacing: 1, color: "#93C5FD", marginTop: 14, marginBottom: 4, textTransform: "uppercase" }]}>
    {children}
  </Text>
);

const MainHeading = ({ children }: { children: string }) => (
  <View style={{ borderBottomWidth: 1, borderColor: "#CBD5E1", paddingBottom: 2, marginBottom: 4, marginTop: 14 }}>
    <Text style={[BOLD, { fontSize: 11.5, color: SIDEBAR_BG }]}>{children}</Text>
  </View>
);

function Sidebar({ data }: { data: CvData }) {
  const s = sectionsOf(data);
  const items = contacts(data);

  return (
    <Page style={{ fontFamily: data.style.font, fontSize: 9.5, lineHeight: 1.4, color: "#111827", paddingVertical: 32 }}>
      {/* Fond de la colonne, répété sur chaque page. */}
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "30%", backgroundColor: SIDEBAR_BG }} />
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: "30%", paddingHorizontal: 18, color: "#F8FAFC" }}>
          {data.personal.photo ? (
            <Photo src={data.personal.photo} style={{ width: 84, height: 84, borderRadius: 42, objectFit: "cover", alignSelf: "center", marginBottom: 6 }} />
          ) : null}
          {items.length ? (
            <>
              <SideHeading>Contact</SideHeading>
              {items.map((c) => (
                <Contact key={c.field} item={c} style={{ color: "#F8FAFC", fontSize: 8.5, marginTop: 2 }} />
              ))}
            </>
          ) : null}
          {s.education.length ? (
            <>
              <SideHeading>Formation</SideHeading>
              {s.education.map((e) => {
                const base = `education.${e.id}`;
                return (
                  <View key={e.id} style={{ marginTop: 4 }} wrap={false}>
                    <Text edit={`${base}.${e.degree ? "degree" : "school"}`} style={[BOLD, { fontSize: 9 }]}>
                      {e.degree || e.school}
                    </Text>
                    {e.degree && e.school ? (
                      <Text edit={`${base}.school`} style={{ fontSize: 8.5 }}>
                        {e.school}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 8, color: "#CBD5E1" }}>
                      <Dates base={base} start={e.startDate} end={e.endDate} />
                      {e.honors && (e.startDate || e.endDate) ? " · " : null}
                      {e.honors ? <Text edit={`${base}.honors`}>{e.honors}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : null}
          {s.skills.length ? (
            <>
              <SideHeading>Compétences</SideHeading>
              {s.skills.map((k) => (
                <View key={k.id} style={{ marginTop: 3 }} wrap={false}>
                  <Text edit={`skills.${k.id}.name`} style={{ fontSize: 8.5 }}>
                    {k.name}
                  </Text>
                  {k.level ? (
                    <View style={{ height: 2.5, backgroundColor: "#334155", borderRadius: 1, marginTop: 1.5 }}>
                      <View style={{ height: 2.5, width: `${skillLevelValue(k.level) * 25}%`, backgroundColor: "#93C5FD", borderRadius: 1 }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
          {s.languages.length ? (
            <>
              <SideHeading>Langues</SideHeading>
              {s.languages.map((l) => (
                <Text key={l.id} style={{ fontSize: 8.5, marginTop: 2 }}>
                  <Text edit={`languages.${l.id}.name`} style={BOLD}>
                    {l.name}
                  </Text>
                  {l.level ? " — " : ""}
                  {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
                </Text>
              ))}
            </>
          ) : null}
          {s.hasInterests ? (
            <>
              <SideHeading>Centres d&apos;intérêt</SideHeading>
              <Text edit="interests" style={{ fontSize: 8.5 }}>
                {data.interests}
              </Text>
            </>
          ) : null}
        </View>

        <View style={{ width: "70%", paddingHorizontal: 26 }}>
          <Name data={data} style={[BOLD, { fontSize: 22, lineHeight: 1.15, color: SIDEBAR_BG }]} />
          {data.personal.jobTitle ? (
            <Text edit="personal.jobTitle" style={{ fontSize: 11.5, color: "#475569", marginTop: 3 }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}
          {s.summary ? (
            <>
              <MainHeading>Profil</MainHeading>
              <Paragraph edit="summary">
                {s.summary}
              </Paragraph>
            </>
          ) : null}
          {s.experiences.length ? (
            <>
              <MainHeading>Expériences</MainHeading>
              {s.experiences.map((e) => {
                const base = `experiences.${e.id}`;
                return (
                  <View key={e.id} style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
                      <Text edit={`${base}.position`} style={[BOLD, { flex: 1 }]}>
                        {e.position}
                      </Text>
                      <Dates base={base} start={e.startDate} end={e.endDate} current={e.current} style={{ color: "#64748B", fontSize: 9, marginLeft: 8 }} />
                    </View>
                    <Text style={{ color: "#475569" }}>
                      <Text edit={`${base}.company`}>{e.company}</Text>
                      {e.company && e.location ? " · " : null}
                      {e.location ? <Text edit={`${base}.location`}>{e.location}</Text> : null}
                    </Text>
                    <Bullets base={base} items={e.bullets} color="#64748B" />
                  </View>
                );
              })}
            </>
          ) : null}
          {s.projects.length ? (
            <>
              <MainHeading>Projets</MainHeading>
              {s.projects.map((p) => (
                <View key={p.id} style={{ marginTop: 5 }} wrap={false}>
                  <Text edit={`projects.${p.id}.name`} style={BOLD}>
                    {p.name}
                  </Text>
                  {p.description ? (
                    <Paragraph edit={`projects.${p.id}.description`}>
                      {p.description}
                    </Paragraph>
                  ) : null}
                  {p.link ? (
                    <Link src={absolute(p.link)} edit={`projects.${p.id}.link`} style={{ textDecoration: "none", fontSize: 9, color: "#475569" }}>
                      {displayUrl(p.link)}
                    </Link>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
          {s.certifications.length ? (
            <>
              <MainHeading>Certifications</MainHeading>
              {s.certifications.map((c) => (
                <Text key={c.id} style={{ marginTop: 2 }}>
                  <Text edit={`certifications.${c.id}.name`} style={BOLD}>
                    {c.name}
                  </Text>
                  {c.issuer || c.date ? " — " : ""}
                  {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
                  {c.issuer && c.date ? ", " : ""}
                  {c.date ? <Text edit={`certifications.${c.id}.date`}>{c.date}</Text> : null}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

/** Les pages du CV dans le modèle choisi (dans un PrimitivesContext PDF ou HTML). */
export function CvPages({ data, templateId }: { data: CvData; templateId: CvTemplateId }) {
  const theme = { minimaliste: MINIMALISTE, classique: CLASSIQUE, moderne: MODERNE, tech: TECH, sidebar: null }[templateId];
  return (
    <AlignContext value={data.style.align}>
      {theme ? <SingleColumn data={data} variant={templateId} theme={theme} /> : <Sidebar data={data} />}
    </AlignContext>
  );
}
