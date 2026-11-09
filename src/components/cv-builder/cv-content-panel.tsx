"use client";

import { useId, useRef, type ReactNode } from "react";

import {
  CV_LIMITS,
  newItemId,
  readInterests,
  SKILL_LEVELS,
  writeInterests,
  type CvData,
  type CvExperience,
  type SkillLevel,
} from "@/lib/cv-builder-types";
import { LUMEO_TEXTS } from "@/lib/lumeo-texts";

import { AddButton, Field, FieldEditingContext, FieldInput, ItemCard, move, TextArea, useFieldControl } from "./form-controls";
import { useLineEditing } from "./use-line-editing";

// Onglet « Contenu » de l'éditeur (CV créé depuis zéro) : le CV section par section. Chaque
// saisie passe par `onChange` (edit() de l'éditeur) : aperçu, score et sauvegarde suivent.

/** Mise à jour du CV, la même que celle de l'aperçu modifiable au clic. */
type Edit = (fn: (d: CvData) => CvData) => void;

const LANGUAGE_LEVELS = ["Débutant", "Intermédiaire", "Courant", "Bilingue", "Natif"];

const removeButton =
  "ui-focus inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-medium text-muted hover:text-red-600 lg:min-h-9 lg:min-w-8 dark:text-slate-400 dark:hover:text-red-400";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="font-semibold text-ink dark:text-white">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Identity({ data, onChange }: { data: CvData; onChange: Edit }) {
  const p = data.personal;
  const set = (field: keyof Omit<CvData["personal"], "photo">, value: string) =>
    onChange((d) => ({ ...d, personal: { ...d.personal, [field]: value } }));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Prénom" path="personal.firstName" value={p.firstName} onChange={(v) => set("firstName", v)} />
      <Field label="Nom" path="personal.lastName" value={p.lastName} onChange={(v) => set("lastName", v)} />
      <Field
        label="Titre du CV"
        path="personal.jobTitle"
        value={p.jobTitle}
        onChange={(v) => set("jobTitle", v)}
        placeholder="Ex. Data Analyst"
        className="sm:col-span-2"
      />
      <Field label="Email" path="personal.email" type="email" value={p.email} onChange={(v) => set("email", v)} />
      <Field label="Téléphone" path="personal.phone" type="tel" value={p.phone} onChange={(v) => set("phone", v)} />
      <Field label="Ville" path="personal.city" value={p.city} onChange={(v) => set("city", v)} placeholder="Ex. Lyon" />
      <Field
        label="LinkedIn"
        path="personal.linkedin"
        type="url"
        value={p.linkedin}
        onChange={(v) => set("linkedin", v)}
        placeholder="linkedin.com/in/…"
      />
      <Field label="Site web / portfolio" path="personal.website" type="url" value={p.website} onChange={(v) => set("website", v)} />
      <Field
        label="GitHub"
        path="personal.github"
        type="url"
        value={p.github}
        onChange={(v) => set("github", v)}
        placeholder="github.com/…"
      />
    </div>
  );
}

function newExperience(): CvExperience {
  return { id: newItemId(), company: "", position: "", startDate: "", endDate: "", current: false, location: "", bullets: [""] };
}

