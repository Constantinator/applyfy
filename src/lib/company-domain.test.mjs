// Domaine d'une entreprise pour son logo (company-domain.ts). Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

const { companyDomain, nameKey, domainMatchesName, isPlatformHost, registrableDomain, withAliases, COMPANY_ALIASES, PLATFORM_DOMAINS, WEBMAIL_DOMAINS } =
  await import("./company-domain.ts");

const KNOWN = new Map([
  ["alan", "alan.com"],
  ["mistralai", "mistral.ai"],
  ["backmarket", "backmarket.com"],
]);
const domainOf = (name, offerUrl = null, contactEmail = null) => companyDomain({ name, offerUrl, contactEmail }, KNOWN);

test("nom normalisé (nameKey) : accents, casse, ponctuation, formes juridiques, pays en fin de nom", () => {
  const cases = [
    ["Ing bank n.v. france", "ingbank"],
    ["ING", "ing"],
    ["BNP Paribas France", "bnpparibas"],
    ["BNP Paribas S.A.", "bnpparibas"],
    ["KPMG France", "kpmg"],
    ["Crédit Agricole Cib", "creditagricolecib"],
    ["Crédit Agricole CIB", "creditagricolecib"],
    ["Societe Generale", "societegenerale"],
    ["Société Générale", "societegenerale"],
    ["Kepler Cheuvreux SA", "keplercheuvreux"],
    ["Onepoint", "onepoint"],
    ["One Point", "onepoint"],
    ["EY", "ey"],
    ["Ernst & Young", "ernstyoung"],
    ["Fidelity International", "fidelityinternational"],
    ["Heritage Holdings", "heritageholdings"],
    ["Groupe Alpha", "groupealpha"],
    ["Bank of America", "bankofamerica"],
    ["Virya Energy", "viryaenergy"],
    ["France Travail", "francetravail"],
    ["Emalec", "emalec"],
    ["ClubFunding", "clubfunding"],
    ["L'Oréal S.A.", "loreal"],
    ["Deutsche Bank AG", "deutschebank"],
    ["Back Market SAS", "backmarket"],
    ["Mistral AI", "mistralai"],
    ["Acme Inc.", "acme"],
    // Lot 1 : companyKey retirait « groupe » ; nameKey le garde (homonymes).
    ["Groupe SEB", "groupeseb"],
    ["AG2R La Mondiale", "ag2rlamondiale"],
    // Garde-fous : un nom fait seulement de forme juridique ou de pays reste lui-même.
    ["SA", "sa"],
    ["France", "france"],
    ["Europe SAS", "europe"],
    // Lot 2b : le lieu reste après une préposition ou un mot générique ; un sigle court le perd toujours.
    ["Banque de France", "banquedefrance"],
    ["Électricité de France", "electricitedefrance"],
    ["EDF", "edf"],
    ["Crédit Agricole Ile-de-France", "creditagricoleiledefrance"],
    ["Caisse d'Epargne Ile de France", "caissedepargneiledefrance"],
    ["Air France", "airfrance"],
    ["AXA France", "axa"],
    ["EY France", "ey"],
    ["PwC France", "pwc"],
    ["BCG France", "bcg"],
    ["ING France", "ing"],
    ["BNP Paribas France", "bnpparibas"],
    ["Business France", "businessfrance"],
    ["Radio France", "radiofrance"],
    ["Orange France", "orange"],
  ];
  for (const [name, key] of cases) assert.equal(nameKey(name), key, name);
  assert.equal(nameKey(null), "");
  assert.equal(nameKey("  "), "");
});

