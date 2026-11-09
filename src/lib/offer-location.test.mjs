// Nettoyage des lieux de la collecte. Lancé par `npm test` (Node 22.18 ou plus).
// Chaque cas vient du relevé des lieux bruts des pages carrières du 08/11/2026 (962 lieux).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { cityCase, cleanLocation, officialCommuneName } = await import("./offer-location.ts");

const label = (...candidates) => cleanLocation(candidates).label;

/** [lieux bruts d'une offre, libellé attendu, source] */
const CASES = [
  // Majuscules et doublons
  [["ABBEVILLE", "ABBEVILLE, , France"], "Abbeville", "Kiabi"],
  [["Abbeville", "Abbeville, Hauts-de-France, France"], "Abbeville", "Accor"],
  [["BASSE-GOULAINE", "BASSE-GOULAINE, Pays de la Loire, France"], "Basse-Goulaine", "Kiabi"],
  [["Basse Goulaine", "Basse Goulaine, Loire Atlantique, France"], "Basse-Goulaine", "Boulanger"],
  // Région vide ou abrégée
  [["ARRAS", "ARRAS, , France"], "Arras", "Bosch"],
  [["ARRAS", "ARRAS, PICARDIE, France"], "Arras", "Kiabi"],
  [["Achères", "Achères, IDF, France"], "Achères", "Accor"],
  [["MONTGERON", "MONTGERON, 91, France"], "Montgeron", "Kiabi"],
  [["VILLEBON SUR YVETTE", "VILLEBON SUR YVETTE, IL DE DE FRANCE, France"], "Villebon-sur-Yvette", "Kiabi"],
  [["Paris", "Paris, Région Île-de-France, France"], "Paris", "Media Participations"],
  [["Dourdan", "Dourdan, Région Île-de-France, France"], "Dourdan", "Media Participations"],
  // Ordre inversé, séparateurs variés
  [["France", "France, Villefranche Sur Saône (Rhône), France"], "Villefranche-sur-Saône", "Kiabi"],
  [["Massy - France"], "Massy", "Ivalua"],
  [["Massy -France"], "Massy", "Ivalua"],
  [["Montpellier - France "], "Montpellier", "Ivalua"],
  [["Lyon 🇫🇷", "Lyon 🇫🇷", "Paris 🇫🇷"], "Lyon, Paris", "Agicap"],
  // La ville n'est pas toujours en tête (règle 4 : grande ville reconnue, sinon premier élément)
  [["Boutique Montaigne, Paris, Île de France", "Boutique Montaigne, Paris, Île de France"], "Paris", "Jacquemus"],
  [["9th arrondissement of Paris, 75009, Paris, France"], "Paris", "Artefact"],
  [["Paris HQ, Île de France", "Paris HQ, Île de France"], "Paris", "Jacquemus"],
  [["Paris offices"], "Paris", "Pennylane"],
  [["Paris", "Paris, Montparnasse, France"], "Paris", "Devoteam"],
  [["Vitrolles", "Vitrolles, Bassin Marseillais, France"], "Vitrolles", "Boulanger"],
  [["Paris", "Paris, Île-de-France, France"], "Paris", "Talan"],
  // Sans ville
  [["Anywhere in France"], "Télétravail (France)", "Alan"],
  [["Anywhere in France, Belgium, Spain"], "Télétravail (France)", "Alan"],
  [["Paris, France", "Anywhere in France"], "Paris", "Alan"],
  [["All France (remote)"], "Télétravail (France)", "Pennylane"],
  [["Paris office", "France: Remote"], "Paris", "Nabla"],
  [["France, Remote"], "Télétravail (France)", "Dataiku"],
  [["France, Remote; Spain, Remote; The Netherlands, Remote"], "Télétravail (France)", "Datadog"],
  [["PARIS OFFICE or REMOTE FROM FRANCE"], "Paris", "Inato"],
  [["France"], "France", "Pennylane"],
  [["United Kingdom", "Dublin", "Spain", "Hungary", "Bulgaria", "Germany", "Poland", "Italy", "Netherlands", "France"], "France", "ElevenLabs"],
  [["Remote – CET (Paris time zone)", "Warsaw", "Tallinn", "Istanbul", "Lisboa", "Berlin", "Tbilisi", "Krakow", "Bucharest", "Kiev"], "Télétravail (France)", "Voodoo"],
  // Listes de lieux, plusieurs pays mélangés
  [["Remote – CET (Paris time zone)", "Paris", "Warsaw", "Malta", "Lisboa", "Tbilisi", "Krakow", "Barcelona"], "Paris", "Voodoo"],
  [["Paris", "Madrid", "Paris", "Warsaw", "Helsinki", "Stockholm", "Berlin", "Amsterdam", "Eindhoven", "Bucharest", "London"], "Paris", "Voodoo"],
  [
    ["Paris", "Madrid", "Warsaw", "Lviv", "Tallinn", "Karkiv", "Malta", "Helsinki", "Stockholm", "Istanbul", "Lisboa", "Berlin", "Tbilisi", "Amsterdam", "Milan", "Krakow", "Bucharest", "London", "Kiev", "Barcelona"],
    "Paris",
    "Voodoo",
  ],
  [["Paris offices", "Germany (remote)", "France", "Spain (remote)", "All France (remote)"], "Paris", "Pennylane"],
  [["Paris", "Portugal (remote)", "Germany (remote)", "Spain (remote)", "Ireland (remote)", "Berlin Office", "United Kingdom (remote)", "Madrid"], "Paris", "Pennylane"],
  [["Dublin, Ireland; London, United Kingdom; Paris, France"], "Paris", "Datadog"],
  [["Madrid Office; Paris Office"], "Paris", "Aircall"],
  [["Lyon", "Annecy", "Bourg en Bresse", "Valence", "Clermont-Ferrand", "Grenoble", "Chambéry", "Saint-Etienne"], "Lyon, Annecy, Bourg-en-Bresse + 5", "Pennylane"],
  [["Marseille", "Nîmes", "Antibes", "Nice", "Aix-en-Provence", "Montpellier", "Avignon"], "Marseille, Nîmes, Antibes + 4", "Pennylane"],
  [["Paris", "Paris", "Bordeaux", "Lille", "Lyon", "Rennes", "Rouen", "Saint-Ouen l’Aumône", "Toulouse"], "Paris, Bordeaux, Lille + 5", "Scaleway"],
  // Pas des communes : « France »
  [["Agglomération Niçoise", "Agglomération Niçoise, Provence-Alpes-Côte d'Azur, France"], "France", "Kiabi"],
  [["LES MILLES", "LES MILLES, , France"], "France", "Loxam"],
  // Orthographe officielle (table des communes)
  [["Saint-Paul-lez-Durance", "Saint-Paul-lez-Durance, Provence-Alpes-Côte d'Azur, France"], "Saint-Paul-lès-Durance", "Assystem"],
  [["Charleville-Mézières", "Charleville-Mézières, Grand Est, France"], "Charleville-Mézières", "Red Bull"],
  [["EVREUX", "EVREUX, , France"], "Évreux", "Boulanger"],
  [["BEZIERS", "BEZIERS, , France"], "Béziers", "Kiabi"],
  [["Chenove", "Chenove, , France"], "Chenôve", "Kiabi"],
  [["cormeilles en parisis", "cormeilles en parisis, , France"], "Cormeilles-en-Parisis", "Kiabi"],
  [["Dommartin Les Toul", "Dommartin Les Toul, Meurthe et moselle, France"], "Dommartin-lès-Toul", "Kiabi"],
  [["Echirolles", "Echirolles, , France"], "Échirolles", "Boulanger"],
  [["Fâches Thumesnil", "Fâches Thumesnil, Nord, France"], "Faches-Thumesnil", "Boulanger"],
  [["Faches-Thumesnil", "Faches-Thumesnil, Hauts-de-France, France"], "Faches-Thumesnil", "Kiabi"],
  [["GRAND COURONNE", "GRAND COURONNE, Normandie, France"], "Grand-Couronne", "Loxam"],
  [["L'ISLE ADAM", "L'ISLE ADAM, Ile de France, France"], "L'Isle-Adam", "Kiabi"],
  [["La roche sur yon", "La roche sur yon, Vendée, France"], "La Roche-sur-Yon", "Boulanger"],
  [["La Roche-sur-Yon", "La Roche-sur-Yon, Pays de la Loire, France"], "La Roche-sur-Yon", "Boulanger"],
  [["SELESTAT", "SELESTAT, , France"], "Sélestat", "Kiabi"],
  [["Orleans", "Orleans, Loiret, France"], "Orléans", "Kiabi"],
  // Noms courts, pris à tort pour des sigles par le premier classement : ce sont des communes
  [["Pau", "Pau, Nouvelle-Aquitaine, France"], "Pau", "Alten"],
  [["Caen", "Caen, Normandy, France"], "Caen", "Red Bull"],
  [["Agen"], "Agen"],
  [["Bron"], "Bron"],
  [["Dax"], "Dax"],
  [["Ibos"], "Ibos"],
  [["Ifs"], "Ifs"],
  [["Lons"], "Lons"],
  [["Metz"], "Metz"],
  [["Nice"], "Nice"],
  [["Rezé"], "Rezé"],
  [["Rots"], "Rots"],
  [["Sens"], "Sens"],
];

