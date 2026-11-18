"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  cvSettings,
  displayUrl,
  interestList,
  SKILL_LEVELS,
  skillLevelValue,
  splitSkillGroup,
  CV_SECTION_TITLES,
  type CvData,
  type CvLang,
  type CvTemplateId,
} from "@/lib/cv-builder-types";

import { DensityContext, Link, Page, Photo, Text, View, type StyleProp } from "./cv-primitives";

// Les 6 modèles du CV Builder, écrits une fois avec les briques de cv-primitives : rendus
// en PDF (téléchargement) et en HTML modifiable (aperçu de l'éditeur). Chaque texte relié
// à un champ porte `edit` : il se modifie directement dans l'aperçu.

export const BOLD = { fontWeight: "bold" };

/** Alignement des paragraphes et des puces (réglage « Alignement » de l'éditeur). */
export const AlignContext = createContext<"left" | "justify">("left");
/** Couleur d'accent choisie dans « Style du CV » ; vide : couleur du modèle. */
export const AccentContext = createContext("");
// Teintes dérivées de l'accent choisi (#rrggbb). Sans accent, chaque modèle garde ses couleurs d'origine.

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
/** Mélange de `hex` avec `other` : 0, `hex` ; 1, `other`. */
export const mix = (hex: string, other: string, amount: number) => {
  const a = rgb(hex);
  const b = rgb(other);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
};
/** Luminance relative (WCAG). */
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** L'accent, éclairci (sur fond sombre) ou foncé (sur fond clair) juste assez pour un contraste de 4,5:1. */
export function readableOn(accent: string, background: string) {
  const toward = luminance(background) < 0.5 ? "#FFFFFF" : "#000000";
  for (let amount = 0; amount < 1; amount += 0.05) {
    const color = mix(accent, toward, amount);
    if (contrast(color, background) >= 4.5) return color;
  }
  return toward;
}

/** Titres des rubriques dans la langue du CV. */
export const TitlesContext = createContext(CV_SECTION_TITLES.fr);

/** Paragraphe modifiable (profil, description de projet), à l'alignement choisi. */
export function Paragraph({ edit, children, style }: { edit: string; children: string; style?: StyleProp }) {
  const align = useContext(AlignContext);
  return (
    <Text edit={edit} multiline style={[{ textAlign: align }, ...(Array.isArray(style) ? style : [style])]}>
      {children}
    </Text>
  );
}

/** Langue du CV : libellés traduits au rendu (les données enregistrées ne changent pas). */
export const LangContext = createContext<CvLang>("fr");

/** Libellés des niveaux de compétence en anglais (en français : ceux de SKILL_LEVELS). */
const SKILL_LEVEL_LABELS_EN: Record<string, string> = {
  debutant: "Beginner",
  intermediaire: "Intermediate",
  avance: "Advanced",
  expert: "Expert",
};

/** Libellé d'un niveau de compétence dans la langue du CV ; vide sans niveau. */
export function useLevelLabel() {
  const lang = useContext(LangContext);
  return (level: string) => {
    if (!level) return "";
    if (lang === "en") return SKILL_LEVEL_LABELS_EN[level] ?? "";
    return SKILL_LEVELS.find((l) => l.value === level)?.label ?? "";
  };
}

/**
 * Forme affichée d'une compétence groupée (« Hard skills : a, b ») : intitulé en gras, éventuellement
 * seul sur sa ligne. undefined pour une compétence simple, ou un intitulé déjà mis en forme.
 */
export function skillGroupDisplay(name: string, ownLine = false) {
  const group = splitSkillGroup(name);
  if (!group || /[*_]/.test(group.label)) return undefined;
  if (!group.items.trim()) return `**${group.label.trim()}**`;
  return ownLine ? `**${group.label.trim()}**\n${group.items.trim()}` : `**${group.label}**${group.items}`;
}

/**
 * Compétences dans l'ordre, avec leur place : `group` (« Intitulé : a, b »), `heading` (intitulé seul,
 * sur sa propre ligne) et `afterGroup` (compétence simple placée après un groupe, qu'elle suit à l'écran).
 */
export function skillRows(skills: CvData["skills"]) {
  let seenGroup = false;
  return skills.map((skill) => {
    const parts = splitSkillGroup(skill.name);
    const row = { skill, group: parts !== null, heading: parts !== null && !parts.items.trim(), afterGroup: parts === null && seenGroup };
    seenGroup ||= parts !== null;
    return row;
  });
}

export type ContactItem = { field: "email" | "phone" | "city" | "linkedin" | "website" | "github"; label: string; href?: string };