test("lot 2b : clés modifiées par la règle du lieu — liste exacte ; aucune dans la liste vérifiée ; ancienne clé pour relire la table", async () => {
  const { readFileSync } = await import("node:fs");
  const { legacyNameKey } = await import("./company-domain.ts");
  const ats = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const boards = [...readFileSync(new URL("./job-boards.ts", import.meta.url), "utf8").matchAll(/name: "([^"]+)", domain: "/g)].map((m) => m[1]);
  const curated = [...ats.map((company) => company.name), ...boards, ...Object.keys(COMPANY_ALIASES), ...Object.values(COMPANY_ALIASES)];
  assert.deepEqual([...new Set(curated)].filter((name) => nameKey(name) !== legacyNameKey(name)), [], "clés de la liste vérifiée modifiées : ajouter un alias");
  // Noms suivis (lignes admin de la table comprises) : seules ces clés changent.
  const tracked = [
    "AXA France", "EY France", "PwC France", "BCG France", "ING France", "BNP Paribas France", "KPMG France", "Orange France",
    "Air France", "Business France", "Banque de France", "Électricité de France", "Crédit Agricole Ile-de-France", "EY", "PwC", "KPMG",
  ];
  const changed = tracked.filter((name) => nameKey(name) !== legacyNameKey(name)).map((name) => `${name} : ${legacyNameKey(name)} → ${nameKey(name)}`);
  assert.deepEqual(changed, [
    "Air France : air → airfrance",
    "Business France : business → businessfrance",
    "Banque de France : banquede → banquedefrance",
    "Électricité de France : electricitede → electricitedefrance",
    "Crédit Agricole Ile-de-France : creditagricoleilede → creditagricoleiledefrance",
  ]);
});

test("liste vérifiée : prioritaire, quel que soit le nom exact (casse, forme juridique)", () => {
  assert.equal(domainOf("Alan"), "alan.com");
  assert.equal(domainOf("ALAN SAS"), "alan.com");
  assert.equal(domainOf("Mistral AI", "https://jobs.ashbyhq.com/mistral.ai/123"), "mistral.ai");
  // Homonyme exact : la liste l'emporte sur l'adresse de l'offre (risque accepté, nom identique).
  assert.equal(domainOf("Alan", "https://www.alan-allman.com/jobs/1"), "alan.com");
  // Nom différent : pas la liste, l'adresse de l'offre (si cohérente).
  assert.equal(domainOf("Alan Allman Associates", "https://www.alanallman.com/jobs/1"), "alanallman.com");
});

test("plateformes : domaine principal exact, jamais une sous-chaîne", () => {
  for (const host of ["media.licdn.com", "d1234.cloudfront.net", "s3.eu-west-3.amazonaws.com", "lh3.googleusercontent.com", "acme.blob.core.windows.net", "acme.csod.com", "ing.wd3.myworkdayjobs.com", "keplercheuvreux.teamtailor.com", "audencia.jobteaser.com", "hire.withgoogle.com", "acme.avature.net", "jobs.lu", "www.jobup.ch"]) {
    assert.ok(isPlatformHost(host), host);
  }
  // Cas de la mesure du 19/11 : jamais un logo de plateforme ni de CDN.
  assert.equal(domainOf("Harmonie Mutuelle", "https://media.licdn.com/dms/image/abc"), null);
  assert.equal(domainOf("ING Bank N.V. France", "https://ing.wd3.myworkdayjobs.com/fr/job/1"), null);
  assert.equal(domainOf("Kepler Cheuvreux", "https://keplercheuvreux.teamtailor.com/jobs/1"), null);
  for (const host of ["linkedin.com", "fr.linkedin.com", "www.indeed.fr", "jobs.lever.co", "boards.greenhouse.io", "jobs.ashbyhq.com", "jobs.smartrecruiters.com", "apply.workable.com", "www.welcometothejungle.com", "candidat.francetravail.fr", "bit.ly", "lnkd.in", "fr.talent.com"]) {
    assert.ok(isPlatformHost(host), host);
  }
  // google : la vraie entreprise n'est pas une plateforme, ses documents partagés oui.
  assert.ok(!isPlatformHost("google.com"));
  assert.ok(!isPlatformHost("careers.google.com"));
  assert.ok(isPlatformHost("docs.google.com"));
  // lever, talent, bit : des noms proches restent des entreprises.
  assert.ok(!isPlatformHost("lever.com"));
  assert.ok(!isPlatformHost("leverage.co"));
  assert.ok(!isPlatformHost("talan.com"));
  assert.ok(!isPlatformHost("talentsoft.com"));
  assert.ok(!isPlatformHost("bitpanda.com"));
  // free : messagerie pour un e-mail, mais pas une plateforme pour une adresse d'offre.
  assert.ok(!isPlatformHost("free.fr"));
  assert.ok(WEBMAIL_DOMAINS.has("free.fr"));
  assert.ok(!isPlatformHost("freelance.com"));
  // Listes en minuscules, domaines valides.
  for (const domain of [...PLATFORM_DOMAINS, ...WEBMAIL_DOMAINS]) assert.equal(registrableDomain(domain), domain, domain);
});

