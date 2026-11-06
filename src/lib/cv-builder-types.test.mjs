// Touche Entrée dans les listes du CV Builder. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { CV_LIMITS, chatContent, CvDataSchema, fieldLimit, invalidCvField, isLinePath, lineLimitMessage, mergeLine, splitLine, splitSkillGroup, withoutEmptyLines } from "./cv-builder-types.ts";
import { splitRich, stripRich } from "./cv-rich-text.ts";

const cv = (bullets = ["Premier", "Second"], skills = [{ id: "a", name: "Excel" }, { id: "b", name: "SQL" }]) =>
  CvDataSchema.parse({ experiences: [{ id: "e", position: "Poste", bullets }], skills });
const BULLET = (i) => `experiences.e.bullets.${i}`;

test("seules les puces et les compétences sont des lignes de liste", () => {
  assert.equal(isLinePath(BULLET(0)), true);
  assert.equal(isLinePath("skills.a.name"), true);
  assert.equal(isLinePath("summary"), false);
  assert.equal(isLinePath("personal.city"), false);
  assert.equal(isLinePath("languages.a.name"), false);
});

test("Entrée dans une puce la coupe au curseur et vise la nouvelle puce", () => {
  const split = splitLine(cv(), BULLET(0), "Pre", "mier", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["Pre", "mier", "Second"]);
  assert.equal(split.nextPath, BULLET(1));
});

test("curseur en fin de puce : puce vide en dessous, celle du haut intacte", () => {
  const split = splitLine(cv(), BULLET(0), "Premier", "", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["Premier", "", "Second"]);
  assert.equal(split.nextPath, BULLET(1));
});

test("curseur au tout début : le texte ne change pas de puce, puce vide en dessous", () => {
  const split = splitLine(cv(), BULLET(0), "", "Premier", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["Premier", "", "Second"]);
  assert.equal(split.nextPath, BULLET(1));
});

test("plusieurs Entrée au tout début n'accumulent pas de puces vides cachées", () => {
  let data = cv();
  for (let i = 0; i < 4; i++) data = splitLine(data, BULLET(0), "", "Premier", "x").data;
  assert.deepEqual(data.experiences[0].bullets, ["Premier", "", "Second"]);
});

test("une puce vide juste après est réutilisée, même au nombre maximum de puces", () => {
  const bullets = ["A", "", ...Array.from({ length: CV_LIMITS.bullets - 2 }, (_, i) => `Puce ${i}`)];
  const split = splitLine(cv(bullets), BULLET(0), "A", "", "x");
  assert.deepEqual(split.data.experiences[0].bullets, bullets);
  assert.equal(split.nextPath, BULLET(1));
});

test("une coupe au milieu avec une puce vide après garde tout le texte", () => {
  const split = splitLine(cv(["Avant apres", "", "Fin"]), BULLET(0), "Avant", "apres", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["Avant", "apres", "", "Fin"]);
});

test("une compétence vide juste après est réutilisée, sans nouvelle ligne", () => {
  const skills = [{ id: "a", name: "Excel" }, { id: "v", name: "" }, { id: "b", name: "SQL" }];
  const split = splitLine(cv(undefined, skills), "skills.a.name", "Excel", "", "x");
  assert.deepEqual(split.data.skills.map((s) => s.name), ["Excel", "", "SQL"]);
  assert.equal(split.nextPath, `skills.${split.data.skills[1].id}.name`);
});

test("une puce faite d'espaces réutilisée est vidée : la frappe ne commence pas par des espaces", () => {
  const split = splitLine(cv(["A", "   ", "B"]), BULLET(0), "A", "", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["A", "", "B"]);
});

test("coupe dans un passage en gras : marquage refermé et rouvert", () => {
  assert.deepEqual(splitRich("Puce **en gra", "s** fin"), ["Puce **en gra**", "**s** fin"]);
  assert.equal(stripRich("Puce **en gra**") + stripRich("**s** fin"), "Puce en gras fin");
  assert.deepEqual(splitRich("*ita", "lique*"), ["*ita*", "*lique*"]);
  assert.deepEqual(splitRich("__sou", "ligné__"), ["__sou__", "__ligné__"]);
});

