"use client";

import { useId, type ReactNode } from "react";

import {
  CV_LIMITS,
  newItemId,
  SKILL_LEVELS,
  type CvData,
  type CvExperience,
  type SkillLevel,
} from "@/lib/cv-builder-types";

import { AddButton, Field, ItemCard, move, TextArea } from "./form-controls";

// Onglet « Contenu » de l'éditeur (CV créé depuis zéro) : le CV section par section. Chaque
// saisie passe par `onChange` (edit() de l'éditeur) : aperçu, score et sauvegarde suivent.

/** Mise à jour du CV, la même que celle de l'aperçu modifiable au clic. */
type Edit = (fn: (d: CvData) => CvData) => void;

/** Poste visé : longueur maximale (cf. CvDataSchema). */
const TARGET_JOB_MAX = 120;
/** Centres d'intérêt : texte total (cf. CvDataSchema) et longueur d'un centre d'intérêt. */
const INTERESTS_MAX = 500;
const INTEREST_MAX = 100;
/** Compétences : nombre maximal (cf. CvDataSchema). */
const SKILLS_MAX = 40;

const LANGUAGE_LEVELS = ["Débutant", "Intermédiaire", "Courant", "Bilingue", "Natif"];

const removeButton =
  "shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="font-semibold text-slate-900 dark:text-white">
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
      <Field label="Prénom" value={p.firstName} maxLength={60} onChange={(v) => set("firstName", v)} />
      <Field label="Nom" value={p.lastName} maxLength={60} onChange={(v) => set("lastName", v)} />
      <Field
        label="Titre du CV"
        value={p.jobTitle}
        onChange={(v) => set("jobTitle", v)}
        placeholder="Ex. Data Analyst"
        className="sm:col-span-2"
      />
      <Field label="Email" type="email" value={p.email} onChange={(v) => set("email", v)} />
      <Field label="Téléphone" type="tel" value={p.phone} maxLength={40} onChange={(v) => set("phone", v)} />
      <Field label="Ville" value={p.city} onChange={(v) => set("city", v)} placeholder="Ex. Lyon" />
      <Field
        label="LinkedIn"
        type="url"
        value={p.linkedin}
        maxLength={CV_LIMITS.url}
        onChange={(v) => set("linkedin", v)}
        placeholder="linkedin.com/in/…"
      />
      <Field label="Site web / portfolio" type="url" value={p.website} maxLength={CV_LIMITS.url} onChange={(v) => set("website", v)} />
      <Field
        label="GitHub"
        type="url"
        value={p.github}
        maxLength={CV_LIMITS.url}
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
            <Field label="Poste" value={exp.position} onChange={(v) => update(exp.id, { position: v })} />
            <Field label="Entreprise" value={exp.company} onChange={(v) => update(exp.id, { company: v })} />
            <Field label="Ville" value={exp.location} onChange={(v) => update(exp.id, { location: v })} className="sm:col-span-2" />
            <Field
              label="Début"
              value={exp.startDate}
              maxLength={40}
              placeholder="Ex. 09/2022"
              onChange={(v) => update(exp.id, { startDate: v })}
            />
            <div className="space-y-1.5">
              <Field
                label="Fin"
                value={exp.current ? "" : exp.endDate}
                maxLength={40}
                placeholder={exp.current ? "Aujourd'hui" : "Ex. 06/2024"}
                onChange={(v) => update(exp.id, { endDate: v, current: false })}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={exp.current}
                  // Poste en cours : la date de fin est vidée.
                  onChange={(e) => update(exp.id, e.target.checked ? { current: true, endDate: "" } : { current: false })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Aujourd&apos;hui
              </label>
            </div>
          </div>
          <Bullets exp={exp} update={update} />
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

function Bullets({ exp, update }: { exp: CvExperience; update: (id: string, patch: Partial<CvExperience>) => void }) {
  const setBullet = (i: number, value: string) => update(exp.id, { bullets: exp.bullets.map((b, j) => (j === i ? value : b)) });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Missions et réalisations</p>
      {exp.bullets.map((bullet, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            aria-label={`Puce ${i + 1}`}
            value={bullet}
            rows={2}
            maxLength={CV_LIMITS.bullet}
            placeholder="Ex. Réduction de 30 % du temps de préparation des reportings"
            onChange={(e) => setBullet(i, e.target.value)}
            className="input resize-y"
          />
          <button
            type="button"
            onClick={() => update(exp.id, { bullets: exp.bullets.filter((_, j) => j !== i) })}
            aria-label={`Supprimer la puce ${i + 1}`}
            className={removeButton}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={exp.bullets.length >= CV_LIMITS.bullets}
        onClick={() => update(exp.id, { bullets: [...exp.bullets, ""] })}
        className="text-sm font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
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
            <Field label="Diplôme" value={edu.degree} onChange={(v) => update(edu.id, { degree: v })} className="sm:col-span-2" />
            <Field label="Établissement" value={edu.school} onChange={(v) => update(edu.id, { school: v })} className="sm:col-span-2" />
            <Field label="Début" value={edu.startDate} maxLength={40} placeholder="Ex. 2020" onChange={(v) => update(edu.id, { startDate: v })} />
            <Field label="Fin" value={edu.endDate} maxLength={40} placeholder="Ex. 2022" onChange={(v) => update(edu.id, { endDate: v })} />
            <Field label="Mention (optionnelle)" value={edu.honors} onChange={(v) => update(edu.id, { honors: v })} className="sm:col-span-2" />
          </div>
        </ItemCard>
      ))}
      <AddButton
        disabled={items.length >= CV_LIMITS.items}
        onClick={() =>
          onChange((d) => ({
            ...d,
            education: [...d.education, { id: newItemId(), school: "", degree: "", startDate: "", endDate: "", honors: "" }],
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
  const arrow = "shrink-0 rounded-lg px-1.5 py-2 text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white";
  return (
    <div className="flex items-center gap-2">
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
          <input
            aria-label={`Compétence ${index + 1}`}
            value={skill.name}
            maxLength={CV_LIMITS.short}
            placeholder="Ex. SQL"
            onChange={(e) => update(skill.id, { name: e.target.value })}
            className="input min-w-0"
          />
          <select
            aria-label={`Niveau de la compétence ${index + 1}`}
            value={skill.level}
            onChange={(e) => update(skill.id, { level: e.target.value as SkillLevel })}
            className="input w-36 shrink-0"
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
        disabled={data.skills.length >= SKILLS_MAX}
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
            <input
              aria-label={`Langue ${index + 1}`}
              value={lang.name}
              maxLength={60}
              placeholder="Ex. Anglais"
              onChange={(e) => update(lang.id, { name: e.target.value })}
              className="input min-w-0"
            />
            <select
              aria-label={`Niveau de la langue ${index + 1}`}
              value={lang.level}
              onChange={(e) => update(lang.id, { level: e.target.value })}
              className="input w-36 shrink-0"
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
            <Field label="Certification" value={cert.name} onChange={(v) => update(cert.id, { name: v })} className="sm:col-span-2" />
            <Field label="Organisme" value={cert.issuer} onChange={(v) => update(cert.id, { issuer: v })} />
            <Field label="Date" value={cert.date} maxLength={40} placeholder="Ex. 2024" onChange={(v) => update(cert.id, { date: v })} />
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
          <Field label="Nom du projet" value={project.name} onChange={(v) => update(project.id, { name: v })} />
          <TextArea
            label="Description"
            value={project.description}
            rows={3}
            maxLength={CV_LIMITS.text}
            onChange={(v) => update(project.id, { description: v })}
          />
          <Field
            label="Lien (facultatif)"
            type="url"
            value={project.link}
            maxLength={CV_LIMITS.url}
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
 * Centres d'intérêt, un par ligne : enregistrés dans data.interests (texte) séparés par des
 * retours à la ligne ; un texte sans retour à la ligne (CV importé) est lu séparé par des virgules.
 */
function readInterests(text: string) {
  if (!text) return [];
  return text.includes("\n") ? text.split("\n") : text.split(",").map((s) => s.trim());
}

function Interests({ data, onChange }: { data: CvData; onChange: Edit }) {
  const items = readInterests(data.interests);
  const write = (next: string[]) => onChange((d) => ({ ...d, interests: next.join("\n").slice(0, INTERESTS_MAX) }));
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
          <input
            aria-label={`Centre d'intérêt ${index + 1}`}
            value={interest}
            maxLength={INTEREST_MAX}
            placeholder="Ex. Course à pied"
            // Une virgule séparerait l'intérêt en deux dans le CV.
            onChange={(e) => write(items.map((s, i) => (i === index ? e.target.value.replace(/[,\n]/g, " ") : s)))}
            className="input min-w-0"
          />
        </ListRow>
      ))}
      <AddButton
        disabled={data.interests.length + 1 >= INTERESTS_MAX}
        onClick={() => write([...items, ""])}
      >
        + Ajouter un centre d&apos;intérêt
      </AddButton>
    </>
  );
}

/** Onglet « Contenu » de l'éditeur : le CV section par section, mis à jour en temps réel. */
export function CvContentPanel({ data, onChange }: { data: CvData; onChange: Edit }) {
  return (
    <div className="space-y-8">
      <Section title="Identité">
        <Identity data={data} onChange={onChange} />
      </Section>
      <Section title="Poste visé">
        <Field
          label="Poste visé (pour le score et le coach)"
          value={data.targetJob}
          maxLength={TARGET_JOB_MAX}
          placeholder="Ex. Analyste financier"
          onChange={(v) => onChange((d) => ({ ...d, targetJob: v }))}
        />
      </Section>
      <Section title="Accroche">
        <TextArea
          label="Résumé de profil"
          value={data.summary}
          rows={5}
          maxLength={CV_LIMITS.text}
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
  );
}
