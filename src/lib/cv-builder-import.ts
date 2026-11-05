import "server-only";

import type { ImportedCvContent } from "./claude";
import { CV_LIMITS, CvDataSchema, newItemId, type CvData } from "./cv-builder-types";

// Contenu d'un CV extrait par l'IA → données du CV Builder : import depuis le CV Builder et
// ouverture d'un CV depuis la fiche d'une candidature.

export const clip = (value: string, max: number) => value.trim().slice(0, max);

/** Puces regroupées dans un seul élément (« a • b », ou une par ligne) : séparées. */
function splitBullets(bullets: string[]) {
  return bullets.flatMap((b) =>
    b
      .split(/\n+|\s*[•●▪◦►▸]\s*/)
      .map((part) => part.replace(/^[-–—*]\s+/, "").trim())
      .filter(Boolean),
  );
}

/** Contenu extrait → données du CV, aux bornes du formulaire (un champ trop long est coupé). */
export function importedToCvData(cv: ImportedCvContent): CvData {
  const L = CV_LIMITS;
  const url = (value: string) => clip(value, L.url);
  return CvDataSchema.parse({
    personal: {
      firstName: clip(cv.firstName, 60),
      lastName: clip(cv.lastName, 60),
      jobTitle: clip(cv.jobTitle, L.short),
      email: clip(cv.email, L.short),
      phone: clip(cv.phone, 40),
      city: clip(cv.city, L.short),
      linkedin: url(cv.linkedin),
      website: url(cv.website),
      github: url(cv.github),
    },
    summary: clip(cv.summary, L.text),
    experiences: cv.experiences.slice(0, L.items).map((e) => ({
      id: newItemId(),
      position: clip(e.position, L.short),
      company: clip(e.company, L.short),
      startDate: clip(e.startDate, 40),
      endDate: e.current ? "" : clip(e.endDate, 40),
      current: e.current,
      location: clip(e.location, L.short),
      bullets: splitBullets(e.bullets)
        .map((b) => clip(b, L.bullet))
        .filter(Boolean)
        .slice(0, L.bullets),
    })),
    education: cv.education.slice(0, L.items).map((e) => ({
      id: newItemId(),
      school: clip(e.school, L.short),
      degree: clip(e.degree, L.short),
      startDate: clip(e.startDate, 40),
      endDate: clip(e.endDate, 40),
      honors: clip(e.honors, L.short),
    })),
    skills: cv.skills
      .filter((s) => s.name.trim())
      .slice(0, 40)
      .map((s) => ({ id: newItemId(), name: clip(s.name, L.short), level: s.level })),
    languages: cv.languages
      .filter((l) => l.name.trim())
      .slice(0, L.items)
      .map((l) => ({ id: newItemId(), name: clip(l.name, 60), level: clip(l.level, 60) })),
    certifications: cv.certifications
      .filter((c) => c.name.trim())
      .slice(0, L.items)
      .map((c) => ({ id: newItemId(), name: clip(c.name, L.short), issuer: clip(c.issuer, L.short), date: clip(c.date, 40) })),
    projects: cv.projects
      .filter((p) => p.name.trim())
      .slice(0, L.items)
      .map((p) => ({ id: newItemId(), name: clip(p.name, L.short), description: clip(p.description, L.text), link: url(p.link) })),
    interests: clip(
      cv.interests
        .map((i) => i.trim())
        .filter(Boolean)
        .join(", "),
      500,
    ),
    origin: "import",
  });
}
