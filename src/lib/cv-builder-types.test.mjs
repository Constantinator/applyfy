// Touche Entrée dans les listes du CV Builder. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { CV_LIMITS, chatContent, CvDataSchema, isLinePath, lineLimitMessage, splitLine, withoutEmptyLines } from "./cv-builder-types.ts";
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