test("coupe hors d'un passage ou dans ses signes : marquage laissé entier", () => {
  assert.deepEqual(splitRich("Avant ", "**gras** apres"), ["Avant ", "**gras** apres"]);
  assert.deepEqual(splitRich("**gras** ", "apres"), ["**gras** ", "apres"]);
  assert.deepEqual(splitRich("a *", "*gras** b"), ["a ", "**gras** b"]);
  assert.deepEqual(splitRich("a **gras*", "* b"), ["a **gras**", " b"]);
  assert.deepEqual(splitRich("Sans marquage", " du tout"), ["Sans marquage", " du tout"]);
});

test("Entrée dans une compétence crée la suivante, avec l'identifiant fourni", () => {
  const split = splitLine(cv(), "skills.a.name", "Excel", "", "x");
  assert.deepEqual(split.data.skills.map((s) => [s.id, s.name]), [["a", "Excel"], ["x", ""], ["b", "SQL"]]);
  assert.equal(split.nextPath, "skills.x.name");
});

test("le même identifiant donne le même résultat (fonction de mise à jour rejouée par React)", () => {
  const data = cv();
  assert.deepEqual(splitLine(data, "skills.a.name", "Excel", "", "x"), splitLine(data, "skills.a.name", "Excel", "", "x"));
});

test("plusieurs Entrée à la suite gardent le contenu et l'ordre", () => {
  let data = cv();
  let path = BULLET(1);
  for (const [before, after] of [["Second", ""], ["Trois", ""], ["Quatre", ""]]) {
    const split = splitLine(data, path, before, after, "x");
    data = split.data;
    path = split.nextPath;
  }
  assert.deepEqual(data.experiences[0].bullets, ["Premier", "Second", "Trois", "Quatre", ""]);
  assert.equal(path, BULLET(4));
});

test("bloqué à la limite de lignes remplies, avec le message de la liste", () => {
  const full = Array.from({ length: CV_LIMITS.bullets }, (_, i) => `Puce ${i}`);
  assert.equal(splitLine(cv(full), BULLET(0), "Puce 0", "", "x"), null);
  assert.equal(lineLimitMessage(BULLET(0)), `Maximum ${CV_LIMITS.bullets} puces atteint`);
  const skills = Array.from({ length: CV_LIMITS.skills }, (_, i) => ({ id: `s${i}`, name: `C ${i}` }));
  assert.equal(splitLine(cv(undefined, skills), "skills.s0.name", "C 0", "", "x"), null);
  assert.equal(lineLimitMessage("skills.s0.name"), `Maximum ${CV_LIMITS.skills} compétences atteint`);
});

test("les lignes vides ne comptent pas : retirées s'il faut de la place, résultat valide", () => {
  const bullets = ["", ...Array.from({ length: CV_LIMITS.bullets - 1 }, (_, i) => `Puce ${i}`)];
  const split = splitLine(cv(bullets), BULLET(1), "Puce 0", "", "x");
  assert.equal(split.data.experiences[0].bullets.length, CV_LIMITS.bullets);
  assert.equal(split.nextPath, BULLET(1));
  assert.equal(CvDataSchema.safeParse(split.data).success, true);
});

test("chemin inconnu : pas de scission", () => {
  assert.equal(splitLine(cv(), "experiences.inconnue.bullets.0", "a", "", "x"), null);
  assert.equal(splitLine(cv(), BULLET(9), "a", "", "x"), null);
  assert.equal(splitLine(cv(), "skills.inconnue.name", "a", "", "x"), null);
  assert.equal(splitLine(cv(), "summary", "a", "", "x"), null);
});

test("les puces vides ou faites d'espaces sont retirées, l'ordre et le reste du CV intacts", () => {
  const data = cv(["A", "", "B", "   ", "\n", "C"]);
  const cleaned = withoutEmptyLines(data);
  assert.deepEqual(cleaned.experiences[0].bullets, ["A", "B", "C"]);
  assert.deepEqual({ ...cleaned, experiences: null }, { ...data, experiences: null });
  assert.deepEqual(data.experiences[0].bullets, ["A", "", "B", "   ", "\n", "C"], "CV d'origine non modifié");
});

test("une expérience reste présente quand toutes ses puces sont vides", () => {
  const cleaned = withoutEmptyLines(cv(["", " "]));
  assert.equal(cleaned.experiences.length, 1);
  assert.deepEqual(cleaned.experiences[0].bullets, []);
});