test("adresse de l'offre : plateforme ou cabinet → initiales ; site de l'entreprise → domaine principal", () => {
  assert.equal(domainOf("Qonto", "https://jobs.lever.co/qonto/123"), null);
  assert.equal(domainOf("Société Générale", "https://www.hays.fr/offre/123"), null);
  assert.equal(domainOf("Société Générale", "https://careers.societegenerale.com/offre/123"), "societegenerale.com");
  assert.equal(domainOf("Google", "https://careers.google.com/jobs/123"), "google.com");
  assert.equal(domainOf("Google", "https://docs.google.com/document/d/1"), null);
  assert.equal(domainOf("Free", "https://www.free.fr/carrieres"), "free.fr");
});

test("sous-domaines et suffixes en deux parties", () => {
  assert.equal(registrableDomain("careers.qonto.com"), "qonto.com");
  assert.equal(registrableDomain("WWW.Qonto.COM."), "qonto.com");
  assert.equal(registrableDomain("jobs.acme.co.uk"), "acme.co.uk");
  assert.equal(registrableDomain("acme.com.au"), "acme.com.au");
  assert.equal(registrableDomain("careers.acme.com.br"), "acme.com.br");
  assert.equal(registrableDomain("www.acme.co.jp"), "acme.co.jp");
  assert.equal(registrableDomain("co.uk"), null);
  assert.equal(domainOf("Acme", "https://jobs.acme.co.uk/role/1"), "acme.co.uk");
});

test("adresses et e-mails invalides : aucune requête vers Logo.dev", () => {
  for (const url of ["pas une adresse", "ftp://acme.com/x", "http://192.168.1.10/acme", "http://localhost:3000/acme", "javascript:alert('acme')", "https://acme", "https://-acme-.com"]) {
    assert.equal(domainOf("Acme", url), null, url);
  }
  for (const email of ["acme@", "@acme.com", "a@b@acme.com", "jean acme@acme.com", "jean@localhost"]) {
    assert.equal(domainOf("Acme", null, email), null, email);
  }
  assert.equal(registrableDomain("1.2.3.4"), null);
  assert.equal(domainOf("", "https://acme.com"), null);
  assert.equal(domainOf(null, "https://acme.com"), null);
});

test("e-mail du contact : messageries et plateformes écartées, domaine pro cohérent retenu", () => {
  assert.equal(domainOf("Qonto", null, "jean.dupont@qonto.com"), "qonto.com");
  assert.equal(domainOf("Qonto", null, "Jean@Mail.Qonto.com"), "qonto.com");
  assert.equal(domainOf("Qonto", null, "jean.dupont@gmail.com"), null);
  assert.equal(domainOf("Free", null, "jean@free.fr"), null);
  assert.equal(domainOf("Orange", null, "jean@orange.fr"), null);
  assert.equal(domainOf("Qonto", null, "recrutement@michaelpage.fr"), null);
  assert.equal(domainOf("Qonto", null, "jobs@greenhouse.io"), null);
  // Adresse de l'offre sur une plateforme : l'e-mail prend le relais.
  assert.equal(domainOf("Qonto", "https://www.linkedin.com/jobs/view/1", "rh@qonto.com"), "qonto.com");
});

test("cohérence nom/domaine : homonymes et agences → initiales", () => {
  assert.ok(domainMatchesName("backmarket.com", "Back Market"));
  assert.ok(domainMatchesName("societegenerale.com", "Société Générale"));
  assert.ok(domainMatchesName("alan-consulting.fr", "Alan Consulting"));
  assert.ok(domainMatchesName("lvmh.com", "LVMH Moët Hennessy"));
  assert.ok(!domainMatchesName("acme.com", "Qonto"));
  // Moins de 3 caractères : jamais assez sûr.
  assert.ok(!domainMatchesName("bx-consulting.fr", "BX"));
  assert.ok(!domainMatchesName("ab.fr", "Abeille"));
  assert.equal(domainOf("Qonto", "https://www.recrutement-finance.fr/offre/1"), null);
  assert.equal(domainOf("BNP Paribas", "https://group.bnpparibas/emploi"), null);
});

