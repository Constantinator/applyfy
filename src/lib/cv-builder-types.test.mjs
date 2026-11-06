// Touche Entrée dans les listes du CV Builder. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { CV_LIMITS, chatContent, CvDataSchema, enterAction, fieldLimit, fieldLimitMessage, fitCvData, hasLineMerge, invalidCvField, isLinePath, keepsCaretOnBlank, lineLimitMessage, lineMergeMessage, mergeLine, readCvData, readField, readInterests, splitLine, splitSkillGroup, withoutEmptyLines, writeInterests } from "./cv-builder-types.ts";
import { splitRich, stripRich } from "./cv-rich-text.ts";

const cv = (bullets = ["Premier", "Second"], skills = [{ id: "a", name: "Excel" }, { id: "b", name: "SQL" }]) =>
  CvDataSchema.parse({ experiences: [{ id: "e", position: "Poste", bullets }], skills });
const BULLET = (i) => `experiences.e.bullets.${i}`;

test("seules les lignes des listes sont des lignes de liste", () => {
  assert.equal(isLinePath(BULLET(0)), true);
  assert.equal(isLinePath("skills.a.name"), true);
  assert.equal(isLinePath("summary"), false);
  assert.equal(isLinePath("personal.city"), false);
  assert.equal(isLinePath("languages.a.name"), true);
  assert.equal(isLinePath("languages.a.level"), false);
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

test("reconnaissance d'un groupe : mêmes règles, et instantanée sur un long mot sans deux-points", () => {
  assert.equal(splitSkillGroup("Un deux trois quatre : a").label, "Un deux trois quatre :");
  assert.equal(splitSkillGroup("Un deux trois quatre cinq : a"), null);
  assert.equal(splitSkillGroup("  Hard skills: a").label, "  Hard skills:");
  const start = performance.now();
  for (let i = 0; i < 50; i++) {
    assert.equal(splitSkillGroup("y".repeat(CV_LIMITS.short)), null);
    assert.equal(splitSkillGroup(`aaa bbb ccc ${"y".repeat(CV_LIMITS.short - 12)}`), null);
  }
  assert.ok(performance.now() - start < 200, "pas de retour en arrière exponentiel");
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
    ["personal.lastName", (v) => ({ personal: { lastName: v } })],
    ["personal.email", (v) => ({ personal: { email: v } })],
    ["personal.city", (v) => ({ personal: { city: v } })],
    ["personal.website", (v) => ({ personal: { website: v } })],
    ["personal.github", (v) => ({ personal: { github: v } })],
    ["experiences.e.company", (v) => ({ experiences: [{ id: "e", company: v }] })],
    ["experiences.e.location", (v) => ({ experiences: [{ id: "e", location: v }] })],
    ["experiences.e.endDate", (v) => ({ experiences: [{ id: "e", endDate: v }] })],
    ["education.f.degree", (v) => ({ education: [{ id: "f", degree: v }] })],
    ["education.f.school", (v) => ({ education: [{ id: "f", school: v }] })],
    ["education.f.startDate", (v) => ({ education: [{ id: "f", startDate: v }] })],
    ["certifications.c.issuer", (v) => ({ certifications: [{ id: "c", issuer: v }] })],
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
    message: "Le champ « Formation 2 : mention » est trop long, maximum 300 caractères.",
  });
  assert.deepEqual(message({ experiences: [{ id: "a", bullets: ["x".repeat(501)] }] }), {
    path: "experiences.0.bullets.0",
    message: "Le champ « Expérience 1 : puce 1 » est trop long, maximum 500 caractères.",
  });
  assert.equal(message({ personal: { jobTitle: "x".repeat(301) } }).message, "Le champ « Titre du CV » est trop long, maximum 300 caractères.");
  assert.equal(message({ summary: "x".repeat(2001) }).message, "Le champ « Accroche » est trop long, maximum 2000 caractères.");
  assert.equal(message({ skills: Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`, name: "a" })) }).message, "Le champ « Compétence » contient trop d'éléments, maximum 40.");
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

const full = (over = {}) =>
  CvDataSchema.parse({
    experiences: [{ id: "e", position: "Analyste", company: "Acme", bullets: [] }],
    education: [{ id: "f", degree: "Master", school: "EM", bullets: [] }],
    skills: [{ id: "s", name: "Excel" }],
    languages: [{ id: "l", name: "Anglais", level: "C1" }, { id: "m", name: "Espagnol", level: "" }],
    certifications: [{ id: "c", name: "AMF", issuer: "AMF", date: "2023" }, { id: "d", name: "TOEIC", issuer: "", date: "" }],
    projects: [{ id: "p", name: "Applyfy", description: "SaaS", link: "" }, { id: "q", name: "Blog", description: "", link: "" }],
    interests: "Tennis\nVoile",
    ...over,
  });

test("effet d'Entrée de chaque champ", () => {
  for (const [path, action] of [
    ["title", "validate"], ["targetJob", "validate"], ["personal.firstName", "validate"], ["personal.jobTitle", "validate"],
    ["personal.email", "validate"], ["personal.linkedin", "validate"], ["experiences.e.startDate", "validate"], ["education.f.endDate", "validate"],
    ["certifications.c.date", "validate"], ["projects.p.link", "validate"],
    ["summary", "newline"], ["projects.p.description", "newline"], ["interests", "newline"],
    ["experiences.e.bullets.0", "line"], ["education.f.bullets.0", "line"], ["education.f.honors", "line"], ["skills.s.name", "line"],
    ["languages.l.name", "line"], ["certifications.c.name", "line"], ["projects.p.name", "line"], ["interests.0", "line"],
    ["experiences.e.position", "below"], ["experiences.e.company", "below"], ["experiences.e.location", "below"],
    ["education.f.degree", "below"], ["education.f.school", "below"], ["languages.l.level", "below"], ["certifications.c.issuer", "below"],
  ]) assert.equal(enterAction(path), action, path);
});

test("Retour arrière : seules les lignes de liste et les descriptions de projet se recollent", () => {
  assert.equal(hasLineMerge("languages.l.name"), true);
  assert.equal(hasLineMerge("projects.p.description"), true);
  assert.equal(hasLineMerge("summary"), false);
  assert.equal(hasLineMerge("personal.city"), false);
});

for (const [section, path, nameOf] of [
  ["languages", "languages.l.name", (d) => d.languages],
  ["certifications", "certifications.c.name", (d) => d.certifications],
]) {
  test(`${section} : Entrée coupe au curseur et crée l'élément dessous, le reste de l'élément ne bouge pas`, () => {
    const split = splitLine(full(), path, "Avant", "apres", "x");
    const items = nameOf(split.data);
    assert.deepEqual(items.slice(0, 2).map((i) => [i.id, i.name]), [[path.split(".")[1], "Avant"], ["x", "apres"]]);
    assert.equal(split.nextPath, `${section}.x.name`);
    assert.equal(CvDataSchema.safeParse(split.data).success, true);
    assert.equal(items[0].id === path.split(".")[1] && (items[0].level ?? items[0].issuer) !== "", true);
  });
}

test("niveau de langue et organisme : Entrée crée l'élément suivant sans changer le texte", () => {
  const language = splitLine(full(), "languages.l.level", "C1", "", "x");
  assert.deepEqual(language.data.languages.map((l) => [l.name, l.level]), [["Anglais", "C1"], ["", ""], ["Espagnol", ""]]);
  assert.equal(language.nextPath, "languages.x.name");
  const certification = splitLine(full(), "certifications.c.issuer", "AMF", "", "x");
  assert.equal(certification.data.certifications[0].issuer, "AMF");
  assert.equal(certification.nextPath, "certifications.x.name");
});

test("intitulé d'expérience ou de formation : première puce dessous, intitulé intact", () => {
  for (const [path, list, bulletPath] of [
    ["experiences.e.position", (d) => d.experiences[0], "experiences.e.bullets.0"],
    ["experiences.e.company", (d) => d.experiences[0], "experiences.e.bullets.0"],
    ["education.f.degree", (d) => d.education[0], "education.f.bullets.0"],
    ["education.f.school", (d) => d.education[0], "education.f.bullets.0"],
  ]) {
    const split = splitLine(full(), path, "ignoré", "", "x");
    assert.deepEqual(list(split.data).bullets, [""], path);
    assert.equal(split.nextPath, bulletPath);
    assert.equal(readField(split.data, path), readField(full(), path));
  }
});

test("intitulé : la puce vide de tête est réutilisée, et la limite de 12 puces s'applique", () => {
  const once = splitLine(full(), "experiences.e.position", "", "", "x").data;
  assert.deepEqual(splitLine(once, "experiences.e.position", "", "", "x").data.experiences[0].bullets, [""]);
  const twelve = Array.from({ length: CV_LIMITS.bullets }, (_, i) => `Puce ${i}`);
  assert.equal(splitLine(full({ experiences: [{ id: "e", position: "A", bullets: twelve }] }), "experiences.e.position", "", "", "x"), null);
  const filled = splitLine(full({ experiences: [{ id: "e", position: "A", bullets: ["Existante"] }] }), "experiences.e.position", "", "", "x");
  assert.deepEqual(filled.data.experiences[0].bullets, ["", "Existante"]);
});

test("mention vide : Entrée crée la première puce au lieu de rester sans effet", () => {
  assert.equal(keepsCaretOnBlank("education.f.honors"), false);
  assert.equal(keepsCaretOnBlank("experiences.e.bullets.0"), true);
  const split = splitLine(full(), "education.f.honors", "", "", "x");
  assert.equal(split.nextPath, "education.f.bullets.0");
  assert.deepEqual(split.data.education[0].bullets, [""]);
});

test("Retour arrière sur une puce vide de tête : retirée, curseur à la fin de l'intitulé", () => {
  const merged = mergeLine(full({ experiences: [{ id: "e", position: "Analyste", bullets: ["", "A"] }] }), "experiences.e.bullets.0");
  assert.deepEqual(merged.data.experiences[0].bullets, ["A"]);
  assert.equal(merged.targetPath, "experiences.e.position");
  assert.equal(merged.offset, "Analyste".length);
  const onlySchool = mergeLine(full({ education: [{ id: "f", school: "EM", bullets: [""] }] }), "education.f.bullets.0");
  assert.equal(onlySchool.targetPath, "education.f.school");
});

test("nom de projet : sans description, Entrée y descend ; avec description, nouveau projet", () => {
  const toDescription = splitLine(full(), "projects.q.name", "Blog", "", "x");
  assert.equal(toDescription.nextPath, "projects.q.description");
  assert.equal(toDescription.data.projects.length, 2);
  const cut = splitLine(full(), "projects.q.name", "Blog", "perso", "x");
  assert.deepEqual([cut.data.projects[1].name, cut.data.projects[1].description], ["Blog", "perso"]);
  const next = splitLine(full(), "projects.p.name", "Applyfy", "", "x");
  assert.deepEqual(next.data.projects.map((p) => p.id), ["p", "x", "q"]);
  assert.equal(next.nextPath, "projects.x.name");
});

test("description de projet : Retour arrière au début revient au nom, sans perte", () => {
  const blank = mergeLine(full(), "projects.q.description");
  assert.equal(blank.targetPath, "projects.q.name");
  assert.equal(blank.offset, "Blog".length);
  const cut = splitLine(full(), "projects.q.name", "Blog", "perso", "x");
  assert.equal(mergeLine(cut.data, "projects.q.description").data.projects[1].name, "Blog perso");
  assert.equal(mergeLine(full({ projects: [{ id: "p", name: "A", description: "l1\nl2" }] }), "projects.p.description"), null, "paragraphe sur plusieurs lignes : intact");
  assert.deepEqual(mergeLine(full({ projects: [{ id: "p", name: "A", description: "x".repeat(400) }] }), "projects.p.description"), { tooLong: true });
});

test("listes : Entrée puis Retour arrière rendent le texte d'origine", () => {
  const language = splitLine(full(), "languages.m.name", "Espa", "gnol", "x");
  assert.equal(mergeLine(language.data, "languages.x.name").data.languages[1].name, "Espa, gnol");
  const certification = splitLine(full(), "certifications.d.name", "TOEIC", "Listening", "x");
  assert.equal(mergeLine(certification.data, "certifications.x.name").data.certifications[1].name, "TOEIC Listening");
});

test("listes : un élément avec d'autres informations n'est pas recollé, rien n'est perdu", () => {
  const data = full({ languages: [{ id: "a", name: "Anglais", level: "C1" }, { id: "b", name: "Espagnol", level: "B2" }] });
  const merged = mergeLine(data, "languages.b.name");
  assert.deepEqual(merged, { hasDetails: true });
  assert.match(lineMergeMessage(merged), /d'autres informations/);
  assert.equal(mergeLine(full(), "languages.l.name"), null, "première ligne");
});

test("listes : limite de 20 éléments, avec son message, éléments vides hors décompte", () => {
  const twenty = Array.from({ length: CV_LIMITS.items }, (_, i) => ({ id: `i${i}`, name: `L${i}` }));
  assert.equal(splitLine(full({ languages: twenty }), "languages.i0.name", "L0", "", "x"), null);
  assert.equal(lineLimitMessage("languages.i0.name"), "Maximum 20 langues atteint");
  assert.equal(lineLimitMessage("certifications.i0.name"), "Maximum 20 certifications atteint");
  assert.equal(lineLimitMessage("projects.i0.name"), "Maximum 20 projets atteint");
  const withBlank = [{ id: "v", name: "" }, ...twenty.slice(1)];
  assert.equal(CvDataSchema.safeParse(splitLine(full({ languages: withBlank }), "languages.i1.name", "L1", "", "x").data).success, true);
});

test("listes : un élément vide juste après est réutilisé", () => {
  const data = full({ languages: [{ id: "a", name: "Anglais" }, { id: "v", name: "" }, { id: "b", name: "Italien" }] });
  assert.equal(splitLine(data, "languages.a.name", "Anglais", "", "x").data.languages.length, 3);
});

test("centres d'intérêt : lecture, écriture, Entrée et Retour arrière de l'onglet Contenu", () => {
  assert.deepEqual(readInterests(""), []);
  assert.deepEqual(readInterests("Tennis, Voile"), ["Tennis", "Voile"]);
  assert.deepEqual(readInterests("Tennis\nVoile"), ["Tennis", "Voile"]);
  assert.deepEqual(readInterests(writeInterests([""])), [""], "une ligne vide reste une ligne");
  assert.equal(writeInterests([]), "");
  const split = splitLine(full(), "interests.0", "Ten", "nis", "x");
  assert.equal(split.data.interests, "Ten\nnis\nVoile");
  assert.equal(split.nextPath, "interests.1");
  const merged = mergeLine(split.data, "interests.1");
  assert.equal(merged.data.interests, "Ten nis\nVoile");
  assert.equal(merged.targetPath, "interests.0");
  assert.equal(mergeLine(full(), "interests.0"), null);
  assert.equal(splitLine(full({ interests: "x".repeat(CV_LIMITS.interests) }), "interests.0", "x".repeat(CV_LIMITS.interests), "", "x"), null);
  assert.match(lineLimitMessage("interests.0"), /Centres d'intérêt.*maximum 500/);
});

test("nettoyage : éléments et lignes vides retirés, éléments avec contenu et paragraphes intacts", () => {
  const cleaned = withoutEmptyLines(full({
    summary: "a\n\nb",
    languages: [{ id: "a", name: "Anglais" }, { id: "v", name: " ", level: "" }, { id: "n", name: "", level: "C1" }],
    certifications: [{ id: "v", name: "" }, { id: "c", name: "AMF" }],
    projects: [{ id: "v", name: " ", description: "" }, { id: "d", name: "", description: "Garde" }],
    interests: "Tennis\n\n \nVoile\n",
  }));
  assert.deepEqual(cleaned.languages.map((l) => l.id), ["a", "n"]);
  assert.deepEqual(cleaned.certifications.map((c) => c.id), ["c"]);
  assert.deepEqual(cleaned.projects.map((p) => p.id), ["d"]);
  assert.equal(cleaned.interests, "Tennis\nVoile");
  assert.equal(cleaned.summary, "a\n\nb");
  assert.equal(withoutEmptyLines(full({ interests: "Tennis, Voile" })).interests, "Tennis, Voile");
  const json = JSON.parse(JSON.stringify(chatContent(full({ languages: [{ id: "v", name: "" }] }))));
  assert.deepEqual(json.languages, [], "le coach ne les voit pas");
});

test("messages de limite : le champ est nommé, avec sa limite", () => {
  assert.equal(fieldLimitMessage("personal.jobTitle"), "Le champ « Titre du CV » est trop long, maximum 300 caractères.");
  assert.equal(fieldLimitMessage("title"), "Le champ « Nom du CV » est trop long, maximum 120 caractères.");
  assert.equal(fieldLimitMessage("targetJob"), "Le champ « Poste visé » est trop long, maximum 120 caractères.");
  assert.equal(fieldLimitMessage("experiences.abc.bullets.2"), "Le champ « Expérience : puce 3 » est trop long, maximum 500 caractères.");
  assert.equal(fieldLimitMessage("languages.abc.level"), "Le champ « Langue : niveau » est trop long, maximum 60 caractères.");
  assert.equal(fieldLimitMessage("interests.1", 12), "Le champ « Centres d'intérêt » est trop long, maximum 12 caractères.");
  assert.equal(fieldLimit("title"), CV_LIMITS.title);
  assert.equal(fieldLimit("targetJob"), CV_LIMITS.targetJob);
  assert.equal(fieldLimit("interests.3"), CV_LIMITS.interests);
});

test("lecture d'un champ par chemin", () => {
  assert.equal(readField(full(), "languages.l.level"), "C1");
  assert.equal(readField(full(), "experiences.e.position"), "Analyste");
  assert.equal(readField(full({ experiences: [{ id: "e", bullets: ["A", "B"] }] }), "experiences.e.bullets.1"), "B");
  assert.equal(readField(full(), "languages.inconnue.level"), undefined);
});

test("un champ trop long est raccourci, le reste du CV est gardé, et la correction est annoncée", () => {
  const raw = JSON.parse(JSON.stringify(full()));
  raw.personal.jobTitle = "T".repeat(400);
  raw.education[0].honors = "x".repeat(301);
  const { data, fixes } = fitCvData(raw);
  assert.equal(data.personal.jobTitle.length, 300);
  assert.equal(data.education[0].honors.length, 300);
  assert.equal(data.experiences[0].company, "Acme");
  assert.equal(data.languages.length, 2);
  assert.equal(CvDataSchema.safeParse(data).success, true);
  assert.deepEqual(fixes.map((f) => f.path).sort(), ["education.0.honors", "personal.jobTitle"]);
  assert.match(fixes.find((f) => f.path === "personal.jobTitle").message, /Titre du CV.*maximum 300 caractères.*Seuls les 300 premiers/);
});

test("liste trop longue : les vides partent d'abord, puis seuls les premiers éléments sont gardés", () => {
  const blanks = fitCvData({ experiences: [{ id: "e", bullets: ["A", ...Array(15).fill(""), "B"] }] });
  assert.deepEqual(blanks.data.experiences[0].bullets, ["A", "B"]);
  assert.deepEqual(blanks.fixes, []);
  const many = fitCvData({ languages: Array.from({ length: 25 }, (_, i) => ({ id: `l${i}`, name: `L${i}` })) });
  assert.equal(many.data.languages.length, 20);
  assert.match(many.fixes[0].message, /Langue.*maximum 20/);
});

test("valeur invalide : retirée seule, identifiant manquant recréé", () => {
  const { data, fixes } = fitCvData({
    summary: "Gardé",
    skills: [{ id: "a", name: "Excel", level: "inconnu" }],
    experiences: [{ position: "Sans id", bullets: ["A", 3, "B"] }],
    languages: "pas une liste",
    personal: { firstName: "Camille", photo: "pas une photo" },
  });
  assert.equal(data.summary, "Gardé");
  assert.equal(data.skills[0].name, "Excel");
  assert.equal(data.skills[0].level, "");
  assert.equal(data.experiences[0].position, "Sans id");
  assert.ok(data.experiences[0].id);
  assert.deepEqual(data.experiences[0].bullets, ["A", "B"]);
  assert.deepEqual(data.languages, []);
  assert.equal(data.personal.firstName, "Camille");
  assert.equal(data.personal.photo, null);
  assert.ok(fixes.length >= 3);
});

test("un CV stocké avec un champ invalide n'est plus remis à vide à la lecture", () => {
  const raw = JSON.parse(JSON.stringify(full()));
  raw.personal.jobTitle = "T".repeat(400);
  const read = readCvData(raw);
  assert.equal(read.experiences[0].position, "Analyste");
  assert.equal(read.personal.jobTitle.length, 300);
  assert.deepEqual(readCvData(null), CvDataSchema.parse({}));
  assert.deepEqual(readCvData(undefined), CvDataSchema.parse({}));
});

test("le CV d'origine n'est jamais modifié par la correction", () => {
  const raw = { summary: "x".repeat(2001) };
  fitCvData(raw);
  assert.equal(raw.summary.length, 2001);
});