test("le coach ne reçoit aucune puce vide, et les positions sont celles du contenu nettoyé", () => {
  const json = JSON.parse(JSON.stringify(chatContent(cv(["A", "", "B", " "]))));
  assert.deepEqual(json.experiences[0].bullets, ["A", "B"]);
});

test("une scission reste possible sur l'état de l'éditeur, qui garde sa puce vide", () => {
  const editor = splitLine(cv(["A", "B"]), BULLET(0), "A", "", "x").data;
  assert.deepEqual(editor.experiences[0].bullets, ["A", "", "B"]);
  assert.deepEqual(withoutEmptyLines(editor).experiences[0].bullets, ["A", "B"]);
});

const skillsOf = (result) => result.data.skills.map((s) => s.name);
const GROUPS = [{ id: "h", name: "Hard skills :" }, { id: "l", name: "Analyse, Excel" }, { id: "s", name: "Soft skills : Rigueur" }];

test("Retour arrière après un intitulé seul : recollé avec une espace, curseur à la jonction", () => {
  const merged = mergeLine(cv(undefined, GROUPS), "skills.l.name");
  assert.deepEqual(skillsOf(merged), ["Hard skills : Analyse, Excel", "Soft skills : Rigueur"]);
  assert.equal(merged.targetPath, "skills.h.name");
  assert.equal(merged.offset, "Hard skills : ".length);
});

test("Retour arrière entre deux compétences : recollé avec une virgule", () => {
  const merged = mergeLine(cv(), "skills.b.name");
  assert.deepEqual(skillsOf(merged), ["Excel, SQL"]);
  assert.equal(merged.offset, "Excel, ".length);
});

test("Entrée puis Retour arrière rendent le texte d'origine", () => {
  const start = "Hard skills : Analyse, Modèle, Excel";
  for (const [before, after] of [["Hard skills :", "Analyse, Modèle, Excel"], ["Hard skills : Analyse,", "Modèle, Excel"], ["Hard skills : Analyse", ", Modèle, Excel"]]) {
    const split = splitLine(cv(undefined, [{ id: "g", name: start }]), "skills.g.name", before, after, "x");
    assert.deepEqual(skillsOf(mergeLine(split.data, "skills.x.name")), [start]);
  }
  const text = "Pilotage de 3 budgets";
  const split = splitLine(cv([text]), BULLET(0), "Pilotage de", "3 budgets", "x");
  assert.deepEqual(mergeLine(split.data, BULLET(1)).data.experiences[0].bullets, [text]);
});

test("Retour arrière entre deux puces : recollé avec une espace, positions justes", () => {
  const merged = mergeLine(cv(["A", "B", "C"]), BULLET(1));
  assert.deepEqual(merged.data.experiences[0].bullets, ["A B", "C"]);
  assert.equal(merged.targetPath, BULLET(0));
  assert.equal(merged.offset, 2);
});

test("Retour arrière sur une ligne vide : simplement retirée, curseur en fin de la précédente", () => {
  const bullet = mergeLine(cv(["A", "", "C"]), BULLET(1));
  assert.deepEqual(bullet.data.experiences[0].bullets, ["A", "C"]);
  assert.equal(bullet.offset, 1);
  const skill = mergeLine(cv(undefined, [{ id: "a", name: "Excel" }, { id: "v", name: "  " }, { id: "b", name: "SQL" }]), "skills.v.name");
  assert.deepEqual(skillsOf(skill), ["Excel", "SQL"]);
  assert.equal(skill.offset, 5);
});

test("Retour arrière par-dessus une ligne vide cachée : elle disparaît, la vraie précédente reçoit le texte", () => {
  const merged = mergeLine(cv(["A", "", " ", "C", "D"]), BULLET(3));
  assert.deepEqual(merged.data.experiences[0].bullets, ["A C", "D"]);
  assert.equal(merged.targetPath, BULLET(0));
});

test("Retour arrière sur la première ligne : rien, même avec des lignes vides au-dessus", () => {
  assert.equal(mergeLine(cv(), BULLET(0)), null);
  assert.equal(mergeLine(cv(["", "A"]), BULLET(1)), null);
  assert.equal(mergeLine(cv(), "skills.a.name"), null);
  assert.equal(mergeLine(cv(), "summary"), null);
  assert.equal(mergeLine(cv(), "experiences.inconnue.bullets.0"), null);
});