test("career-companies.json : chaque entreprise a un domaine principal valide, hors plateformes et messageries", async () => {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const companies = data;
  const byName = new Map();
  for (const company of companies) {
    const { domain } = company;
    assert.equal(typeof domain, "string", `${company.name} : domaine manquant`);
    assert.equal(registrableDomain(domain), domain, `${company.name} : ${domain} n'est pas un domaine principal valide`);
    assert.ok(!isPlatformHost(domain), `${company.name} : ${domain} est une plateforme`);
    assert.ok(!WEBMAIL_DOMAINS.has(domain), `${company.name} : ${domain} est une messagerie`);
    // Une même entreprise (plusieurs secteurs) a toujours le même domaine.
    if (byName.has(company.name)) assert.equal(byName.get(company.name), domain, company.name);
    byName.set(company.name, domain);
  }
  assert.equal(byName.size, 78);
});

test("alias : anciens noms et noms juridiques sûrs → domaine de la liste vérifiée", async () => {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const base = new Map(data.map((company) => [nameKey(company.name), company.domain]));
  const known = withAliases(base);
  const of = (name, offerUrl = null) => companyDomain({ name, offerUrl }, known);
  // Offres SmartRecruiters (og:site_name « MAZARS ») et ancien nom.
  assert.equal(of("Mazars"), "forvismazars.com");
  assert.equal(of("MAZARS"), "forvismazars.com");
  assert.equal(of("Mazars Group"), "forvismazars.com"); // alias explicite (« group » jamais retiré)
  assert.equal(of("Forvis Mazars"), "forvismazars.com");
  assert.equal(of("TGTG"), "toogoodtogo.com");
  assert.equal(of("TooGoodToGo"), "toogoodtogo.com");
  assert.equal(of("BackMarket"), "backmarket.com");
  assert.equal(of("Back Market SAS"), "backmarket.com");
  assert.equal(of("Saint Gobain"), "saint-gobain.com");
  assert.equal(of("AccorHotels"), "accor.com");
  assert.equal(of("Robert Bosch GmbH"), "bosch.com");
  assert.equal(of("Sendinblue"), "brevo.com");
  assert.equal(of("vente-privee.com"), "veepee.fr");
  assert.equal(of("Mistral AI"), "mistral.ai");
  // Ambigu : pas d'alias ; seulement si le site de l'offre est cohérent.
  assert.equal(of("Mistral"), null);
  assert.equal(of("Mistral", "https://careers.mistral.ai/jobs/1"), "mistral.ai");
  assert.equal(of("Vestiaire"), null);
  // Chaque alias vise une entreprise de la liste et n'écrase aucune entrée existante.
  for (const [alias, official] of Object.entries(COMPANY_ALIASES)) {
    assert.ok(base.has(nameKey(official)), `${alias} → ${official} absent de la liste`);
    assert.ok(!base.has(nameKey(alias)), `${alias} est déjà une entreprise de la liste`);
  }
});

test("ordre : blocked (initiales) > liste vérifiée > table partagée « verified » > déduction de cette personne", () => {
  const shared = new Map([
    ["kpmg", { domain: "kpmg.com", status: "verified" }],
    ["alan", { domain: "alan-autre.com", status: "verified" }],
    ["backmarket", { domain: null, status: "blocked" }],
    ["acme", { domain: null, status: "blocked" }],
    ["groupealpha", { domain: null, status: "none" }],
    ["emalec", { domain: null, status: "ambiguous" }],
    ["piege", { domain: "piege.lever.co", status: "verified" }],
  ]);
  const of = (name, offerUrl = null, contactEmail = null) => companyDomain({ name, offerUrl, contactEmail }, KNOWN, shared);
  assert.equal(of("KPMG France"), "kpmg.com");
  // La liste vérifiée l'emporte sur la table.
  assert.equal(of("Alan"), "alan.com");
  // blocked : initiales, même pour la liste vérifiée et malgré une adresse cohérente.
  assert.equal(of("Back Market"), null);
  assert.equal(of("Acme", "https://www.acme.com/jobs/1", "rh@acme.com"), null);
  // none / ambiguous : la déduction de cette personne reste possible.
  assert.equal(of("Groupe Alpha", "https://careers.groupealpha.com/1"), "groupealpha.com");
  assert.equal(of("Emalec"), null);
  // Un domaine de plateforme dans la table n'est jamais affiché.
  assert.equal(of("Piege"), null);
  // Sans table (migration non lancée) : comportement du lot 1.
  assert.equal(companyDomain({ name: "KPMG France" }, KNOWN), null);
  assert.equal(companyDomain({ name: "Alan" }, KNOWN), "alan.com");
});

