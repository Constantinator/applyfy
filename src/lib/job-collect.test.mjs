// Collecte des offres (pages carrières). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { ATS_OFFERS_PER_COMPANY, collectSector, createAtsClient, readCompanyOffers } = await import("./job-collect.ts");

/** Réponses simulées par adresse ; null : la page ne répond pas. */
const fakeGet = (routes) => {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((part) => url.includes(part));
    return key === undefined ? null : routes[key];
  };
  return Object.assign(get, { calls });
};
const all = () => true;
const company = (platform, slug = "acme", extra = {}) => ({ name: "Acme", platform, slug, ...extra });

const migration = readFileSync(new URL("../../supabase/migrations/0036_job_collect.sql", import.meta.url), "utf8");

test("migration : les offres existantes reçoivent last_seen_at avant la contrainte", () => {
  const fill = migration.indexOf("update job_offers_raw set last_seen_at = scraped_at where last_seen_at is null");
  const notNull = migration.indexOf("alter column last_seen_at set not null");
  assert.ok(fill > 0, "remplissage absent");
  assert.ok(notNull > fill, "NOT NULL avant le remplissage");
});

test("migration : aucune suppression, journal fermé aux clients", () => {
  assert.doesNotMatch(migration.replace(/--.*$/gm, ""), /\b(delete|drop|truncate)\b/i);
  assert.match(migration, /alter table job_collect_runs enable row level security/);
  assert.match(migration, /revoke all on job_collect_runs from anon, authenticated/);
});

test("Greenhouse : offres en France, lieu et date de publication", async () => {
  const get = fakeGet({
    "boards-api.greenhouse.io": {
      jobs: [
        { id: 1, title: "Analyste &amp; data", absolute_url: "https://a.fr/1", content: "&lt;p&gt;Texte&lt;/p&gt;", first_published: "2026-11-01T10:00:00Z", location: { name: "Paris, France" } },
        { id: 2, title: "Hors France", absolute_url: "https://a.fr/2", location: { name: "Berlin" } },
        { id: 3, title: "Par bureau", absolute_url: "https://a.fr/3", location: { name: "Remote" }, offices: [{ name: "Lyon" }] },
      ],
    },
  });
  const { offers, failed } = await readCompanyOffers(company("greenhouse"), 10, all, get);
  assert.equal(failed, false);
  assert.deepEqual(offers.map((o) => [o.externalId, o.title, o.location]), [
    ["greenhouse-acme-1", "Analyste & data", "Paris, France"],
    ["greenhouse-acme-3", "Par bureau", "Lyon"],
  ]);
  assert.equal(offers[0].description, "Texte");
  assert.equal(offers[0].publishedAt, "2026-11-01T10:00:00.000Z");
  assert.equal(offers[1].publishedAt, null);
});

test("Lever : pays ou lieu en France, date en millisecondes", async () => {
  const get = fakeGet({
    "api.lever.co": [
      { id: "a", text: "Poste A", hostedUrl: "https://l.fr/a", country: "FR", createdAt: 1_793_000_000_000, categories: { location: "Bordeaux" } },
      { id: "b", text: "Poste B", hostedUrl: "https://l.fr/b", country: "DE", categories: { location: "Munich", allLocations: ["Munich", "Paris"] } },
      { id: "c", text: "Poste C", hostedUrl: "https://l.fr/c", country: "US", categories: { location: "Boston" } },
    ],
  });
  const { offers } = await readCompanyOffers(company("lever"), 10, all, get);
  assert.deepEqual(offers.map((o) => o.location), ["Bordeaux", "Paris"]);
  assert.equal(offers[0].publishedAt, new Date(1_793_000_000_000).toISOString());
  assert.equal(offers[1].publishedAt, null);
});

test("Ashby : offres listées, lieu secondaire en France", async () => {
  const get = fakeGet({
    "api.ashbyhq.com": {
      jobs: [
        { id: "a", title: "Poste A", jobUrl: "https://s.fr/a", location: "Londres", secondaryLocations: [{ location: "Paris" }], publishedAt: "2026-10-30T00:00:00Z" },
        { id: "b", title: "Non listée", jobUrl: "https://s.fr/b", isListed: false, location: "Paris" },
      ],
    },
  });
  const { offers } = await readCompanyOffers(company("ashby"), 10, all, get);
  assert.deepEqual(offers.map((o) => [o.title, o.location]), [["Poste A", "Paris"]]);
});

test("SmartRecruiters : ville de la liste, description lue offre par offre", async () => {
  const get = fakeGet({
    "postings?country=fr": {
      content: [
        { id: "1", name: "Poste 1", releasedDate: "2026-11-02T00:00:00Z", location: { country: "fr", city: "Nantes" } },
        { id: "2", name: "Poste 2", location: { country: "fr" } },
      ],
    },
    "postings/1": { postingUrl: "https://j.fr/1", jobAd: { sections: { a: { text: "<p>Missions</p>" } } } },
    "postings/2": { jobAd: { sections: {} } },
  });
  const { offers } = await readCompanyOffers(company("smartrecruiters"), 10, all, get);
  assert.deepEqual(offers.map((o) => [o.url, o.location, o.description]), [
    ["https://j.fr/1", "Nantes", "Missions"],
    ["https://jobs.smartrecruiters.com/acme/2", null, ""],
  ]);
});