test("Retour arrière : texte recollé trop long refusé, CV toujours valide sinon", () => {
  const half = "x".repeat(CV_LIMITS.bullet / 2 + 1);
  assert.deepEqual(mergeLine(cv([half, half]), BULLET(1)), { tooLong: true });
  const fits = "y".repeat(CV_LIMITS.bullet / 2 - 1);
  assert.equal(CvDataSchema.safeParse(mergeLine(cv([fits, fits]), BULLET(1)).data).success, true);
});

test("Retour arrière : le niveau de la compétence précédente est gardé", () => {
  const merged = mergeLine(cv(undefined, [{ id: "a", name: "Excel", level: "avance" }, { id: "b", name: "SQL" }]), "skills.b.name");
  assert.equal(merged.data.skills[0].level, "avance");
});

test("un intitulé seul est reconnu comme groupe, sans liste", () => {
  assert.deepEqual(splitSkillGroup("Hard skills :"), { label: "Hard skills :", items: "" });
  assert.deepEqual(splitSkillGroup("Hard skills : "), { label: "Hard skills :", items: " " });
  assert.equal(splitSkillGroup("Hard skills : Excel, SQL").items, " Excel, SQL");
  assert.equal(splitSkillGroup("Excel"), null);
  assert.equal(splitSkillGroup("https://exemple.fr"), null, "une URL n'est pas un intitulé");
  assert.equal(splitSkillGroup("Un intitule beaucoup trop long pour etre un groupe :"), null);
});

test("Entrée devant la liste d'un groupe : l'intitulé reste seul, sans perte de texte", () => {
  const data = cv(undefined, [{ id: "h", name: "Hard skills : Analyse, Excel" }, { id: "s", name: "Soft skills : Rigueur" }]);
  const split = splitLine(data, "skills.h.name", "Hard skills :", "Analyse, Excel", "x");
  assert.deepEqual(split.data.skills.map((s) => s.name), ["Hard skills :", "Analyse, Excel", "Soft skills : Rigueur"]);
  assert.equal(split.nextPath, "skills.x.name");
});

test("Entrée sur une virgule : elle ne reste sur aucune des deux lignes", () => {
  const names = (before, after) => splitLine(cv(undefined, [{ id: "h", name: `${before}${after}` }]), "skills.h.name", before, after, "x").data.skills.map((s) => s.name);
  assert.deepEqual(names("Hard skills : A,", " B"), ["Hard skills : A", "B"]);
  assert.deepEqual(names("Hard skills : A", ", B"), ["Hard skills : A", "B"]);
});

test("une virgule dans une puce n'est pas retirée par la coupe", () => {
  const split = splitLine(cv(["Avec, puis, fin"]), BULLET(0), "Avec,", "puis, fin", "x");
  assert.deepEqual(split.data.experiences[0].bullets, ["Avec,", "puis, fin"]);
});

const EDU = (i) => `education.f.bullets.${i}`;
const school = (honors, bullets) => CvDataSchema.parse({ education: [{ id: "f", school: "EM", degree: "Master", honors, bullets }] });
const eduOf = (result) => result.data.education[0];

test("une ancienne formation, sans puces, reste lisible", () => {
  assert.deepEqual(CvDataSchema.parse({ education: [{ id: "f", honors: "Mention bien" }] }).education[0].bullets, []);
});

test("formation : les puces et la mention sont des lignes de liste, pas les autres champs", () => {
  assert.equal(isLinePath(EDU(0)), true);
  assert.equal(isLinePath("education.f.honors"), true);
  assert.equal(isLinePath("education.f.degree"), false);
  assert.equal(isLinePath("education.f.school"), false);
});

test("Entrée en fin de mention : première puce en dessous", () => {
  const split = splitLine(school("Cours suivis", []), "education.f.honors", "Cours suivis", "", "x");
  assert.equal(eduOf(split).honors, "Cours suivis");
  assert.deepEqual(eduOf(split).bullets, [""]);
  assert.equal(split.nextPath, EDU(0));
});