for (const [candidates, expected, source] of CASES) {
  test(`lieu : ${JSON.stringify(candidates).slice(0, 90)} → ${expected}${source ? ` (${source})` : ""}`, () => {
    assert.equal(label(...candidates), expected);
  });
}

test("ville absente de la table : nom nettoyé par la règle 6 gardé, jamais « France » par défaut", () => {
  assert.equal(officialCommuneName("Sophia Antipolis"), null);
  assert.equal(label("SOPHIA ANTIPOLIS, , France"), "Sophia Antipolis");
  assert.equal(label("La Défense, Île-de-France, France"), "La Défense");
});

test("règle 6 : particules en minuscules sauf en tête, tirets et apostrophes gardés", () => {
  assert.equal(cityCase("BASSE-GOULAINE"), "Basse-Goulaine");
  assert.equal(cityCase("VILLEFRANCHE SUR SAÔNE"), "Villefranche sur Saône");
  assert.equal(cityCase("LES SABLES D'OLONNE"), "Les Sables d'Olonne");
  assert.equal(cityCase("LE MANS"), "Le Mans");
  assert.equal(cityCase("L'ISLE ADAM"), "L'Isle Adam");
  assert.equal(cityCase("dommartin LES toul"), "Dommartin les Toul");
});

test("homonymes à l'accent près : orthographe officielle seulement si exacte", () => {
  assert.equal(officialCommuneName("Abbécourt"), "Abbécourt");
  assert.equal(officialCommuneName("Abbecourt"), "Abbecourt");
  assert.equal(officialCommuneName("ABBECOURT"), null);
  assert.equal(label("ABBECOURT, , France"), "Abbecourt");
});