test("limite par entreprise : 10 offres, et pas plus de requêtes de détail", async () => {
  assert.equal(ATS_OFFERS_PER_COMPANY, 10);
  const content = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Poste ${i}`, location: { country: "fr", city: "Lille" } }));
  const get = fakeGet({ "postings?country=fr": { content }, "postings/": { jobAd: { sections: {} } } });
  const { offers } = await readCompanyOffers(company("smartrecruiters"), ATS_OFFERS_PER_COMPANY, all, get);
  assert.equal(offers.length, 10);
  assert.equal(get.calls.length, 11);
});

test("page en erreur : signalée, sans confondre avec une entreprise sans offre", async () => {
  for (const platform of ["greenhouse", "lever", "ashby", "smartrecruiters"]) {
    const { offers, failed } = await readCompanyOffers(company(platform), 10, all, fakeGet({}));
    assert.deepEqual([offers, failed], [[], true], platform);
  }
  const empty = await readCompanyOffers(company("ashby"), 10, all, fakeGet({ "api.ashbyhq.com": { jobs: [] } }));
  assert.deepEqual([empty.offers, empty.failed], [[], false]);
});

test("filtre du métier : toujours pour rh, et seulement si demandé pour marketing", async () => {
  const jobs = {
    jobs: [
      { id: "a", title: "Chargé de recrutement", jobUrl: "https://s.fr/a", location: "Paris" },
      { id: "b", title: "Développeur", jobUrl: "https://s.fr/b", location: "Paris" },
      { id: "c", title: "Chef de produit marketing", jobUrl: "https://s.fr/c", location: "Paris" },
    ],
  };
  const titles = async (sector, extra) => {
    const seen = [];
    await collectSector({
      sector,
      companies: [company("ashby", "acme", extra)],
      get: fakeGet({ "api.ashbyhq.com": jobs }),
      onCompany: (_, offers) => {
        seen.push(...offers.map((o) => o.title));
      },
    });
    return seen;
  };
  assert.deepEqual(await titles("rh"), ["Chargé de recrutement"]);
  assert.equal((await titles("marketing")).length, 3);
  assert.deepEqual(await titles("marketing", { filterTitles: true }), ["Chef de produit marketing"]);
});

test("secteur : entreprises en erreur listées, produits transmis, bilan exact", async () => {
  const companies = [company("ashby", "ok", { products: ["Produit"] }), { ...company("ashby", "panne"), name: "Panne" }];
  const get = fakeGet({ "job-board/ok": { jobs: [{ id: "a", title: "Poste", jobUrl: "https://s.fr/a", location: "Paris" }] } });
  const received = [];
  const result = await collectSector({
    sector: "tech",
    companies,
    get,
    onCompany: (c, offers) => {
      received.push([c.slug, offers.map((o) => o.products)]);
    },
  });
  assert.deepEqual(result, { companiesRead: 2, companiesTotal: 2, companiesFailed: ["Panne"], offersRead: 1, partial: false });
  assert.deepEqual(received, [["ok", [["Produit"]]], ["panne", []]]);
});

test("arrêt demandé : entreprises suivantes laissées, passage marqué partiel", async () => {
  const companies = ["a", "b", "c"].map((slug) => company("ashby", slug));
  let reads = 0;
  const result = await collectSector({
    sector: "tech",
    companies,
    get: fakeGet({ "api.ashbyhq.com": { jobs: [] } }),
    shouldStop: () => reads >= 2,
    onCompany: () => {
      reads++;
    },
  });
  assert.deepEqual([result.companiesRead, result.companiesTotal, result.partial], [2, 3, true]);
});

test("arrêt au milieu des détails SmartRecruiters : les offres lues restent", async () => {
  const content = [1, 2, 3].map((i) => ({ id: String(i), name: `Poste ${i}`, location: { country: "fr" } }));
  const get = fakeGet({ "postings?country=fr": { content }, "postings/": { jobAd: { sections: {} } } });
  const kept = [];
  const result = await collectSector({
    sector: "tech",
    companies: [company("smartrecruiters")],
    get,
    shouldStop: () => get.calls.length >= 3,
    onCompany: (_, offers) => {
      kept.push(...offers);
    },
  });
  assert.equal(kept.length, 2);
  assert.equal(result.partial, true);
});

test("client : délai entre deux requêtes, robot identifié, erreurs sans exception", async () => {
  let clock = 0;
  const waits = [];
  const sent = [];
  const get = createAtsClient({
    delayMs: 1000,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    log: () => {},
    fetchImpl: async (url, init) => {
      sent.push(init.headers["User-Agent"]);
      if (url.endsWith("/panne")) throw new Error("réseau");
      return url.endsWith("/404") ? new Response("", { status: 404 }) : Response.json({ ok: 1 });
    },
  });
  assert.deepEqual(await get("https://x/ok"), { ok: 1 });
  assert.equal(await get("https://x/404"), null);
  assert.equal(await get("https://x/panne"), null);
  assert.deepEqual(waits, [1000, 1000]);
  assert.match(sent[0], /^ApplyfyBot\//);
});