test("Entrée au milieu d'une mention : coupe, et la suite passe en première puce", () => {
  const split = splitLine(school("Cours : finance", ["Classement"]), "education.f.honors", "Cours :", "finance", "x");
  assert.equal(eduOf(split).honors, "Cours :");
  assert.deepEqual(eduOf(split).bullets, ["finance", "Classement"]);
});

test("Entrée dans une puce de formation : coupe au curseur, curseur en dessous", () => {
  const split = splitLine(school("", ["Cours de finance", "Classement"]), EDU(0), "Cours", "de finance", "x");
  assert.deepEqual(eduOf(split).bullets, ["Cours", "de finance", "Classement"]);
  assert.equal(split.nextPath, EDU(1));
});

test("formation : limite de 12 puces, puces vides hors décompte", () => {
  const full = Array.from({ length: CV_LIMITS.bullets }, (_, i) => `Puce ${i}`);
  assert.equal(splitLine(school("", full), EDU(0), "Puce 0", "", "x"), null);
  assert.equal(splitLine(school("Mention", full), "education.f.honors", "Mention", "", "x"), null);
  assert.equal(lineLimitMessage(EDU(0)), `Maximum ${CV_LIMITS.bullets} puces atteint`);
  const withBlank = ["", ...full.slice(1)];
  assert.equal(CvDataSchema.safeParse(splitLine(school("", withBlank), EDU(1), "Puce 1", "", "x").data).success, true);
});

test("Retour arrière dans la formation : recolle entre puces, et la première puce à la mention", () => {
  const between = mergeLine(school("", ["Cours", "de finance", "Fin"]), EDU(1));
  assert.deepEqual(eduOf(between).bullets, ["Cours de finance", "Fin"]);
  assert.equal(between.targetPath, EDU(0));
  const toHonors = mergeLine(school("Cours :", ["finance", "Fin"]), EDU(0));
  assert.equal(eduOf(toHonors).honors, "Cours : finance");
  assert.deepEqual(eduOf(toHonors).bullets, ["Fin"]);
  assert.equal(toHonors.targetPath, "education.f.honors");
  assert.equal(toHonors.offset, "Cours : ".length);
});

test("Retour arrière dans la formation : ligne vide retirée, première ligne intacte, longueur vérifiée", () => {
  assert.deepEqual(eduOf(mergeLine(school("Mention", [""]), EDU(0))).bullets, []);
  assert.equal(mergeLine(school("", ["Seule"]), EDU(0)), null);
  assert.equal(mergeLine(school("Mention", []), "education.f.honors"), null);
  assert.deepEqual(mergeLine(school("x".repeat(250), ["y".repeat(100)]), EDU(0)), { tooLong: true });
});

test("formation : Entrée puis Retour arrière rendent le texte d'origine", () => {
  const split = splitLine(school("Cours suivis finance", []), "education.f.honors", "Cours suivis", "finance", "x");
  assert.equal(eduOf(mergeLine(split.data, EDU(0))).honors, "Cours suivis finance");
});

test("formation : puces vides nettoyées à l'enregistrement et invisibles pour le coach", () => {
  assert.deepEqual(withoutEmptyLines(school("M", ["A", "", " ", "B"])).education[0].bullets, ["A", "B"]);
  assert.deepEqual(JSON.parse(JSON.stringify(chatContent(school("M", ["A", ""])))).education[0].bullets, ["A"]);
});