function Experiences({ data, onChange }: { data: CvData; onChange: Edit }) {
  const items = data.experiences;
  const update = (id: string, patch: Partial<CvExperience>) =>
    onChange((d) => ({ ...d, experiences: d.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <>
      {items.map((exp, index) => (
        <ItemCard
          key={exp.id}
          title={[exp.position, exp.company].filter(Boolean).join(" — ") || "Nouvelle expérience"}
          index={index}
          count={items.length}
          onMove={(delta) => onChange((d) => ({ ...d, experiences: move(d.experiences, index, delta) }))}
          onRemove={() => onChange((d) => ({ ...d, experiences: d.experiences.filter((e) => e.id !== exp.id) }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Poste" path={`experiences.${exp.id}.position`} value={exp.position} onChange={(v) => update(exp.id, { position: v })} />
            <Field label="Entreprise" path={`experiences.${exp.id}.company`} value={exp.company} onChange={(v) => update(exp.id, { company: v })} />
            <Field label="Ville" path={`experiences.${exp.id}.location`} value={exp.location} onChange={(v) => update(exp.id, { location: v })} className="sm:col-span-2" />
            <Field
              label="Début"
              path={`experiences.${exp.id}.startDate`}
              value={exp.startDate}
              placeholder="Ex. 09/2022"
              onChange={(v) => update(exp.id, { startDate: v })}
            />
            <div className="space-y-1.5">
              <Field
                label="Fin"
                path={`experiences.${exp.id}.endDate`}
                value={exp.current ? "" : exp.endDate}
                placeholder={exp.current ? "Aujourd'hui" : "Ex. 06/2024"}
                onChange={(v) => update(exp.id, { endDate: v, current: false })}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-prose lg:min-h-0 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={exp.current}
                  // Poste en cours : la date de fin est vidée.
                  onChange={(e) => update(exp.id, e.target.checked ? { current: true, endDate: "" } : { current: false })}
                  className="h-4 w-4 rounded border-line-strong accent-accent dark:border-slate-300"
                />
                Aujourd&apos;hui
              </label>
            </div>
          </div>
          <Bullets
            base={`experiences.${exp.id}`}
            label="Missions et réalisations"
            placeholder="Ex. Réduction de 30 % du temps de préparation des reportings"
            bullets={exp.bullets}
            onChange={(bullets) => update(exp.id, { bullets })}
          />
        </ItemCard>
      ))}
      <AddButton
        disabled={items.length >= CV_LIMITS.items}
        onClick={() => onChange((d) => ({ ...d, experiences: [...d.experiences, newExperience()] }))}
      >
        + Ajouter une expérience
      </AddButton>
    </>
  );
}

function Bullet({
  path,
  index,
  value,
  placeholder,
  onChange,
  onRemove,
}: {
  path: string;
  index: number;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const control = useFieldControl(path, value, onChange);
  return (
    <div className="flex items-start gap-2">
      <textarea aria-label={`Puce ${index + 1}`} rows={2} placeholder={placeholder} className="ui-input resize-y" {...control} />
      <button type="button" onClick={onRemove} aria-label={`Supprimer la puce ${index + 1}`} className={removeButton}>
        ×
      </button>
    </div>
  );
}

function Bullets({
  base,
  label,
  placeholder,
  bullets,
  onChange,
}: {
  /** Chemin de l'expérience ou de la formation. */
  base: string;
  label: string;
  placeholder: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink dark:text-slate-200">{label}</p>
      {bullets.map((bullet, i) => (
        <Bullet
          key={i}
          path={`${base}.bullets.${i}`}
          index={i}
          value={bullet}
          placeholder={placeholder}
          onChange={(value) => onChange(bullets.map((b, j) => (j === i ? value : b)))}
          onRemove={() => onChange(bullets.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        disabled={bullets.length >= CV_LIMITS.bullets}
        onClick={() => onChange([...bullets, ""])}
        className="ui-link ui-hit relative text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
      >
        + Ajouter une puce
      </button>
    </div>
  );
}

function Education({ data, onChange }: { data: CvData; onChange: Edit }) {
  const items = data.education;
  const update = (id: string, patch: Partial<CvData["education"][number]>) =>
    onChange((d) => ({ ...d, education: d.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <>
      {items.map((edu, index) => (
        <ItemCard
          key={edu.id}
          title={edu.degree || edu.school || "Nouvelle formation"}
          index={index}
          count={items.length}
          onMove={(delta) => onChange((d) => ({ ...d, education: move(d.education, index, delta) }))}
          onRemove={() => onChange((d) => ({ ...d, education: d.education.filter((e) => e.id !== edu.id) }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Diplôme" path={`education.${edu.id}.degree`} value={edu.degree} onChange={(v) => update(edu.id, { degree: v })} className="sm:col-span-2" />
            <Field label="Établissement" path={`education.${edu.id}.school`} value={edu.school} onChange={(v) => update(edu.id, { school: v })} className="sm:col-span-2" />
            <Field label="Début" path={`education.${edu.id}.startDate`} value={edu.startDate} placeholder="Ex. 2020" onChange={(v) => update(edu.id, { startDate: v })} />
            <Field label="Fin" path={`education.${edu.id}.endDate`} value={edu.endDate} placeholder="Ex. 2022" onChange={(v) => update(edu.id, { endDate: v })} />
            <Field label="Mention (optionnelle)" path={`education.${edu.id}.honors`} value={edu.honors} onChange={(v) => update(edu.id, { honors: v })} className="sm:col-span-2" />
          </div>
          <Bullets
            base={`education.${edu.id}`}
            label="Cours suivis, classements…"
            placeholder="Ex. Classement : 3e sur 120"
            bullets={edu.bullets}
            onChange={(bullets) => update(edu.id, { bullets })}
          />
        </ItemCard>
      ))}
      <AddButton
        disabled={items.length >= CV_LIMITS.items}
        onClick={() =>
          onChange((d) => ({
            ...d,
            education: [...d.education, { id: newItemId(), school: "", degree: "", startDate: "", endDate: "", honors: "", bullets: [] }],
          }))
        }
      >
        + Ajouter une formation
      </AddButton>
    </>
  );
}

/** Ligne d'une liste simple (compétences, langues, centres d'intérêt) : flèches et suppression. */
function ListRow({
  label,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const arrow =
    "ui-focus inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:text-ink disabled:opacity-30 lg:min-h-9 lg:min-w-8 dark:text-slate-400 dark:hover:text-white";
  return (
    // Sur mobile, champ seul sur sa ligne si la rangée a aussi un niveau : boutons de 44 px.
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:flex-nowrap">
      {children}
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter ${label}`} className={arrow}>
        ↑
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre ${label}`} className={arrow}>
        ↓
      </button>
      <button type="button" onClick={onRemove} aria-label={`Supprimer ${label}`} className={removeButton}>
        ×
      </button>
    </div>
  );
}

function Skills({ data, onChange }: { data: CvData; onChange: Edit }) {
  const update = (id: string, patch: Partial<CvData["skills"][number]>) =>
    onChange((d) => ({ ...d, skills: d.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <>
      {data.skills.map((skill, index) => (
        <ListRow
          key={skill.id}
          label={`la compétence ${index + 1}`}
          index={index}
          count={data.skills.length}
          onMove={(delta) => onChange((d) => ({ ...d, skills: move(d.skills, index, delta) }))}
          onRemove={() => onChange((d) => ({ ...d, skills: d.skills.filter((s) => s.id !== skill.id) }))}
        >
          <FieldInput
            aria-label={`Compétence ${index + 1}`}
            path={`skills.${skill.id}.name`}
            value={skill.name}
            placeholder="Ex. SQL"
            onChange={(name) => update(skill.id, { name })}
            className="ui-input min-w-0 basis-full sm:basis-0 sm:flex-1"
          />
          <select
            aria-label={`Niveau de la compétence ${index + 1}`}
            value={skill.level}
            onChange={(e) => update(skill.id, { level: e.target.value as SkillLevel })}
            className="ui-input mr-auto w-36 shrink-0 sm:mr-0"
          >
            {SKILL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </ListRow>
      ))}
      <AddButton
        disabled={data.skills.length >= CV_LIMITS.skills}
        onClick={() => onChange((d) => ({ ...d, skills: [...d.skills, { id: newItemId(), name: "", level: "" }] }))}
      >
        + Ajouter une compétence
      </AddButton>
    </>
  );
}

function Languages({ data, onChange }: { data: CvData; onChange: Edit }) {
  const update = (id: string, patch: Partial<CvData["languages"][number]>) =>
    onChange((d) => ({ ...d, languages: d.languages.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  return (
    <>
      {data.languages.map((lang, index) => {
        // Niveau hors liste (CV importé, ex. « C1 ») : proposé aussi, pour ne pas le perdre.
        const levels = lang.level && !LANGUAGE_LEVELS.includes(lang.level) ? [lang.level, ...LANGUAGE_LEVELS] : LANGUAGE_LEVELS;
        return (
          <ListRow
            key={lang.id}
            label={`la langue ${index + 1}`}
            index={index}
            count={data.languages.length}
            onMove={(delta) => onChange((d) => ({ ...d, languages: move(d.languages, index, delta) }))}
            onRemove={() => onChange((d) => ({ ...d, languages: d.languages.filter((l) => l.id !== lang.id) }))}
          >
            <FieldInput
              aria-label={`Langue ${index + 1}`}
              path={`languages.${lang.id}.name`}
              value={lang.name}
              placeholder="Ex. Anglais"
              onChange={(name) => update(lang.id, { name })}
              className="ui-input min-w-0 basis-full sm:basis-0 sm:flex-1"
            />
            <select
              aria-label={`Niveau de la langue ${index + 1}`}
              value={lang.level}
              onChange={(e) => update(lang.id, { level: e.target.value })}
              className="ui-input mr-auto w-36 shrink-0 sm:mr-0"
            >
              <option value="">Niveau</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </ListRow>
        );
      })}
      <AddButton
        disabled={data.languages.length >= CV_LIMITS.items}
        onClick={() => onChange((d) => ({ ...d, languages: [...d.languages, { id: newItemId(), name: "", level: "" }] }))}
      >
        + Ajouter une langue
      </AddButton>
    </>
  );
}

function Certifications({ data, onChange }: { data: CvData; onChange: Edit }) {
  const update = (id: string, patch: Partial<CvData["certifications"][number]>) =>
    onChange((d) => ({ ...d, certifications: d.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <>
      {data.certifications.map((cert, index) => (
        <ItemCard
          key={cert.id}
          title={cert.name || "Nouvelle certification"}
          index={index}
          count={data.certifications.length}
          onMove={(delta) => onChange((d) => ({ ...d, certifications: move(d.certifications, index, delta) }))}
          onRemove={() => onChange((d) => ({ ...d, certifications: d.certifications.filter((c) => c.id !== cert.id) }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certification" path={`certifications.${cert.id}.name`} value={cert.name} onChange={(v) => update(cert.id, { name: v })} className="sm:col-span-2" />
            <Field label="Organisme" path={`certifications.${cert.id}.issuer`} value={cert.issuer} onChange={(v) => update(cert.id, { issuer: v })} />
            <Field label="Date" path={`certifications.${cert.id}.date`} value={cert.date} placeholder="Ex. 2024" onChange={(v) => update(cert.id, { date: v })} />
          </div>
        </ItemCard>
      ))}
      <AddButton
        disabled={data.certifications.length >= CV_LIMITS.items}
        onClick={() =>
          onChange((d) => ({ ...d, certifications: [...d.certifications, { id: newItemId(), name: "", issuer: "", date: "" }] }))
        }
      >
        + Ajouter une certification
      </AddButton>
    </>
  );
}

function Projects({ data, onChange }: { data: CvData; onChange: Edit }) {
  const update = (id: string, patch: Partial<CvData["projects"][number]>) =>
    onChange((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  return (
    <>
      {data.projects.map((project, index) => (
        <ItemCard
          key={project.id}
          title={project.name || "Nouveau projet"}
          index={index}
          count={data.projects.length}
          onMove={(delta) => onChange((d) => ({ ...d, projects: move(d.projects, index, delta) }))}
          onRemove={() => onChange((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== project.id) }))}
        >
          <Field label="Nom du projet" path={`projects.${project.id}.name`} value={project.name} onChange={(v) => update(project.id, { name: v })} />
          <TextArea
            label="Description"
            path={`projects.${project.id}.description`}
            value={project.description}
            rows={3}
            onChange={(v) => update(project.id, { description: v })}
          />
          <Field
            label="Lien (facultatif)"
            path={`projects.${project.id}.link`}
            type="url"
            value={project.link}
            onChange={(v) => update(project.id, { link: v })}
          />
        </ItemCard>
      ))}
      <AddButton
        disabled={data.projects.length >= CV_LIMITS.items}
        onClick={() => onChange((d) => ({ ...d, projects: [...d.projects, { id: newItemId(), name: "", description: "", link: "" }] }))}
      >
        + Ajouter un projet
      </AddButton>
    </>
  );
}

/**
 * Centres d'intérêt, un par ligne : enregistrés dans data.interests (texte) séparés par des retours à
 * la ligne (cf. readInterests). La limite porte sur le texte entier : chaque ligne a la place restante.
 */
function Interests({ data, onChange }: { data: CvData; onChange: Edit }) {
  const items = readInterests(data.interests);
  const write = (next: string[]) => onChange((d) => ({ ...d, interests: writeInterests(next) }));
  return (
    <>
      {items.map((interest, index) => (
        <ListRow
          key={index}
          label={`le centre d'intérêt ${index + 1}`}
          index={index}
          count={items.length}
          onMove={(delta) => write(move(items, index, delta))}
          onRemove={() => write(items.filter((_, i) => i !== index))}
        >
          <FieldInput
            aria-label={`Centre d'intérêt ${index + 1}`}
            path={`interests.${index}`}
            value={interest}
            limit={CV_LIMITS.interests - (data.interests.length - interest.length)}
            placeholder="Ex. Course à pied"
            // Une virgule séparerait l'intérêt en deux dans le CV.
            onChange={(value) => write(items.map((s, i) => (i === index ? value.replace(/[,\n]/g, " ") : s)))}
            className="ui-input min-w-0 flex-1"
          />
        </ListRow>
      ))}
      <AddButton disabled={data.interests.length + 1 >= CV_LIMITS.interests} onClick={() => write([...items, ""])}>
        + Ajouter un centre d&apos;intérêt
      </AddButton>
    </>
  );
}

/** Onglet « Contenu » de l'éditeur : le CV section par section, mis à jour en temps réel. */
export function CvContentPanel({ data, onChange, onLimit }: { data: CvData; onChange: Edit; onLimit: (message: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { breakLine, mergeWithPrevious } = useLineEditing({
    data,
    apply: onChange,
    notify: onLimit,
    focus: (path, offset) => {
      const target = rootRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-line-path="${CSS.escape(path)}"]`);
      target?.focus();
      target?.setSelectionRange(offset, offset);
    },
  });
  return (
    <FieldEditingContext value={{ notify: onLimit, breakLine, mergeWithPrevious }}>
    <div ref={rootRef} className="space-y-8">
      <Section title="Identité">
        <Identity data={data} onChange={onChange} />
      </Section>
      <Section title="Poste visé">
        <Field
          label={LUMEO_TEXTS.targetJobLabel}
          path="targetJob"
          value={data.targetJob}
          placeholder="Ex. Analyste financier"
          onChange={(v) => onChange((d) => ({ ...d, targetJob: v }))}
        />
      </Section>
      <Section title="Accroche">
        <TextArea
          label="Résumé de profil"
          path="summary"
          value={data.summary}
          rows={5}
          placeholder="En 2 à 4 phrases : ton métier, ton expérience, tes points forts et ce que tu recherches."
          onChange={(v) => onChange((d) => ({ ...d, summary: v }))}
        />
      </Section>
      <Section title="Expériences">
        <Experiences data={data} onChange={onChange} />
      </Section>
      <Section title="Formation">
        <Education data={data} onChange={onChange} />
      </Section>
      <Section title="Compétences">
        <Skills data={data} onChange={onChange} />
      </Section>
      <Section title="Langues">
        <Languages data={data} onChange={onChange} />
      </Section>
      <Section title="Certifications">
        <Certifications data={data} onChange={onChange} />
      </Section>
      <Section title="Projets">
        <Projects data={data} onChange={onChange} />
      </Section>
      <Section title="Centres d'intérêt">
        <Interests data={data} onChange={onChange} />
      </Section>
    </div>
    </FieldEditingContext>
  );
}
