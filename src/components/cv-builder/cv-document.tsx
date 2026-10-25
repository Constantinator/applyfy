"use client";

import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ComponentProps, ReactNode } from "react";

import {
  dateRange,
  displayUrl,
  fullName,
  interestList,
  SKILL_LEVELS,
  skillLevelValue,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";

// Les 5 modèles du CV Builder, rendus en PDF (A4) par @react-pdf/renderer : la
// prévisualisation de l'éditeur est ce même PDF, le téléchargement est donc identique.
// Polices standard du PDF (Helvetica, Times) : texte sélectionnable, lisible par les ATS.

// Pas de césure automatique (règles anglaises par défaut : « dévelop-pement »).
Font.registerHyphenationCallback((word) => [word]);

type Props = { data: CvData; templateId: CvTemplateId; title: string };
type PdfStyle = NonNullable<ComponentProps<typeof View>["style"]>;

const levelLabel = (level: string) => SKILL_LEVELS.find((l) => l.value === level && l.value)?.label ?? "";

function contacts(data: CvData) {
  const p = data.personal;
  return [
    p.email && { label: p.email, href: `mailto:${p.email}` },
    p.phone && { label: p.phone },
    p.city && { label: p.city },
    p.linkedin && { label: displayUrl(p.linkedin), href: p.linkedin },
    p.website && { label: displayUrl(p.website), href: p.website },
    p.github && { label: displayUrl(p.github), href: p.github },
  ].filter(Boolean) as { label: string; href?: string }[];
}

const absolute = (href: string) => (/^(https?:|mailto:)/i.test(href) ? href : `https://${href}`);

/** Lien cliquable dans le PDF, sans soulignement. */
function Contact({ item, style }: { item: { label: string; href?: string }; style?: PdfStyle }) {
  if (!item.href) return <Text style={style}>{item.label}</Text>;
  return (
    <Link src={absolute(item.href)} style={[{ textDecoration: "none" }, style ?? {}]}>
      {item.label}
    </Link>
  );
}

function Bullets({ items, color, style }: { items: string[]; color?: string; style?: PdfStyle }) {
  const lines = items.filter((b) => b.trim());
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 3 }}>
      {lines.map((b, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: 1.5 }} wrap={false}>
          <Text style={[{ width: 10, color: color ?? "#111827" }, style ?? {}]}>•</Text>
          <Text style={[{ flex: 1 }, style ?? {}]}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

/** Contenu des sections, dans l'ordre d'affichage. */
function sectionsOf(data: CvData) {
  return {
    summary: data.summary.trim(),
    experiences: data.experiences.filter((e) => e.position || e.company),
    education: data.education.filter((e) => e.school || e.degree),
    skills: data.skills.filter((s) => s.name.trim()),
    languages: data.languages.filter((l) => l.name.trim()),
    certifications: data.certifications.filter((c) => c.name.trim()),
    projects: data.projects.filter((p) => p.name.trim()),
    interests: interestList(data),
  };
}

// ---------------------------------------------------------------------------
// Modèles à une colonne : minimaliste, classique, moderne bleu, tech
// ---------------------------------------------------------------------------

type Theme = {
  font: string;
  bold: string;
  accent: string;
  muted: string;
  headerAlign: "left" | "center";
  /** Titre de section et son filet. */
  Heading: (props: { children: string }) => ReactNode;
};

function SingleColumn({ data, theme, variant }: { data: CvData; theme: Theme; variant: CvTemplateId }) {
  const s = sectionsOf(data);
  const name = fullName(data) || "Prénom Nom";
  const items = contacts(data);
  const center = theme.headerAlign === "center";
  const photo = (variant === "moderne" || variant === "tech") && data.personal.photo;
  const styles = StyleSheet.create({
    page: { fontFamily: theme.font, fontSize: 9.5, lineHeight: 1.4, color: "#111827", paddingVertical: 36, paddingHorizontal: 42 },
    bold: { fontFamily: theme.bold },
    muted: { color: theme.muted },
    section: { marginTop: 12 },
    entry: { marginTop: 7 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  });
  const Heading = theme.Heading;

  // Tech : GitHub et portfolio mis en avant sous l'en-tête, retirés des coordonnées.
  const highlighted = variant === "tech" ? items.filter((c) => c.href && c.href !== `mailto:${data.personal.email}` && c.href !== data.personal.linkedin) : [];
  const headerContacts = items.filter((c) => !highlighted.includes(c));

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.row, { alignItems: "center" }]}>
        <View style={{ flex: 1, textAlign: theme.headerAlign }}>
          <Text style={[styles.bold, { fontSize: 22, lineHeight: 1.15, color: variant === "moderne" ? theme.accent : "#111827" }]}>
            {center ? name.toUpperCase() : name}
          </Text>
          {data.personal.jobTitle ? (
            <Text style={{ fontSize: 11.5, marginTop: 3, color: variant === "tech" ? theme.accent : "#374151" }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}
          {headerContacts.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start", marginTop: 6 }}>
              {headerContacts.map((c, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  {i > 0 && <Text style={[styles.muted, { marginHorizontal: 5 }]}>·</Text>}
                  <Contact item={c} style={[styles.muted, { fontSize: 9 }]} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf : pas d'attribut alt
          <Image src={photo} style={{ width: 72, height: 72, borderRadius: 36, objectFit: "cover", marginLeft: 16 }} />
        ) : null}
      </View>

      {highlighted.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
          {highlighted.map((c, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", marginRight: 8, marginTop: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7 }}
            >
              <Text style={[styles.bold, { color: theme.accent, fontSize: 8.5, marginRight: 4 }]}>
                {c.href?.includes("github") ? "GitHub" : "Portfolio"}
              </Text>
              <Contact item={c} style={{ fontSize: 8.5, color: "#111827" }} />
            </View>
          ))}
        </View>
      ) : null}

      {variant === "minimaliste" && <View style={{ borderBottomWidth: 0.75, borderColor: "#111827", marginTop: 10 }} />}

      {s.summary ? (
        <View style={styles.section}>
          <Heading>Profil</Heading>
          <Text>{s.summary}</Text>
        </View>
      ) : null}

      {s.experiences.length ? (
        <View style={styles.section}>
          <Heading>Expériences</Heading>
          {s.experiences.map((e) => {
            const body = (
              <>
                <View style={styles.row} wrap={false}>
                  <Text style={[styles.bold, { flex: 1 }]}>
                    {[e.position, e.company].filter(Boolean).join(variant === "classique" ? ", " : " — ")}
                  </Text>
                  <Text style={[styles.muted, { fontSize: 9, marginLeft: 8 }]}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
                </View>
                {e.location ? <Text style={[styles.muted, { fontSize: 9 }]}>{e.location}</Text> : null}
                <Bullets items={e.bullets} color={variant === "tech" || variant === "moderne" ? theme.accent : undefined} />
              </>
            );
            if (variant !== "tech") return <View key={e.id} style={styles.entry}>{body}</View>;
            // Timeline verticale : filet coloré et point devant chaque expérience.
            return (
              <View key={e.id} style={{ marginTop: 0, paddingLeft: 14, paddingTop: 5, paddingBottom: 4, borderLeftWidth: 1.5, borderColor: "#A7F3D0", marginLeft: 4 }}>
                <View style={{ position: "absolute", left: -5.25, top: 8, width: 9, height: 9, borderRadius: 4.5, backgroundColor: theme.accent }} />
                {body}
              </View>
            );
          })}
        </View>
      ) : null}

      {s.education.length ? (
        <View style={styles.section}>
          <Heading>Formation</Heading>
          {s.education.map((e) => (
            <View key={e.id} style={styles.entry} wrap={false}>
              <View style={styles.row}>
                <Text style={[styles.bold, { flex: 1 }]}>{e.degree || e.school}</Text>
                <Text style={[styles.muted, { fontSize: 9, marginLeft: 8 }]}>{dateRange(e.startDate, e.endDate)}</Text>
              </View>
              {e.degree && e.school ? <Text>{e.school}</Text> : null}
              {e.honors ? <Text style={styles.muted}>{e.honors}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {s.skills.length ? (
        <View style={styles.section} wrap={false}>
          <Heading>Compétences</Heading>
          {variant === "tech" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {s.skills.map((k) => (
                <Text
                  key={k.id}
                  style={{ backgroundColor: "#ECFDF5", color: "#065F46", borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 8, marginRight: 5, marginTop: 5, fontSize: 8.5 }}
                >
                  {k.name}
                  {k.level ? ` · ${levelLabel(k.level)}` : ""}
                </Text>
              ))}
            </View>
          ) : variant === "moderne" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {s.skills.map((k) => (
                <View key={k.id} style={{ width: "50%", paddingRight: 12, marginTop: 4 }}>
                  <View style={styles.row}>
                    <Text>{k.name}</Text>
                    {k.level ? <Text style={[styles.muted, { fontSize: 8.5 }]}>{levelLabel(k.level)}</Text> : null}
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
            <Text>{s.skills.map((k) => (k.level ? `${k.name} (${levelLabel(k.level).toLowerCase()})` : k.name)).join(variant === "classique" ? " • " : ", ")}</Text>
          )}
        </View>
      ) : null}

      {s.languages.length ? (
        <View style={styles.section} wrap={false}>
          <Heading>Langues</Heading>
          <Text>{s.languages.map((l) => (l.level ? `${l.name} : ${l.level}` : l.name)).join("   ·   ")}</Text>
        </View>
      ) : null}

      {s.projects.length ? (
        <View style={styles.section}>
          <Heading>Projets</Heading>
          {s.projects.map((p) => (
            <View key={p.id} style={styles.entry} wrap={false}>
              <View style={styles.row}>
                <Text style={styles.bold}>{p.name}</Text>
                {p.link ? <Contact item={{ label: displayUrl(p.link), href: p.link }} style={{ fontSize: 9, color: variant === "minimaliste" || variant === "classique" ? theme.muted : theme.accent }} /> : null}
              </View>
              {p.description ? <Text>{p.description}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {s.certifications.length ? (
        <View style={styles.section} wrap={false}>
          <Heading>Certifications</Heading>
          {s.certifications.map((c) => (
            <View key={c.id} style={[styles.row, { marginTop: 3 }]}>
              <Text style={{ flex: 1 }}>
                <Text style={styles.bold}>{c.name}</Text>
                {c.issuer ? ` — ${c.issuer}` : ""}
              </Text>
              {c.date ? <Text style={[styles.muted, { fontSize: 9 }]}>{c.date}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {s.interests.length ? (
        <View style={styles.section} wrap={false}>
          <Heading>Centres d&apos;intérêt</Heading>
          <Text>{s.interests.join(", ")}</Text>
        </View>
      ) : null}
    </Page>
  );
}

const MINIMALISTE: Theme = {
  font: "Helvetica",
  bold: "Helvetica-Bold",
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ borderBottomWidth: 0.5, borderColor: "#9CA3AF", paddingBottom: 2, marginBottom: 4 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5 }}>{children}</Text>
    </View>
  ),
};

const CLASSIQUE: Theme = {
  font: "Times-Roman",
  bold: "Times-Bold",
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "center",
  Heading: ({ children }) => (
    <View style={{ borderBottomWidth: 1, borderColor: "#111827", paddingBottom: 2, marginBottom: 4 }}>
      <Text style={{ fontFamily: "Times-Bold", fontSize: 11, letterSpacing: 1.2 }}>{children.toUpperCase()}</Text>
    </View>
  ),
};

const MODERNE: Theme = {
  font: "Helvetica",
  bold: "Helvetica-Bold",
  accent: "#1E40AF",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ marginBottom: 5 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11.5, color: "#1E40AF" }}>{children}</Text>
      <View style={{ height: 2, width: 36, backgroundColor: "#1E40AF", marginTop: 2.5 }} />
    </View>
  ),
};

const TECH: Theme = {
  font: "Helvetica",
  bold: "Helvetica-Bold",
  accent: "#059669",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: ({ children }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <View style={{ width: 4, height: 11, backgroundColor: "#059669", borderRadius: 1, marginRight: 6 }} />
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 0.3 }}>{children}</Text>
    </View>
  ),
};

// ---------------------------------------------------------------------------
// Modèle 4 : sidebar sombre (30 %) + colonne blanche
// ---------------------------------------------------------------------------

const SIDEBAR_BG = "#1E293B";

const SideHeading = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5, letterSpacing: 1, color: "#93C5FD", marginTop: 14, marginBottom: 4 }}>
    {children.toUpperCase()}
  </Text>
);

const MainHeading = ({ children }: { children: string }) => (
  <View style={{ borderBottomWidth: 1, borderColor: "#CBD5E1", paddingBottom: 2, marginBottom: 4, marginTop: 14 }}>
    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11.5, color: SIDEBAR_BG }}>{children}</Text>
  </View>
);

function Sidebar({ data }: { data: CvData }) {
  const s = sectionsOf(data);
  const items = contacts(data);
  const name = fullName(data) || "Prénom Nom";
  return (
    <Page size="A4" style={{ fontFamily: "Helvetica", fontSize: 9.5, lineHeight: 1.4, color: "#111827", paddingVertical: 32 }}>
      {/* Fond de la colonne, répété sur chaque page. */}
      <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "30%", backgroundColor: SIDEBAR_BG }} />
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: "30%", paddingHorizontal: 18, color: "#F8FAFC" }}>
          {data.personal.photo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf : pas d'attribut alt
            <Image
              src={data.personal.photo}
              style={{ width: 84, height: 84, borderRadius: 42, objectFit: "cover", alignSelf: "center", marginBottom: 6 }}
            />
          ) : null}
          {items.length ? (
            <>
              <SideHeading>Contact</SideHeading>
              {items.map((c, i) => (
                <Contact key={i} item={c} style={{ color: "#F8FAFC", fontSize: 8.5, marginTop: 2 }} />
              ))}
            </>
          ) : null}
          {s.education.length ? (
            <>
              <SideHeading>Formation</SideHeading>
              {s.education.map((e) => (
                <View key={e.id} style={{ marginTop: 4 }} wrap={false}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{e.degree || e.school}</Text>
                  {e.degree && e.school ? <Text style={{ fontSize: 8.5 }}>{e.school}</Text> : null}
                  <Text style={{ fontSize: 8, color: "#CBD5E1" }}>{[dateRange(e.startDate, e.endDate), e.honors].filter(Boolean).join(" · ")}</Text>
                </View>
              ))}
            </>
          ) : null}
          {s.skills.length ? (
            <>
              <SideHeading>Compétences</SideHeading>
              {s.skills.map((k) => (
                <View key={k.id} style={{ marginTop: 3 }} wrap={false}>
                  <Text style={{ fontSize: 8.5 }}>{k.name}</Text>
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
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{l.name}</Text>
                  {l.level ? ` — ${l.level}` : ""}
                </Text>
              ))}
            </>
          ) : null}
          {s.interests.length ? (
            <>
              <SideHeading>Centres d&apos;intérêt</SideHeading>
              <Text style={{ fontSize: 8.5 }}>{s.interests.join(", ")}</Text>
            </>
          ) : null}
        </View>

        <View style={{ width: "70%", paddingHorizontal: 26 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 22, lineHeight: 1.15, color: SIDEBAR_BG }}>{name}</Text>
          {data.personal.jobTitle ? <Text style={{ fontSize: 11.5, color: "#475569", marginTop: 3 }}>{data.personal.jobTitle}</Text> : null}
          {s.summary ? (
            <>
              <MainHeading>Profil</MainHeading>
              <Text>{s.summary}</Text>
            </>
          ) : null}
          {s.experiences.length ? (
            <>
              <MainHeading>Expériences</MainHeading>
              {s.experiences.map((e) => (
                <View key={e.id} style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
                    <Text style={{ fontFamily: "Helvetica-Bold", flex: 1 }}>{e.position}</Text>
                    <Text style={{ color: "#64748B", fontSize: 9, marginLeft: 8 }}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
                  </View>
                  <Text style={{ color: "#475569" }}>{[e.company, e.location].filter(Boolean).join(" · ")}</Text>
                  <Bullets items={e.bullets} color="#64748B" />
                </View>
              ))}
            </>
          ) : null}
          {s.projects.length ? (
            <>
              <MainHeading>Projets</MainHeading>
              {s.projects.map((p) => (
                <View key={p.id} style={{ marginTop: 5 }} wrap={false}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{p.name}</Text>
                  {p.description ? <Text>{p.description}</Text> : null}
                  {p.link ? <Contact item={{ label: displayUrl(p.link), href: p.link }} style={{ fontSize: 9, color: "#475569" }} /> : null}
                </View>
              ))}
            </>
          ) : null}
          {s.certifications.length ? (
            <>
              <MainHeading>Certifications</MainHeading>
              {s.certifications.map((c) => (
                <Text key={c.id} style={{ marginTop: 2 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{c.name}</Text>
                  {[c.issuer, c.date].filter(Boolean).length ? ` — ${[c.issuer, c.date].filter(Boolean).join(", ")}` : ""}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

/** Le CV complet dans le modèle choisi. */
export function CvDocument({ data, templateId, title }: Props) {
  const page =
    templateId === "sidebar" ? (
      <Sidebar data={data} />
    ) : (
      <SingleColumn
        data={data}
        variant={templateId}
        theme={{ minimaliste: MINIMALISTE, classique: CLASSIQUE, moderne: MODERNE, tech: TECH }[templateId]}
      />
    );
  return (
    <Document title={title} author={fullName(data) || undefined} creator="Applyfy" producer="Applyfy" language="fr">
      {page}
    </Document>
  );
}