test("limite de caractères de chaque champ, identique à la validation", () => {
  for (const [path, build] of [
    ["personal.firstName", (v) => ({ personal: { firstName: v } })],
    ["personal.phone", (v) => ({ personal: { phone: v } })],
    ["personal.jobTitle", (v) => ({ personal: { jobTitle: v } })],
    ["personal.linkedin", (v) => ({ personal: { linkedin: v } })],
    ["summary", (v) => ({ summary: v })],
    ["interests", (v) => ({ interests: v })],
    ["experiences.e.startDate", (v) => ({ experiences: [{ id: "e", startDate: v }] })],
    ["experiences.e.position", (v) => ({ experiences: [{ id: "e", position: v }] })],
    ["experiences.e.bullets.0", (v) => ({ experiences: [{ id: "e", bullets: [v] }] })],
    ["education.f.endDate", (v) => ({ education: [{ id: "f", endDate: v }] })],
    ["education.f.honors", (v) => ({ education: [{ id: "f", honors: v }] })],
    ["education.f.bullets.0", (v) => ({ education: [{ id: "f", bullets: [v] }] })],
    ["skills.a.name", (v) => ({ skills: [{ id: "a", name: v }] })],
    ["languages.l.name", (v) => ({ languages: [{ id: "l", name: v }] })],
    ["languages.l.level", (v) => ({ languages: [{ id: "l", level: v }] })],
    ["certifications.c.name", (v) => ({ certifications: [{ id: "c", name: v }] })],
    ["certifications.c.date", (v) => ({ certifications: [{ id: "c", date: v }] })],
    ["projects.p.name", (v) => ({ projects: [{ id: "p", name: v }] })],
    ["projects.p.description", (v) => ({ projects: [{ id: "p", description: v }] })],
    ["projects.p.link", (v) => ({ projects: [{ id: "p", link: v }] })],
  ]) {
    const limit = fieldLimit(path);
    assert.equal(CvDataSchema.safeParse(build("x".repeat(limit))).success, true, `${path} : ${limit} accepté`);
    assert.equal(CvDataSchema.safeParse(build("x".repeat(limit + 1))).success, false, `${path} : ${limit + 1} refusé`);
  }
});

test("le champ refusé est nommé, avec sa limite", () => {
  const message = (input) => invalidCvField(CvDataSchema.safeParse(input).error);
  assert.deepEqual(message({ education: [{ id: "a" }, { id: "b", honors: "x".repeat(301) }] }), {
    path: "education.1.honors",
    message: "Le champ « Formation 2 : mention » est trop long (300 caractères maximum).",
  });
  assert.deepEqual(message({ experiences: [{ id: "a", bullets: ["x".repeat(501)] }] }), {
    path: "experiences.0.bullets.0",
    message: "Le champ « Expérience 1 : puce 1 » est trop long (500 caractères maximum).",
  });
  assert.equal(message({ personal: { jobTitle: "x".repeat(301) } }).message, "Le champ « Titre du CV » est trop long (300 caractères maximum).");
  assert.equal(message({ summary: "x".repeat(2001) }).message, "Le champ « Accroche » est trop long (2000 caractères maximum).");
  assert.equal(message({ skills: Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`, name: "a" })) }).message, "Le champ « Compétence » contient trop d'éléments (40 maximum).");
  assert.equal(message({ skills: [{ id: "a", name: "x", level: "inconnu" }] }).message, "Le champ « Compétence 1 : niveau » est invalide.");
});

const SKILLS = [{ id: "a", name: "Excel", level: "avance" }, { id: "v", name: "" }, { id: "b", name: "SQL" }, { id: "s", name: "   " }, { id: "g", name: "Hard skills : Python, Java" }];

test("les compétences vides ou faites d'espaces sont retirées, l'ordre et les niveaux intacts", () => {
  const data = cv(undefined, SKILLS);
  const cleaned = withoutEmptyLines(data);
  assert.deepEqual(cleaned.skills.map((s) => [s.id, s.name, s.level]), [["a", "Excel", "avance"], ["b", "SQL", ""], ["g", "Hard skills : Python, Java", ""]]);
  assert.equal(data.skills.length, 5, "CV d'origine non modifié");
});

test("le coach ne reçoit aucune compétence vide", () => {
  const json = JSON.parse(JSON.stringify(chatContent(cv(undefined, SKILLS))));
  assert.deepEqual(json.skills.map((s) => s.id), ["a", "b", "g"]);
});

test("une compétence vide reste dans l'état de l'éditeur, mais pas dans ce qui est enregistré", () => {
  const editor = splitLine(cv(), "skills.a.name", "Excel", "", "x").data;
  assert.deepEqual(editor.skills.map((s) => s.name), ["Excel", "", "SQL"]);
  assert.deepEqual(withoutEmptyLines(editor).skills.map((s) => s.name), ["Excel", "SQL"]);
});

test("les sauts de ligne d'un paragraphe sont conservés à l'enregistrement", () => {
  assert.equal(CvDataSchema.parse({ summary: "Ligne 1\n\nLigne 3\n" }).summary, "Ligne 1\n\nLigne 3\n");
});
