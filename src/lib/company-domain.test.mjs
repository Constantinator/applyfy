// Domaine d'une entreprise pour son logo (company-domain.ts). Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

const { companyDomain, companyKey, domainMatchesName, isPlatformHost, registrableDomain, PLATFORM_DOMAINS, WEBMAIL_DOMAINS } =
  await import("./company-domain.ts");

const KNOWN = new Map([
  ["alan", "alan.com"],
  ["mistralai", "mistral.ai"],
  ["backmarket", "backmarket.com"],
]);
const domainOf = (name, offerUrl = null, contactEmail = null) => companyDomain({ name, offerUrl, contactEmail }, KNOWN);

test("nom normalisé : accents, casse, ponctuation et forme juridique retirés", () => {
  assert.equal(companyKey("Back Market SAS"), "backmarket");
  assert.equal(companyKey("Société Générale"), "societegenerale");
  assert.equal(companyKey("Mistral AI"), "mistralai");
  assert.equal(companyKey("Acme Inc."), "acme");
  assert.equal(companyKey("Groupe SEB"), "seb");
  assert.equal(companyKey("AG2R La Mondiale"), "ag2rlamondiale");
  assert.equal(companyKey(null), "");
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

test("ats-companies.json : chaque entreprise a un domaine principal valide, hors plateformes et messageries", async () => {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync(new URL("./ats-companies.json", import.meta.url), "utf8"));
  const companies = Object.values(data).flat();
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