test("au plus 3 villes, suivies de « + n », doublons ignorés sans accents, casse ni tirets", () => {
  assert.equal(label("Paris", "PARIS", "Saint Etienne", "Saint-Étienne", "Lyon"), "Paris, Saint-Étienne, Lyon");
  assert.equal(label("Paris; Lyon; Nantes; Lille"), "Paris, Lyon, Nantes + 1");
});

test("aucun lieu : « France »", () => {
  assert.equal(label(), "France");
  assert.equal(label(null, undefined, ""), "France");
});

// --- Table des communes : générée, côté collecte uniquement -----------------------------------

const SRC = fileURLToPath(new URL("../", import.meta.url));
const table = readFileSync(new URL("./communes-fr.ts", import.meta.url), "utf8");

test("table des communes : générée par le script versionné, date de génération en tête", () => {
  assert.match(table, /^\/\/ Fichier généré par scripts\/generate-communes\.mjs le \d{4}-\d{2}-\d{2} /);
  const script = readFileSync(new URL("../../scripts/generate-communes.mjs", import.meta.url), "utf8");
  assert.match(script, /communes-fr\.ts/);
  assert.ok(table.split("\n").length > 30_000);
});

test("table des communes : aucun téléchargement pendant la collecte", () => {
  for (const file of ["offer-location.ts", "communes-fr.ts", "job-collect.ts"]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /geo\.api\.gouv\.fr\/communes|from "\.\/geo"/, file);
  }
  const location = readFileSync(new URL("./offer-location.ts", import.meta.url), "utf8");
  assert.doesNotMatch(location, /\bfetch\(/);
});

/** Fichiers .ts / .tsx de src, hors tests. */
function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("table des communes : importée seulement par la collecte, jamais par une page ni un composant", () => {
  const importers = (module) =>
    sources(SRC)
      .filter((path) => new RegExp(`from ["'][^"']*/${module}["']`).test(readFileSync(path, "utf8")))
      .map((path) => path.slice(SRC.length).replaceAll("\\", "/"))
      .sort();
  assert.deepEqual(importers("communes-fr"), ["lib/offer-location.ts"]);
  assert.deepEqual(importers("offer-location"), ["lib/job-collect.ts"]);
  // job-collect : la route du cron, côté serveur uniquement.
  for (const path of importers("job-collect")) {
    assert.match(path, /^app\/api\/cron\/|^lib\/job-collect\.ts$/, path);
    assert.doesNotMatch(readFileSync(join(SRC, path), "utf8"), /^["']use client["']/m, path);
  }
});