test("domaines explicites : chaque nom donne le bon domaine ; aucune autre clé ne change", async () => {
  const { readFileSync } = await import("node:fs");
  const { EXPLICIT_DOMAINS } = await import("./company-domain.ts");
  const ats = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const boards = [...readFileSync(new URL("./job-boards.ts", import.meta.url), "utf8").matchAll(/name: "([^"]+)", domain: "([^"]+)"/g)].map((m) => ({ name: m[1], domain: m[2] }));
  const base = new Map([...ats, ...boards].map((company) => [nameKey(company.name), company.domain]));
  const all = withAliases(base);
  for (const [name, domain] of [
    ["BCG France", "bcg.com"], ["BCG", "bcg.com"], ["ING France", "ing.com"], ["ING", "ing.com"], ["AXA France", "axa.fr"], ["AXA", "axa.fr"],
    ["Leroy Merlin", "leroymerlin.fr"], ["Leroy Merlin France", "leroymerlin.fr"], ["LEROY MERLIN SAS", "leroymerlin.fr"],
    ["Crédit Agricole Personal Finance & Mobility", "ca-personalfinancemobility.com"], ["CA Personal Finance & Mobility", "ca-personalfinancemobility.com"],
    ["WisdomTree", "wisdomtree.com"], ["WisdomTree UK", "wisdomtree.com"], ["Wisdomtree uk", "wisdomtree.com"],
    ["Banque de France", "banque-france.fr"],
  ]) {
    assert.equal(companyDomain({ name }, all), domain, name);
  }
  // Domaines principaux valides, jamais une plateforme ; aucune entrée explicite en double sur une clé de la liste.
  for (const [name, domain] of Object.entries(EXPLICIT_DOMAINS)) {
    assert.equal(registrableDomain(domain), domain, name);
    assert.equal(isPlatformHost(domain), false, name);
    assert.equal(base.has(nameKey(name)), false, `${name} : déjà dans la liste vérifiée`);
  }
  // Ajouts par rapport à la liste : alias existants + exactement bcg, ing, axa ; aucune entrée modifiée.
  for (const [key, domain] of base) assert.equal(all.get(key), domain, key);
  const aliasKeys = new Set(Object.keys(COMPANY_ALIASES).map(nameKey));
  const added = [...all.keys()].filter((key) => !base.has(key) && !aliasKeys.has(key)).sort();
  assert.deepEqual(added, [
    "axa", "banquedefrance", "bcg", "capersonalfinancemobility", "creditagricolepersonalfinancemobility", "ing", "leroymerlin", "wisdomtree", "wisdomtreeuk",
  ]);
  assert.equal(Object.keys(EXPLICIT_DOMAINS).length, 13);
  // Le domaine explicite passe avant la table partagée, mais jamais avant une ligne « blocked ».
  assert.equal(companyDomain({ name: "ING Bank" }, all), null);
  for (const name of Object.keys(EXPLICIT_DOMAINS)) {
    assert.equal(companyDomain({ name }, all, new Map([[nameKey(name), { domain: null, status: "blocked" }]])), null, name);
  }
});

// ---------------------------------------------------------------------------------------------
// Lot logos 2d : Banque de France (domaine explicite), ligne admin acceptée même pour un domaine
// de la liste des plateformes (Adecco), mesure de couverture des logos sur « Trouver une offre ».
// ---------------------------------------------------------------------------------------------
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { readFileSync: readSource } = await import("node:fs");
const { domainOrigin, legacyNameKey, logLogoCoverage, logoCoverageLine } = await import("./company-domain.ts");
const { keysToRead, makeCompanyDomainsReader } = await import("./company-domains-read.ts");