export function contacts(data: CvData): ContactItem[] {
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

export const absolute = (href: string) => (/^(https?:|mailto:)/i.test(href) ? href : `https://${href}`);

/** Coordonnée : lien cliquable dans le PDF, sans soulignement. */
export function Contact({ item, style, display }: { item: ContactItem; style?: StyleProp; display?: string }) {
  const edit = `personal.${item.field}`;
  if (!item.href) {
    return (
      <Text edit={edit} style={style}>
        {item.label}
      </Text>
    );
  }
  return (
    <Link src={absolute(item.href)} edit={edit} display={display} style={[{ textDecoration: "none" }, ...(Array.isArray(style) ? style : [style])]}>
      {item.label}
    </Link>
  );
}

/** Caractères après lesquels une URL peut passer à la ligne (sans tiret ajouté). */
const URL_BREAKS = "/.-";

/**
 * URL affichée sur plusieurs lignes si elle dépasse `maxChars` caractères : coupée seulement après « / »,
 * « . » ou « - », au plus tard possible. Un morceau sans point de coupure reste entier.
 */
export function urlLines(url: string, maxChars: number): string[] {
  const lines: string[] = [];
  let rest = url;
  while (rest.length > maxChars) {
    let cut = -1;
    for (let i = Math.min(maxChars, rest.length - 1); i > 0; i--) {
      if (URL_BREAKS.includes(rest[i - 1])) {
        cut = i;
        break;
      }
    }
    if (cut === -1) break;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  lines.push(rest);
  return lines;
}

/** Largeur d'une page A4, en points. */
export const PAGE_WIDTH = 595.28;
/** Taille des coordonnées de l'en-tête, et largeur moyenne d'un caractère (en cadratins) : Inter et polices proches. */
const CONTACT_SIZE = 9;
const CHAR_WIDTH = 0.515;

/**
 * Coordonnées réparties en lignes, d'après une estimation de leur largeur : le séparateur « · » n'est
 * écrit qu'entre deux coordonnées d'une même ligne, jamais en début ni en fin de ligne. (Un retour à la
 * ligne automatique emporterait le séparateur avec la coordonnée suivante.)
 */
export function contactLines(items: ContactItem[], width: number, gap: number, charWidth: number): ContactItem[][] {
  const lines: ContactItem[][] = [];
  let used = 0;
  for (const item of items) {
    const size = item.label.length * charWidth;
    const line = lines.at(-1);
    if (line && used + gap + size <= width) {
      line.push(item);
      used += gap + size;
    } else {
      lines.push([item]);
      used = size;
    }
  }
  return lines;
}

/**
 * Coordonnées de l'en-tête sur une ou plusieurs lignes, séparées par « · ». `width` : largeur disponible
 * (points) ; `margin` : espace de part et d'autre du séparateur.
 */
function ContactLines({
  items,
  width,
  center,
  top,
  margin,
  style,
  charWidth = CHAR_WIDTH,
}: {
  items: ContactItem[];
  width: number;
  center: boolean;
  top: number;
  margin: number;
  style?: StyleProp;
  charWidth?: number;
}) {
  // Largeurs en points à la taille normale : la densité agrandit le texte, pas la page.
  const density = useContext(DensityContext);
  const lines = contactLines(items, width / density, margin * 2 + CONTACT_SIZE * 0.3, CONTACT_SIZE * charWidth);
  return (
    <View style={{ marginTop: top }}>
      {lines.map((line) => (
        // Une coordonnée plus large que la page passe encore à la ligne (cas limite de l'estimation).
        <View key={line[0].field} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start" }}>
          {line.map((c, i) => (
            <View key={c.field} style={{ flexDirection: "row" }}>
              {i > 0 && <Text style={[...(Array.isArray(style) ? style : [style]), { fontSize: CONTACT_SIZE, marginHorizontal: margin }]}>·</Text>}
              <Contact item={c} style={[...(Array.isArray(style) ? style : [style]), { fontSize: CONTACT_SIZE }]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** « Prénom Nom », chaque partie modifiable. */
export function Name({ data, style }: { data: CvData; style?: StyleProp }) {
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

/** « 09/2022 – Aujourd'hui » (« Present » en anglais), début et fin modifiables. */
export function Dates({ base, start, end, current, style }: { base: string; start: string; end?: string; current?: boolean; style?: StyleProp }) {
  const t = useContext(TitlesContext);
  const hasEnd = current || !!end?.trim();
  if (!start.trim() && !hasEnd) return null;
  return (
    <Text style={style}>
      {start.trim() ? <Text edit={`${base}.startDate`}>{start}</Text> : null}
      {start.trim() && hasEnd ? " – " : null}
      {current ? t.present : end?.trim() ? <Text edit={`${base}.endDate`}>{end}</Text> : null}
    </Text>
  );
}

/** Puces à afficher : les puces vides sont masquées (l'aperçu garde à l'écran le champ en cours de saisie). */
export function bulletLines(items: string[]) {
  return items.map((text, index) => ({ text, index })).filter((b) => b.text.trim());
}

/** Une puce : jamais coupée entre deux pages. `top` : espace au-dessus (plus grand pour la première). */
export function BulletRow({ base, index, text, top, color, style }: { base: string; index: number; text: string; top: number; color?: string; style?: StyleProp }) {
  const align = useContext(AlignContext);
  return (
    <View style={{ flexDirection: "row", marginTop: top }} wrap={false}>
      <Text style={[{ width: 10, color: color ?? "#111827" }, ...(Array.isArray(style) ? style : [style])]}>•</Text>
      <Text edit={`${base}.bullets.${index}`} placeholder="Nouvelle puce" style={[{ flex: 1, textAlign: align }, ...(Array.isArray(style) ? style : [style])]}>
        {text}
      </Text>
    </View>
  );
}

/** Les puces d'une entrée, une par ligne (3 pt de plus au-dessus de la première). */
export function bulletRows(base: string, items: string[], color?: string, style?: StyleProp) {
  return bulletLines(items).map((b, i) => (
    <BulletRow key={b.index} base={base} index={b.index} text={b.text} top={i === 0 ? 4.5 : 1.5} color={color} style={style} />
  ));
}

// ---------------------------------------------------------------------------
// Coupure de page (PDF). L'aperçu ignore `wrap` : les blocs n'y changent que le découpage du DOM.
// ---------------------------------------------------------------------------

/** Bloc qui ne se coupe jamais entre deux pages. `style` : celui du bloc (espace au-dessus, filet…). */
export type Block = { key: string; style?: StyleProp; content: ReactNode };

/** Au-delà de ce nombre de puces, une expérience peut se couper entre deux puces. */
const UNBREAKABLE_BULLETS = 4;
/** Puces gardées ensemble de chaque côté d'une coupure : jamais de puce seule en haut ou en bas de page. */
const BULLETS_KEPT = 2;

type EntryPart = "only" | "first" | "middle" | "last";

/**
 * Blocs d'une expérience. Jusqu'à 4 puces : un seul bloc. Au-delà : l'en-tête avec les 2 premières puces,
 * une puce par bloc ensuite, et les 2 dernières ensemble.
 */
export function entryBlocks(key: string, head: ReactNode, rows: ReactNode[], render: (part: EntryPart, content: ReactNode) => Omit<Block, "key">): Block[] {
  if (rows.length <= UNBREAKABLE_BULLETS) return [{ key, ...render("only", <>{head}{rows}</>) }];
  return [
    { key, ...render("first", <>{head}{rows.slice(0, BULLETS_KEPT)}</>) },
    ...rows.slice(BULLETS_KEPT, -BULLETS_KEPT).map((row, i) => ({ key: `${key}-${i + BULLETS_KEPT}`, ...render("middle", row) })),
    { key: `${key}-end`, ...render("last", rows.slice(-BULLETS_KEPT)) },
  ];
}

/** Hauteur (points) de deux lignes de texte : ce qui doit tenir sous un titre suivi d'un paragraphe. */
const TWO_LINES = 30;

/**
 * Section du CV. Le titre n'est jamais seul en bas de page : il reste avec le premier bloc (`blocks`), ou
 * avec le début de `children` (paragraphe, liste sur plusieurs colonnes : `ahead` points). La section se
 * coupe entre deux blocs, jamais dans un bloc. `style` : celui du haut de la section (espace au-dessus).
 *
 * Titre et blocs sont rendus à la suite, sans conteneur : react-pdf n'applique `minPresenceAhead` qu'à un
 * bloc précédé d'autres blocs dans le même conteneur, jamais au premier.
 */
export function Section({ style, heading, blocks, ahead = TWO_LINES, children }: { style?: StyleProp; heading: ReactNode; blocks?: Block[]; ahead?: number; children?: ReactNode }) {
  if (!blocks) {
    return (
      <>
        {/* Insécable aussi : un titre dont seul le filet dépasse de la page ne doit pas rester en bas. */}
        <View style={style} wrap={false} minPresenceAhead={ahead}>
          {heading}
        </View>
        {children}
      </>
    );
  }
  const [first, ...rest] = blocks;
  return (
    <>
      <View style={style} wrap={false}>
        {heading}
        {first ? <View style={first.style}>{first.content}</View> : null}
      </View>
      {rest.map((b) => (
        <View key={b.key} style={b.style} wrap={false}>
          {b.content}
        </View>
      ))}
    </>
  );
}

/** Contenu des sections, dans l'ordre d'affichage (éléments vides masqués). */
export function sections(data: CvData) {
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

/** Liste à puces : un bloc par élément, rendu par `render`. `isHeading` : ligne d'intitulé, sans puce. */
export function itemBlocks<T extends { id: string }>(items: T[], render: (item: T) => ReactNode, isHeading?: (item: T) => boolean): Block[] {
  return items.map((item) => ({
    key: item.id,
    style: { flexDirection: "row", marginTop: 1.5 },
    content: (
      <>
        {isHeading?.(item) ? null : <Text style={{ width: 10 }}>•</Text>}
        <Text style={{ flex: 1 }}>{render(item)}</Text>
      </>
    ),
  }));
}

/**
 * Compétences à la suite, dans un seul paragraphe : « Jira · Figma · SQL (notions) ». Un groupe
 * (« Outils : a, b ») ou un intitulé seul a sa propre ligne. Chaque compétence garde la même place dans
 * le paragraphe quel que soit son type : seul le séparateur change (« · » ou retour à la ligne), le
 * champ en cours de saisie n'est jamais recréé quand une compétence devient un groupe.
 */
export function InlineSkills({ skills }: { skills: CvData["skills"] }) {
  const levelLabel = useLevelLabel();
  const rows = skillRows(skills);
  return (
    <Text style={{ marginTop: 1.5 }}>
      {rows.map(({ skill: k, group }, i) => (
        <Text key={k.id}>
          {/* Espace insécable avant « · » : le séparateur ne commence jamais une ligne. */}
          {i === 0 ? "" : group || rows[i - 1].group ? "\n" : " · "}
          <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name)}>
            {k.name}
          </Text>
          {k.level ? ` (${levelLabel(k.level).toLowerCase()})` : ""}
        </Text>
      ))}
    </Text>
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
  const t = useContext(TitlesContext);
  const levelLabel = useLevelLabel();
  const s = sections(data);
  const items = contacts(data);
  const center = theme.headerAlign === "center";
  const photo = (variant === "moderne" || variant === "tech") && data.personal.photo;
  const muted = { color: theme.muted };
  const section = { marginTop: 12 };
  const entry = { marginTop: 7 };
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const Heading = theme.Heading;
  const custom = data.style.accent;
  const accent = custom || theme.accent;
  // Tech : badges des compétences, teinte très claire de l'accent et texte de l'accent lisible dessus.
  const badgeBg = custom ? mix(custom, "#FFFFFF", 0.9) : "#ECFDF5";
  const badgeText = custom ? readableOn(custom, badgeBg) : "#065F46";

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
              { fontSize: 22, lineHeight: 1.15, color: variant === "moderne" ? accent : "#111827" },
              center && { textTransform: "uppercase" },
            ]}
          />
          {data.personal.jobTitle ? (
            <Text edit="personal.jobTitle" style={{ fontSize: 11.5, marginTop: 3, color: variant === "tech" ? accent : "#374151" }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}
          {headerContacts.length ? (
            <ContactLines items={headerContacts} width={PAGE_WIDTH - 2 * 42 - (photo ? 72 + 16 : 0)} center={center} top={6} margin={5} style={muted} />
          ) : null}
        </View>
        {photo ? <Photo src={photo} style={{ width: 72, height: 72, borderRadius: 36, objectFit: "cover", marginLeft: 16 }} /> : null}
      </View>

      {highlighted.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
          {highlighted.map((c) => (
            <View
              key={c.field}
              style={{ flexDirection: "row", marginRight: 8, marginTop: 2, borderWidth: 1, borderColor: accent, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7 }}
            >
              <Text style={[BOLD, { color: accent, fontSize: 8.5, marginRight: 4 }]}>
                {c.field === "github" ? "GitHub" : "Portfolio"}
              </Text>
              <Contact item={c} style={{ fontSize: 8.5, color: "#111827" }} />
            </View>
          ))}
        </View>
      ) : null}

      {variant === "minimaliste" && <View style={{ borderBottomWidth: 0.75, borderColor: accent, marginTop: 10 }} />}

      {s.summary ? (
        <Section style={section} heading={<Heading>{t.profile}</Heading>}>
          <Paragraph edit="summary">
            {s.summary}
          </Paragraph>
        </Section>
      ) : null}

      {s.experiences.length ? (
        <Section
          style={section}
          heading={<Heading>{t.experiences}</Heading>}
          blocks={s.experiences.flatMap((e) => {
            const base = `experiences.${e.id}`;
            const head = (
              <>
                <View style={row}>
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
              </>
            );
            const rows = bulletRows(base, e.bullets, variant === "tech" || variant === "moderne" ? accent : undefined);
            if (variant !== "tech") return entryBlocks(e.id, head, rows, (part, content) => ({ style: part === "only" || part === "first" ? entry : undefined, content }));
            // Timeline verticale : filet coloré, continu d'un bloc à l'autre, et point devant chaque expérience.
            return entryBlocks(e.id, head, rows, (part, content) => {
              const starts = part === "only" || part === "first";
              const ends = part === "only" || part === "last";
              return {
                style: { paddingLeft: 14, paddingTop: starts ? 5 : 0, paddingBottom: ends ? 4 : 0, borderLeftWidth: 1.5, borderColor: custom ? mix(custom, "#FFFFFF", 0.6) : "#A7F3D0", marginLeft: 4 },
                content: (
                  <>
                    {starts ? <View style={{ position: "absolute", left: -5.25, top: 8, width: 9, height: 9, borderRadius: 4.5, backgroundColor: accent }} /> : null}
                    {content}
                  </>
                ),
              };
            });
          })}
        />
      ) : null}

      {s.education.length ? (
        <Section
          style={section}
          heading={<Heading>{t.education}</Heading>}
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
                    <Dates base={base} start={e.startDate} end={e.endDate} style={[muted, { fontSize: 9, marginLeft: 8 }]} />
                  </View>
                  {e.degree && e.school ? <Text edit={`${base}.school`}>{e.school}</Text> : null}
                  {e.honors ? (
                    <Text edit={`${base}.honors`} style={muted}>
                      {e.honors}
                    </Text>
                  ) : null}
                  {bulletRows(base, e.bullets, variant === "tech" || variant === "moderne" ? accent : undefined)}
                </>
              ),
            };
          })}
        />
      ) : null}

      {s.skills.length ? (
        variant === "tech" ? (
          <Section style={section} heading={<Heading>{t.skills}</Heading>}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {skillRows(s.skills).map(({ skill: k, group, heading }) => (
                // Compétence groupée : un badge par ligne, même court. Intitulé seul : texte sans badge,
                // sur sa ligne, les badges suivants dessous. Même structure partout : pas de perte du
                // curseur quand une compétence devient un groupe pendant la frappe.
                <View key={k.id} style={group ? { width: "100%", alignItems: "flex-start" } : {}} wrap={false}>
                  <Text
                    style={
                      heading
                        ? { color: custom ? readableOn(custom, "#FFFFFF") : "#065F46", marginTop: 6, fontSize: 9 }
                        : { backgroundColor: badgeBg, color: badgeText, borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 8, marginRight: 5, marginTop: 5, fontSize: 8.5 }
                    }
                  >
                    <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name)}>
                      {k.name}
                    </Text>
                    {k.level ? ` · ${levelLabel(k.level)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : variant === "moderne" && s.skills.some((k) => k.level) ? (
          // Moderne avec des niveaux : grille sur deux colonnes, barre de niveau sous chaque compétence.
          <Section style={section} heading={<Heading>{t.skills}</Heading>}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {skillRows(s.skills).map(({ skill: k, group, afterGroup }) => (
                // Compétence groupée, ou placée après un groupe : pleine largeur, une ligne chacune.
                <View key={k.id} style={group || afterGroup ? { width: "100%", marginTop: 4 } : { width: "50%", paddingRight: 12, marginTop: 4 }} wrap={false}>
                  <View style={row}>
                    <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name)}>
                      {k.name}
                    </Text>
                    {k.level ? <Text style={[muted, { fontSize: 8.5 }]}>{levelLabel(k.level)}</Text> : null}
                  </View>
                  {k.level ? (
                    <View style={{ height: 3, backgroundColor: custom ? mix(custom, "#FFFFFF", 0.85) : "#DBEAFE", borderRadius: 1.5, marginTop: 2 }}>
                      <View style={{ height: 3, width: `${skillLevelValue(k.level) * 25}%`, backgroundColor: accent, borderRadius: 1.5 }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        ) : (
          // Minimaliste, Classique, Moderne sans niveau : compétences à la suite.
          <Section style={section} heading={<Heading>{t.skills}</Heading>}>
            <InlineSkills skills={s.skills} />
          </Section>
        )
      ) : null}

      {s.languages.length ? (
        <Section
          style={section}
          heading={<Heading>{t.languages}</Heading>}
          blocks={itemBlocks(s.languages, (l) => (
            <>
              <Text edit={`languages.${l.id}.name`}>{l.name}</Text>
              {l.level ? t.colon : ""}
              {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
            </>
          ))}
        />
      ) : null}

      {s.projects.length ? (
        <Section
          style={section}
          heading={<Heading>{t.projects}</Heading>}
          blocks={s.projects.map((p) => ({
            key: p.id,
            style: entry,
            content: (
              <>
              <View style={row}>
                <Text edit={`projects.${p.id}.name`} style={BOLD}>
                  {p.name}
                </Text>
                {p.link ? (
                  <Link
                    src={absolute(p.link)}
                    edit={`projects.${p.id}.link`}
                    style={{ textDecoration: "none", fontSize: 9, color: variant === "minimaliste" || variant === "classique" ? theme.muted : accent }}
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
              </>
            ),
          }))}
        />
      ) : null}

      {s.certifications.length ? (
        <Section
          style={section}
          heading={<Heading>{t.certifications}</Heading>}
          blocks={s.certifications.map((c) => ({
            key: c.id,
            style: [row, { marginTop: 3 }],
            content: (
              <>
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
              </>
            ),
          }))}
        />
      ) : null}

      {s.hasInterests ? (
        <Section style={section} heading={<Heading>{t.interests}</Heading>}>
          <Text edit="interests" multiline>{data.interests}</Text>
        </Section>
      ) : null}
    </Page>
  );
}

function MinimalisteHeading({ children }: { children: string }) {
  return (
    <View style={{ borderBottomWidth: 0.5, borderColor: "#9CA3AF", paddingBottom: 2, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 10.5, color: useContext(AccentContext) || "#111827" }]}>{children}</Text>
    </View>
  );
}

function ClassiqueHeading({ children }: { children: string }) {
  const color = useContext(AccentContext) || "#111827";
  return (
    <View style={{ borderBottomWidth: 1, borderColor: color, paddingBottom: 2, marginBottom: 4 }}>
      <Text style={[BOLD, { fontSize: 11, textTransform: "uppercase", color }]}>{children}</Text>
    </View>
  );
}

function ModerneHeading({ children }: { children: string }) {
  const color = useContext(AccentContext) || "#1E40AF";
  return (
    <View style={{ marginBottom: 5 }}>
      <Text style={[BOLD, { fontSize: 11.5, color }]}>{children}</Text>
      <View style={{ height: 2, width: 36, backgroundColor: color, marginTop: 2.5 }} />
    </View>
  );
}

function TechHeading({ children }: { children: string }) {
  const color = useContext(AccentContext) || "#059669";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <View style={{ width: 4, height: 11, backgroundColor: color, borderRadius: 1, marginRight: 6 }} />
      <Text style={[BOLD, { fontSize: 11, letterSpacing: 0.3 }]}>{children}</Text>
    </View>
  );
}

const MINIMALISTE: Theme = {
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "left",
  Heading: MinimalisteHeading,
};

const CLASSIQUE: Theme = {
  accent: "#111827",
  muted: "#4B5563",
  headerAlign: "center",
  Heading: ClassiqueHeading,
};

const MODERNE: Theme = {
  accent: "#1E40AF",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: ModerneHeading,
};

const TECH: Theme = {
  accent: "#059669",
  muted: "#6B7280",
  headerAlign: "left",
  Heading: TechHeading,
};

// ---------------------------------------------------------------------------
// Modèle 4 : sidebar sombre (30 %) + colonne blanche
// ---------------------------------------------------------------------------

const SIDEBAR_BG = "#1E293B";
/** Couleur claire de la colonne sombre (titres, barres de niveau) : l'accent choisi, lisible sur le fond. */
const useSideLight = () => {
  const accent = useContext(AccentContext);
  return accent ? readableOn(accent, SIDEBAR_BG) : "#93C5FD";
};
/** Largeur utile de la colonne (30 % de la page, moins 2 × 18 pt de marge), taille et largeur moyenne d'un caractère des coordonnées. */
const SIDE_TEXT_WIDTH = PAGE_WIDTH * 0.3 - 36;
const SIDE_CONTACT_SIZE = 8.5;
const SIDE_CHAR_WIDTH = 0.5;

const SideHeading = ({ children }: { children: string }) => (
  <Text style={[BOLD, { fontSize: 9.5, color: useSideLight(), marginTop: 14, marginBottom: 4, textTransform: "uppercase" }]}>
    {children}
  </Text>
);

function MainHeading({ children }: { children: string }) {
  return (
    <View style={{ borderBottomWidth: 1, borderColor: "#CBD5E1", paddingBottom: 2, marginBottom: 4, marginTop: 14 }}>
      <Text style={[BOLD, { fontSize: 11.5, color: useContext(AccentContext) || SIDEBAR_BG }]}>{children}</Text>
    </View>
  );
}

function Sidebar({ data }: { data: CvData }) {
  const t = useContext(TitlesContext);
  const levelLabel = useLevelLabel();
  const light = useSideLight();
  const s = sections(data);
  const items = contacts(data);
  // URL plus large que la colonne : coupée en lignes (affichage seulement). Largeur en points à la taille
  // normale : la densité agrandit le texte, pas la page.
  const maxChars = SIDE_TEXT_WIDTH / useContext(DensityContext) / (SIDE_CONTACT_SIZE * SIDE_CHAR_WIDTH);
  const shownUrl = (c: ContactItem) => {
    if (c.field === "email" || !c.href) return undefined;
    const lines = urlLines(c.label, Math.floor(maxChars));
    return lines.length > 1 ? lines.join("\n") : undefined;
  };

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
            <Section
              heading={<SideHeading>{t.contact}</SideHeading>}
              blocks={items.map((c) => ({ key: c.field, content: <Contact item={c} display={shownUrl(c)} style={{ color: "#F8FAFC", fontSize: SIDE_CONTACT_SIZE, marginTop: 2 }} /> }))}
            />
          ) : null}
          {s.education.length ? (
            <Section
              heading={<SideHeading>{t.education}</SideHeading>}
              blocks={s.education.map((e) => {
                const base = `education.${e.id}`;
                return {
                  key: e.id,
                  style: { marginTop: 4 },
                  content: (
                  <>
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
                    {bulletRows(base, e.bullets, "#CBD5E1", { fontSize: 8, color: "#CBD5E1" })}
                  </>
                  ),
                };
              })}
            />
          ) : null}
          {s.skills.length ? (
            <Section
              heading={<SideHeading>{t.skills}</SideHeading>}
              blocks={s.skills.map((k) => ({
                key: k.id,
                // Compétence groupée : intitulé seul sur sa ligne, groupes plus espacés (colonne étroite).
                style: { marginTop: splitSkillGroup(k.name) ? 6 : 3 },
                content: (
                <>
                  {/* Niveau écrit après le nom, en plus de la barre : un ATS ne lit pas la barre. */}
                  <Text style={{ fontSize: 8.5 }}>
                    <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(k.name, true)}>
                      {k.name}
                    </Text>
                    {k.level ? <Text style={{ color: "#CBD5E1" }}>{` · ${levelLabel(k.level)}`}</Text> : null}
                  </Text>
                  {k.level ? (
                    <View style={{ height: 2.5, backgroundColor: "#334155", borderRadius: 1, marginTop: 1.5 }}>
                      <View style={{ height: 2.5, width: `${skillLevelValue(k.level) * 25}%`, backgroundColor: light, borderRadius: 1 }} />
                    </View>
                  ) : null}
                </>
                ),
              }))}
            />
          ) : null}
          {s.languages.length ? (
            <Section
              heading={<SideHeading>{t.languages}</SideHeading>}
              blocks={s.languages.map((l) => ({
                key: l.id,
                content: (
                  <Text style={{ fontSize: 8.5, marginTop: 2 }}>
                    <Text edit={`languages.${l.id}.name`} style={BOLD}>
                      {l.name}
                    </Text>
                    {l.level ? " — " : ""}
                    {l.level ? <Text edit={`languages.${l.id}.level`}>{l.level}</Text> : null}
                  </Text>
                ),
              }))}
            />
          ) : null}
          {s.hasInterests ? (
            <Section heading={<SideHeading>{t.interests}</SideHeading>}>
              <Text edit="interests" multiline style={{ fontSize: 8.5 }}>
                {data.interests}
              </Text>
            </Section>
          ) : null}
        </View>

        <View style={{ width: "70%", paddingHorizontal: 26 }}>
          <Name data={data} style={[BOLD, { fontSize: 22, lineHeight: 1.15, color: data.style.accent || SIDEBAR_BG }]} />
          {data.personal.jobTitle ? (
            <Text edit="personal.jobTitle" style={{ fontSize: 11.5, color: "#475569", marginTop: 3 }}>
              {data.personal.jobTitle}
            </Text>
          ) : null}
          {s.summary ? (
            <Section heading={<MainHeading>{t.profile}</MainHeading>}>
              <Paragraph edit="summary">
                {s.summary}
              </Paragraph>
            </Section>
          ) : null}
          {s.experiences.length ? (
            <Section
              heading={<MainHeading>{t.experiences}</MainHeading>}
              blocks={s.experiences.flatMap((e) => {
                const base = `experiences.${e.id}`;
                const head = (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
                  </>
                );
                return entryBlocks(e.id, head, bulletRows(base, e.bullets, "#64748B"), (part, content) => ({
                  style: part === "only" || part === "first" ? { marginTop: 6 } : undefined,
                  content,
                }));
              })}
            />
          ) : null}
          {s.projects.length ? (
            <Section
              heading={<MainHeading>{t.projects}</MainHeading>}
              blocks={s.projects.map((p) => ({
                key: p.id,
                style: { marginTop: 5 },
                content: (
                <>
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
                </>
                ),
              }))}
            />
          ) : null}
          {s.certifications.length ? (
            <Section
              heading={<MainHeading>{t.certifications}</MainHeading>}
              blocks={s.certifications.map((c) => ({
                key: c.id,
                content: (
                  <Text style={{ marginTop: 2 }}>
                    <Text edit={`certifications.${c.id}.name`} style={BOLD}>
                      {c.name}
                    </Text>
                    {c.issuer || c.date ? " — " : ""}
                    {c.issuer ? <Text edit={`certifications.${c.id}.issuer`}>{c.issuer}</Text> : null}
                    {c.issuer && c.date ? ", " : ""}
                    {c.date ? <Text edit={`certifications.${c.id}.date`}>{c.date}</Text> : null}
                  </Text>
                ),
              }))}
            />
          ) : null}
        </View>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Modèle 6 : finance, CV ATS classique américain (Times, noir et blanc, très compact)
// ---------------------------------------------------------------------------

const FINANCE_BLACK = "#000000";
/** Photo ronde facultative de l'en-tête (60 px). */
const FINANCE_PHOTO = 45;
export const ITALIC = { fontStyle: "italic" };

/** Titre centré en petites majuscules, entre deux filets pleine largeur. */
function FinanceHeading({ children }: { children: string }) {
  const color = useContext(AccentContext) || FINANCE_BLACK;
  return (
    <View style={{ borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: color, paddingVertical: 1, marginBottom: 3 }}>
      <Text style={[BOLD, { fontSize: 9.5, textAlign: "center", textTransform: "uppercase", color }]}>{children}</Text>
    </View>
  );
}

/** Puces de Finance : « • » à la taille du texte (lisible, aligné sur la première ligne), espacement serré. */
function financeBulletRows(base: string, items: string[]) {
  return bulletLines(items).map((b, i) => (
    <BulletRow key={b.index} base={base} index={b.index} text={b.text} top={i === 0 ? 1.5 : 0.5} color={FINANCE_BLACK} />
  ));
}

/** Ligne « libellé : éléments » de la section Compétences & Langues. */
export function FinanceLine({ label, children }: { label: string; children: ReactNode }) {
  const t = useContext(TitlesContext);
  return (
    <Text style={{ marginTop: 1 }}>
      <Text style={BOLD}>
        {label}
        {t.colon}
      </Text>
      {children}
    </Text>
  );
}

/**
 * Compétences dans leur ordre : d'abord les simples sur la ligne « Compétences : … », puis une ligne
 * par groupe ou intitulé seul ; les compétences simples placées après sont réunies sur la ligne dessous.
 */
export function FinanceSkills({ skills }: { skills: CvData["skills"] }) {
  const t = useContext(TitlesContext);
  const rows = skillRows(skills);
  const levelLabel = useLevelLabel();
  const level = (k: CvData["skills"][number]) => (k.level ? ` (${levelLabel(k.level).toLowerCase()})` : "");
  const simpleItems = (items: CvData["skills"]) =>
    joined(items, (k) => (
      <>
        <Text edit={`skills.${k.id}.name`} placeholder="Nouvelle compétence">
          {k.name}
        </Text>
        {level(k)}
      </>
    ));
  const first = rows.filter((r) => !r.group && !r.afterGroup).map((r) => r.skill);
  // Blocs après la ligne « Compétences » : un groupe, ou une suite de compétences simples.
  const blocks: CvData["skills"][] = [];
  for (const row of rows) {
    if (row.group) blocks.push([row.skill]);
    else if (row.afterGroup) {
      const last = blocks.at(-1);
      if (last && !splitSkillGroup(last[0].name)) last.push(row.skill);
      else blocks.push([row.skill]);
    }
  }
  return (
    <>
      {first.length ? <FinanceLine label={t.skills}>{simpleItems(first)}</FinanceLine> : null}
      {blocks.map((block) => (
        <Text key={block[0].id} style={{ marginTop: 1 }}>
          {splitSkillGroup(block[0].name) ? (
            <>
              <Text edit={`skills.${block[0].id}.name`} placeholder="Nouvelle compétence" display={skillGroupDisplay(block[0].name)}>
                {block[0].name}
              </Text>
              {level(block[0])}
            </>
          ) : (
            simpleItems(block)
          )}
        </Text>
      ))}
    </>
  );
}

/** Éléments séparés par des virgules, chacun modifiable. */
export function joined<T>(items: T[], render: (item: T) => ReactNode) {
  return items.map((item, i) => (
    <Text key={i}>
      {i > 0 ? ", " : ""}
      {render(item)}
    </Text>
  ));
}

function Finance({ data }: { data: CvData }) {
  const t = useContext(TitlesContext);
  const s = sections(data);
  const items = contacts(data);
  const row = { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" };
  const section = { marginTop: 7 };
  const entry = { marginTop: 4 };
  const dates = { marginLeft: 8 };
  // Réglages (police, taille, marges). Sans réglage choisi : Tinos, 9,5 pt, marges de 34 et 26 pt, soit
  // le rendu d'origine, au point près. La taille choisie s'applique à tout le modèle comme la densité.
  const settings = cvSettings("finance", data.style);
  const density = useContext(DensityContext) * settings.factor;
  // Photo facultative : petite, ronde, en haut à droite de l'en-tête et hors du flux. Sans photo, rien ne change.
  const photo = data.personal.photo;
  const photoSpace = photo ? 2 * (FINANCE_PHOTO + 10) : 0;

  return (
    <DensityContext value={density}>
    {/* Marge verticale divisée par le facteur de taille : la page l'applique, la marge reste exacte. */}
    <Page style={{ fontFamily: settings.font, fontSize: 9.5, lineHeight: 1.25, color: FINANCE_BLACK, paddingVertical: settings.vertical / settings.factor, paddingHorizontal: settings.horizontal }}>
      <View style={photo ? { textAlign: "center", minHeight: FINANCE_PHOTO } : { textAlign: "center" }}>
        {photo ? (
          <Photo src={photo} style={{ position: "absolute", top: 0, right: 0, width: FINANCE_PHOTO, height: FINANCE_PHOTO, borderRadius: FINANCE_PHOTO / 2, objectFit: "cover" }} />
        ) : null}
        <Name data={data} style={[BOLD, { fontSize: 17, lineHeight: 1.1, textTransform: "uppercase", letterSpacing: 0.5 }]} />
        {data.personal.jobTitle ? (
          <Text edit="personal.jobTitle" style={[ITALIC, { marginTop: 1 }]}>
            {data.personal.jobTitle}
          </Text>
        ) : null}
        {/* Tinos : caractères plus étroits que ceux d'Inter. */}
        {/* Avec une photo : coordonnées rétrécies des deux côtés, pour rester centrées sans la toucher. */}
        {items.length ? (
          <View style={photoSpace ? { paddingHorizontal: photoSpace / 2 } : undefined}>
            <ContactLines
              items={items}
              width={PAGE_WIDTH - 2 * settings.horizontal - photoSpace}
              center
              top={2}
              margin={4}
              style={{ color: FINANCE_BLACK }}
              charWidth={data.style.typeface ? settings.charWidth : 0.46}
            />
          </View>
        ) : null}
      </View>

      {s.summary ? (
        <Section style={section} heading={<FinanceHeading>{t.summary}</FinanceHeading>}>
          <Paragraph edit="summary">{s.summary}</Paragraph>
        </Section>
      ) : null}

      {s.education.length ? (
        <Section
          style={section}
          heading={<FinanceHeading>{t.education}</FinanceHeading>}
          blocks={s.education.map((e) => {
            const base = `education.${e.id}`;
            return {
              key: e.id,
              style: entry,
              content: (
              <>
                <View style={row}>
                  <Text edit={`${base}.${e.school ? "school" : "degree"}`} style={[BOLD, { flex: 1 }]}>
                    {e.school || e.degree}
                  </Text>
                  <Dates base={base} start={e.startDate} end={e.endDate} style={dates} />
                </View>
                {e.school && e.degree ? (
                  <Text edit={`${base}.degree`} style={ITALIC}>
                    {e.degree}
                  </Text>
                ) : null}
                {e.honors ? <Text edit={`${base}.honors`}>{e.honors}</Text> : null}
                {financeBulletRows(base, e.bullets)}
              </>
              ),
            };
          })}
        />
      ) : null}

      {s.experiences.length ? (
        <Section
          style={section}
          heading={<FinanceHeading>{t.experiences}</FinanceHeading>}
          blocks={s.experiences.flatMap((e) => {
            const base = `experiences.${e.id}`;
            const head = (
                <View>
                  <View style={row}>
                    <Text edit={`${base}.${e.company ? "company" : "position"}`} style={[BOLD, { flex: 1 }]}>
                      {e.company || e.position}
                    </Text>
                    {e.location ? (
                      <Text edit={`${base}.location`} style={dates}>
                        {e.location}
                      </Text>
                    ) : null}
                  </View>
                  <View style={row}>
                    {e.company && e.position ? (
                      <Text edit={`${base}.position`} style={[ITALIC, { flex: 1 }]}>
                        {e.position}
                      </Text>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    <Dates base={base} start={e.startDate} end={e.endDate} current={e.current} style={dates} />
                  </View>
                </View>
            );
            return entryBlocks(e.id, head, financeBulletRows(base, e.bullets), (part, content) => ({
              style: part === "only" || part === "first" ? entry : undefined,
              content,
            }));
          })}
        />
      ) : null}

      {s.projects.length ? (
        <Section
          style={section}
          heading={<FinanceHeading>{t.projects}</FinanceHeading>}
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
                  <Link src={absolute(p.link)} edit={`projects.${p.id}.link`} style={[dates, { textDecoration: "none", color: FINANCE_BLACK }]}>
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

      {s.skills.length || s.languages.length || s.certifications.length || s.hasInterests ? (
        <Section style={section} heading={<FinanceHeading>{t.skillsLanguages}</FinanceHeading>}>
          <FinanceSkills skills={s.skills} />
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
              <Text edit="interests" multiline>{data.interests}</Text>
            </FinanceLine>
          ) : null}
        </Section>
      ) : null}
    </Page>
    </DensityContext>
  );
}

/** Les 6 premiers modèles ; les modèles réglables sont dans leurs propres fichiers (cf. cv-pages). */
export type LegacyTemplateId = "minimaliste" | "classique" | "moderne" | "sidebar" | "tech" | "finance";

/** Les pages du CV dans l'un des 6 premiers modèles (dans un PrimitivesContext PDF ou HTML). */
export function LegacyPages({ data, templateId, language = "fr" }: { data: CvData; templateId: LegacyTemplateId; language?: CvLang }) {
  const theme = { minimaliste: MINIMALISTE, classique: CLASSIQUE, moderne: MODERNE, tech: TECH, finance: null, sidebar: null }[
    templateId
  ];
  return (
    <TitlesContext value={CV_SECTION_TITLES[language]}>
      <LangContext value={language}>
      <AlignContext value={data.style.align}>
        <AccentContext value={data.style.accent}>
          {templateId === "finance" ? (
            <Finance data={data} />
          ) : theme ? (
            <SingleColumn data={data} variant={templateId} theme={theme} />
          ) : (
            <Sidebar data={data} />
          )}
        </AccentContext>
      </AlignContext>
      </LangContext>
    </TitlesContext>
  );
}