const KNOWN_2D = withAliases(new Map([["mirakl", "mirakl.com"]]));
const row2d = (status, domain, source = "logo_dev_search") => ({ status, domain, source });

test("Banque de France : domaine explicite sous la clé banquedefrance, ancienne clé banquede toujours lue", () => {
  assert.equal(nameKey("Banque de France"), "banquedefrance");
  assert.equal(legacyNameKey("Banque de France"), "banquede");
  assert.equal(KNOWN_2D.get("banquedefrance"), "banque-france.fr");
  assert.equal(companyDomain({ name: "Banque de France" }, KNOWN_2D), "banque-france.fr");
  assert.equal(companyDomain({ name: "BANQUE DE FRANCE" }, KNOWN_2D), "banque-france.fr");
  assert.deepEqual(keysToRead(["Banque de France"]).sort(), ["banquede", "banquedefrance"]);
  // Une ligne « blocked » l'emporte toujours, même sur la liste explicite.
  const blocked = new Map([["banquedefrance", row2d("blocked", null, "admin")]]);
  assert.equal(companyDomain({ name: "Banque de France" }, KNOWN_2D, blocked), null);
  // « Banque » seule ou « Banque de Savoie » ne reprennent pas ce domaine.
  assert.equal(companyDomain({ name: "Banque" }, KNOWN_2D), null);
  assert.equal(companyDomain({ name: "Banque de Savoie" }, KNOWN_2D), null);
});

test("Adecco France : la ligne admin donne adecco.fr malgré la liste des plateformes", () => {
  assert.equal(isPlatformHost("adecco.fr"), true);
  const shared = new Map([["adecco", row2d("verified", "adecco.fr", "admin")]]);
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, shared), "adecco.fr");
  assert.equal(domainOrigin({ name: "Adecco France" }, KNOWN_2D, shared), "table");
});

test("plateforme toujours refusée hors saisie admin : recherche Logo.dev, URL, e-mail", () => {
  // Ligne trouvée par la recherche Logo.dev : refusée si le domaine est une plateforme.
  const searched = new Map([["adecco", row2d("verified", "adecco.fr", "logo_dev_search")]]);
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, searched), null);
  // Ligne sans source connue : traitée comme automatique.
  const unknown = new Map([["adecco", { status: "verified", domain: "adecco.fr" }]]);
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, unknown), null);
  // Déduction par l'adresse de l'offre ou l'e-mail du contact : refusée.
  assert.equal(companyDomain({ name: "Adecco", offerUrl: "https://www.adecco.fr/offre/123" }, KNOWN_2D), null);
  assert.equal(companyDomain({ name: "Adecco", contactEmail: "rh@adecco.fr" }, KNOWN_2D), null);
  // Une ligne admin « blocked » l'emporte toujours.
  const blocked = new Map([["adecco", row2d("blocked", "adecco.fr", "admin")]]);
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, blocked), null);
  // Une ligne admin dont le domaine n'est pas un domaine valide reste refusée.
  const invalid = new Map([["adecco", row2d("verified", "pas un domaine", "admin")]]);
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, invalid), null);
});

test("lecture de company_domains : la colonne source est lue et transmise", async () => {
  let columns = "";
  const client = {
    from: () => ({
      select: (cols) => {
        columns = cols;
        return {
          in: async () => ({
            data: [{ name_key: "adecco", display_name: "Adecco", domain: "adecco.fr", status: "verified", source: "admin" }],
            error: null,
          }),
        };
      },
    }),
  };
  const table = await makeCompanyDomainsReader(() => {})(client, ["Adecco France"]);
  assert.match(columns, /\bsource\b/);
  assert.deepEqual(table.get("adecco"), { domain: "adecco.fr", status: "verified", source: "admin" });
  assert.equal(companyDomain({ name: "Adecco France" }, KNOWN_2D, table), "adecco.fr");
});

const OFFERS = [
  { source: "france-travail", company: "Mirakl", url: "https://candidat.francetravail.fr/1" }, // liste
  { source: "france-travail", company: "Adecco France", url: "https://candidat.francetravail.fr/2" }, // table (admin)
  { source: "france-travail", company: "Boulangerie Durand", url: "https://www.boulangerie-durand.fr/emploi" }, // url
  { source: "france-travail", company: "Climb", url: "https://candidat.francetravail.fr/3" }, // ambigu_none
  { source: "france-travail", company: "Société Inconnue SAS", url: "https://candidat.francetravail.fr/4" }, // inconnu
  { source: "france-travail", company: null, url: "https://candidat.francetravail.fr/5" }, // sans_nom
  { source: "adzuna", company: "Entreprise non communiquée", url: "https://www.adzuna.fr/details/6" }, // sans_nom
  { source: "adzuna", company: "Mirakl", url: "https://www.adzuna.fr/details/7" }, // liste
  { source: "job-boards", company: "Mirakl", url: "https://jobs.mirakl.com/8" }, // non mesurée
];
const SHARED = new Map([
  ["adecco", row2d("verified", "adecco.fr", "admin")],
  ["climb", row2d("ambiguous", null)],
]);

test("mesure : une ligne par source mesurée, comptes justes", () => {
  const lines = [];
  logLogoCoverage(OFFERS, KNOWN_2D, SHARED, (line) => lines.push(line), () => assert.fail("aucune erreur attendue"));
  assert.deepEqual(lines, [
    "[offres] logos source=ft n=6 liste=1 table=1 url=1 ambigu_none=1 inconnu=1 sans_nom=1",
    "[offres] logos source=adzuna n=2 liste=1 table=0 url=0 ambigu_none=0 inconnu=0 sans_nom=1",
  ]);
  // Page sans offre France Travail ni Adzuna : aucune ligne.
  const none = [];
  logLogoCoverage([OFFERS[8]], KNOWN_2D, SHARED, (line) => none.push(line));
  assert.deepEqual(none, []);
});

test("mesure : la ligne ne contient que des nombres, jamais un nom d'entreprise ni une adresse", () => {
  const lines = [];
  logLogoCoverage(OFFERS, KNOWN_2D, SHARED, (line) => lines.push(line));
  for (const line of lines) {
    assert.match(line, /^\[offres\] logos source=(ft|adzuna) n=\d+ liste=\d+ table=\d+ url=\d+ ambigu_none=\d+ inconnu=\d+ sans_nom=\d+$/);
    for (const offer of OFFERS) {
      if (offer.company) assert.ok(!line.toLowerCase().includes(offer.company.toLowerCase().split(" ")[0]), line);
      assert.ok(!line.includes(offer.url), line);
    }
  }
  assert.doesNotMatch(logoCoverageLine("france-travail<script>", [], KNOWN_2D, SHARED), /[<>-]/);
});

test("mesure : un échec du comptage ne lève jamais d'exception (la page s'affiche)", () => {
  const broken = { get() { throw new TypeError("carte cassée"); } };
  const lines = [];
  const errors = [];
  assert.doesNotThrow(() => logLogoCoverage(OFFERS, broken, SHARED, (l) => lines.push(l), (l) => errors.push(l)));
  assert.deepEqual(lines, []);
  assert.deepEqual(errors, ["[offres] logos : comptage impossible (TypeError)"]);
  // Offres illisibles : idem.
  assert.doesNotThrow(() => logLogoCoverage(null, KNOWN_2D, SHARED, () => {}, (l) => errors.push(l)));
  assert.equal(errors.length, 2);
});

test("page /offres : mesure appelée une fois, sur les données déjà lues, sans await", () => {
  const page = readSource(new URL("../app/(app)/offres/page.tsx", import.meta.url), "utf8");
  const calls = page.match(/logLogoCoverage\(/g) ?? [];
  assert.equal(calls.length, 1);
  assert.match(page, /if \(result\) logLogoCoverage\(result\.offers, KNOWN_COMPANY_DOMAINS, sharedDomains\);/);
  assert.doesNotMatch(page, /await logLogoCoverage/);
  // Appelée après la lecture unique de company_domains (aucune requête de plus).
  assert.equal((page.match(/loadCompanyDomains\(/g) ?? []).length, 1);
  assert.ok(page.indexOf("loadCompanyDomains(") < page.indexOf("logLogoCoverage(result"));
});
