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
const {
  ATS_OFFERS_PER_COMPANY,
  AtsBlockedError,
  COLLECT_BUDGET_MS,
  COLLECTED_OFFERS_MAX_DAYS,
  PURGE_MIN_REMAINING_MS,
  RATE_LIMIT_MEMORY_MIN_DAYS,
  STORED_DESCRIPTION_MAX_LENGTH,
  USER_OFFERS_MAX_DAYS,
  purgeCutoffs,
  collectSector,
  companiesForSector,
  companyKey,
  createAtsClient,
  planOfferSave,
  readCompanyOffers,
  runSectorCollection,
  saveOffers,
  storedDescription,
} = await import("./job-collect.ts");
const { maskContacts } = await import("./contact-mask.ts");

/** Base simulée : lignes de job_offers_raw, appels à increment_job_keywords. */
function fakeDb(rows = [], { failOn, conflict = [] } = {}) {
  const db = { rows, rpc: [] };
  const fail = (op) => (failOn === op ? { data: null, error: new Error(op) } : null);
  db.from = () => ({
    select: () => {
      const filters = {};
      const chain = {
        eq: (column, value) => ((filters[column] = [value]), chain),
        in: (column, values) => ((filters[column] = values), chain),
        then: (resolve) =>
          resolve(
            fail("select") ?? {
              data: db.rows.filter((row) => Object.entries(filters).every(([column, values]) => values.includes(row[column]))),
              error: null,
            },
          ),
      };
      return chain;
    },
    update: (patch) => ({
      in: async (_column, ids) => {
        const failure = fail("update");
        if (failure) return failure;
        for (const row of db.rows) if (ids.includes(row.id)) Object.assign(row, patch);
        return { error: null };
      },
    }),
    upsert: (row) => ({
      select: async () => {
        const failure = fail("insert");
        if (failure) return failure;
        if (conflict.includes(row.external_id)) return { data: [], error: null };
        db.rows.push({ id: `n${db.rows.length}`, scraped_at: "NOW", ...row });
        return { data: [{ id: row.external_id }], error: null };
      },
    }),
  });
  db.rpc = Object.assign(
    async (_name, args) => {
      db.rpc.calls.push(args);
      return { error: null };
    },
    { calls: [] },
  );
  return db;
}
const toSave = (id, fields = {}) => ({
  externalId: id,
  title: `Poste ${id}`,
  company: "Acme",
  description: "Texte",
  url: `https://a.fr/${id}`,
  location: "Paris",
  publishedAt: null,
  source: "ats",
  sector: "tech",
  keywords: ["SQL"],
  ...fields,
});
const SEEN_AT = new Date("2026-11-08T03:00:00Z");

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
const purgeMigration = readFileSync(new URL("../../supabase/migrations/0037_job_offers_purge.sql", import.meta.url), "utf8");

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

test("migration 0037 : rejouable, aucune suppression hors de la fonction, fonction fermée aux clients", () => {
  const code = purgeMigration.replace(/--.*$/gm, "");
  const outside = code.replace(/\$\$[\s\S]*?\$\$/g, "");
  assert.doesNotMatch(outside, /\b(delete|drop|truncate)\b/i);
  const creates = outside.match(/\b(add column|create index)\b[^;]*/gi);
  assert.equal(creates.length, 4);
  for (const statement of creates) assert.match(statement, /if not exists/i, statement);
  assert.match(code, /create or replace function purge_stale_job_offers/);
  assert.match(code, /revoke all on function purge_stale_job_offers\(text, timestamptz, timestamptz\) from public, anon, authenticated/);
  assert.match(code, /grant execute on function purge_stale_job_offers\(text, timestamptz, timestamptz\) to service_role/);
});

test("migration 0037 : offre liée à une candidature protégée par le lien et par entreprise + intitulé, chacun indexé", () => {
  const body = /\$\$([\s\S]*?)\$\$/.exec(purgeMigration)[1];
  // Deux « not exists » séparés (pas un « or ») : chacun peut s'appuyer sur son index.
  assert.equal(body.match(/not exists/g).length, 2);
  assert.doesNotMatch(body, /\bor\b/i);
  assert.match(body, /a\.offer_url = o\.url/);
  assert.match(body, /lower\(a\.company\) = lower\(o\.company\) and lower\(a\.position\) = lower\(o\.title\)/);
  assert.match(purgeMigration, /create index if not exists applications_offer_url_idx on applications \(offer_url\)/);
  assert.match(purgeMigration, /create index if not exists applications_company_position_idx on applications \(lower\(company\), lower\(position\)\)/);
  // Offres collées (source « user ») : leur propre date limite.
  assert.match(body, /case when o\.source = 'user' then p_user_before else p_collected_before end/);
});

test("Greenhouse : offres en France, lieu nettoyé et date de publication", async () => {
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
    ["greenhouse-acme-1", "Analyste & data", "Paris"],
    ["greenhouse-acme-3", "Par bureau", "Lyon"],
  ]);
  assert.equal(offers[0].description, "Texte");
  assert.equal(offers[0].publishedAt, "2026-11-01T10:00:00.000Z");
  assert.equal(offers[1].publishedAt, null);
});

test("Ashby : lieux « Madrid Office; Paris Office » nettoyés en « Paris »", async () => {
  const get = fakeGet({
    "api.ashbyhq.com": { jobs: [{ id: "a", title: "Account Executive", jobUrl: "https://s.fr/a", location: "Madrid Office; Paris Office" }] },
  });
  const { offers } = await readCompanyOffers(company("ashby"), 10, all, get);
  assert.deepEqual(offers.map((o) => o.location), ["Paris"]);
});

test("sources corrigées : Doctolib sur Ashby, Aircall sur Greenhouse (aircallioinc)", () => {
  const companies = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const entries = (name) => companies.filter((c) => c.name === name);
  const doctolib = entries("Doctolib");
  assert.equal(doctolib.length, 1);
  assert.deepEqual([doctolib[0].platform, doctolib[0].slug, doctolib[0].sectors.length], ["ashby", "doctolib", 4]);
  assert.deepEqual(entries("Aircall").map((c) => [c.platform, c.slug]), [["greenhouse", "aircallioinc"]]);
  const boards = readFileSync(new URL("./job-boards.ts", import.meta.url), "utf8");
  assert.match(boards, /key: "doctolib",[^}]*ats: "ashby", slug: "doctolib"/);
  assert.match(boards, /key: "aircall",[^}]*ats: "greenhouse", slug: "aircallioinc"/);
  assert.match(boards, /key: "mistral",[^}]*ats: "ashby", slug: "mistral\.ai"/);
});

test("Mistral AI : collecté dans le secteur tech, sur Ashby (mistral.ai)", async () => {
  const companies = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const found = companies.filter((c) => c.name === "Mistral AI").map((c) => [c.sectors, c.platform, c.slug]);
  assert.deepEqual(found, [[["tech"], "ashby", "mistral.ai"]]);
  const get = fakeGet({ "job-board/mistral.ai": { jobs: [{ id: "m1", title: "AI Scientist", jobUrl: "https://jobs.ashbyhq.com/mistral/m1", location: "Paris" }] } });
  const { offers, failed } = await readCompanyOffers({ name: "Mistral AI", platform: "ashby", slug: "mistral.ai" }, 10, all, get);
  assert.deepEqual(get.calls, ["https://api.ashbyhq.com/posting-api/job-board/mistral.ai"]);
  assert.deepEqual([failed, offers.map((o) => [o.externalId, o.location])], [false, [["ashby-mistral.ai-m1", "Paris"]]]);
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

test("SmartRecruiters : ville de la liste (« France » sans ville), description lue offre par offre", async () => {
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
    ["https://jobs.smartrecruiters.com/acme/2", "France", ""],
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
  assert.deepEqual(result, {
    companiesRead: 2,
    companiesTotal: 2,
    companiesFailed: ["Panne"],
    companiesEmpty: [],
    offersRead: 1,
    perCompany: [
      { name: "Acme", offers: 1, failed: false },
      { name: "Panne", offers: 0, failed: true },
    ],
    partial: false,
  });
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

test("enregistrement : offre nouvelle ajoutée, mots-clés comptés une fois", async () => {
  const db = fakeDb();
  const result = await saveOffers(db, [toSave("a", { publishedAt: "2026-11-01T00:00:00.000Z" })], SEEN_AT);
  assert.deepEqual(result, { created: 1, seen: 0 });
  assert.equal(db.rows[0].location, "Paris");
  assert.equal(db.rows[0].published_at, "2026-11-01T00:00:00.000Z");
  assert.equal(db.rows[0].last_seen_at, SEEN_AT.toISOString());
  assert.deepEqual(db.rpc.calls, [{ p_sector: "tech", p_keywords: ["SQL"], p_source: "ats" }]);
});

test("enregistrement : offre revue rafraîchie, mots-clés non recomptés, première vue et secteur gardés", async () => {
  const row = { id: "r1", source: "ats", external_id: "a", sector: "rh", scraped_at: "2026-10-27T10:00:00Z", last_seen_at: "2026-10-27T10:00:00Z", location: null };
  const db = fakeDb([row]);
  const result = await saveOffers(db, [toSave("a", { sector: "tech" })], SEEN_AT);
  assert.deepEqual(result, { created: 0, seen: 1 });
  assert.equal(row.last_seen_at, SEEN_AT.toISOString());
  assert.equal(row.location, "Paris");
  assert.equal(row.scraped_at, "2026-10-27T10:00:00Z");
  assert.equal(row.sector, "rh");
  assert.deepEqual(db.rpc.calls, []);
});

test("enregistrement : un lieu absent n'efface pas le lieu déjà connu", async () => {
  const row = { id: "r1", source: "ats", external_id: "a", last_seen_at: "2026-10-27T10:00:00Z", location: "Lyon" };
  await saveOffers(fakeDb([row]), [toSave("a", { location: null })], SEEN_AT);
  assert.equal(row.location, "Lyon");
  assert.equal(row.last_seen_at, SEEN_AT.toISOString());
});

test("enregistrement : même identifiant sur une autre source, offre distincte", async () => {
  const row = { id: "r1", source: "user", external_id: "a", last_seen_at: "ANCIEN" };
  const db = fakeDb([row]);
  assert.deepEqual(await saveOffers(db, [toSave("a")], SEEN_AT), { created: 1, seen: 0 });
  assert.equal(row.last_seen_at, "ANCIEN");
});

test("enregistrement : offre arrivée entre-temps, pas de second comptage des mots-clés", async () => {
  const db = fakeDb([], { conflict: ["a"] });
  assert.deepEqual(await saveOffers(db, [toSave("a")], SEEN_AT), { created: 0, seen: 0 });
  assert.deepEqual(db.rpc.calls, []);
});

test("enregistrement : une erreur de base remonte, sans être avalée", async () => {
  for (const failOn of ["select", "insert"]) {
    await assert.rejects(saveOffers(fakeDb([], { failOn }), [toSave("a")], SEEN_AT), new RegExp(failOn));
  }
  const row = { id: "r1", source: "ats", external_id: "a" };
  await assert.rejects(saveOffers(fakeDb([row], { failOn: "update" }), [toSave("a")], SEEN_AT), /update/);
});

test("plan : offres revues regroupées par lieu, doublons d'un même passage ignorés", () => {
  const { toInsert, toRefresh } = planOfferSave(
    [toSave("a"), toSave("a"), toSave("b"), toSave("c", { location: "Lyon" }), toSave("d")],
    [
      { id: "1", external_id: "a" },
      { id: "2", external_id: "b" },
      { id: "3", external_id: "c" },
    ],
  );
  assert.deepEqual(toInsert.map((offer) => offer.externalId), ["d"]);
  assert.deepEqual(toRefresh, [
    { location: "Paris", ids: ["1", "2"] },
    { location: "Lyon", ids: ["3"] },
  ]);
});

/** Base simulée pour un passage complet : journal, classement et nettoyage inclus, toute requête comptée. */
function fakeRunDb({ failSave = false, failLog = false, purge = { data: 4, error: null } } = {}) {
  const db = { rows: [], logs: [], trends: 0, touched: 0, purges: [], steps: [] };
  const result = (data) => ({ data, error: null });
  db.from = (table) => {
    db.touched++;
    if (table === "job_collect_runs") {
      return {
        insert: (row) => ({
          select: () => ({
            single: async () => {
              db.steps.push("journal");
              if (failLog) return { data: null, error: new Error("journal") };
              db.logs.push({ id: `log${db.logs.length}`, ...row });
              return result({ id: `log${db.logs.length - 1}` });
            },
          }),
        }),
        update: (patch) => ({
          eq: async (_column, id) => {
            db.steps.push("journal complété");
            Object.assign(db.logs.find((log) => log.id === id), patch);
            return { error: null };
          },
        }),
      };
    }
    if (table === "job_keywords") {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => result([]) };
      return chain;
    }
    if (table === "sector_trends") return { upsert: async () => ((db.trends += 1), { error: null }) };
    const lookup = { eq: () => lookup, in: async () => (failSave ? { data: null, error: new Error("base") } : result([])) };
    return {
      select: () => lookup,
      upsert: (row) => ({ select: async () => (db.rows.push(row), result([{ id: row.external_id }])) }),
    };
  };
  db.rpc = async (name, args) => {
    if (name !== "purge_stale_job_offers") return { error: null };
    db.steps.push("nettoyage");
    db.purges.push(args);
    if (purge instanceof Error) throw purge;
    return purge;
  };
  return db;
}
const runCompanies = ["a", "b", "c"].map((slug) => ({ name: slug.toUpperCase(), platform: "ashby", slug }));
const runGet = (name = "a") =>
  fakeGet({
    [`job-board/${name}`]: { jobs: [{ id: "1", title: "Analyste", jobUrl: "https://s.fr/1", location: "Paris", descriptionPlain: "SQL" }] },
    "job-board/": { jobs: [] },
  });
const match = (text) => (text.includes("SQL") ? ["SQL"] : []);

test("budget du passage : 240 s, sous la limite de 300 s de la fonction", () => {
  assert.equal(COLLECT_BUDGET_MS, 240_000);
  assert.match(readFileSync(new URL("../app/api/cron/collecte/[secteur]/route.ts", import.meta.url), "utf8"), /maxDuration = 300/);
});

test("passage : offres enregistrées, classement recalculé, journal écrit", async () => {
  const db = fakeRunDb();
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match });
  assert.deepEqual([run.companiesRead, run.companiesTotal, run.offersRead, run.offersCreated, run.partial, run.error], [3, 3, 1, 1, false, null]);
  assert.equal(db.rows[0].source, "ats");
  assert.equal(db.trends, 1);
  assert.equal(db.logs.length, 1);
  assert.equal(db.logs[0].offers_created, 1);
  assert.equal(run.sample, undefined);
});

test("essai à blanc : aucun accès à la base, échantillon renvoyé", async () => {
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: null, get: runGet(), matchKeywords: match });
  assert.equal(run.dryRun, true);
  assert.deepEqual([run.offersRead, run.offersCreated, run.offersSeen], [1, 0, 0]);
  assert.deepEqual(run.sample, [{ title: "Analyste", company: "A", location: "Paris" }]);
});

test("temps écoulé : arrêt propre, travail gardé, passage marqué partiel dans le journal", async () => {
  const db = fakeRunDb();
  let clock = 0;
  const get = async (url) => {
    clock += 130_000;
    return runGet()(url);
  };
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get, matchKeywords: match, now: () => clock });
  assert.deepEqual([run.companiesRead, run.companiesTotal, run.partial, run.error], [2, 3, true, null]);
  assert.equal(db.rows.length, 1);
  assert.equal(db.logs[0].partial, true);
  assert.equal(db.trends, 1);
});

test("erreur de base : remontée et journalisée, passage marqué partiel, sans exception", async () => {
  const db = fakeRunDb({ failSave: true });
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match });
  assert.equal(run.error, "base");
  assert.equal(run.partial, true);
  assert.equal(db.logs[0].error, "base");
  assert.equal(db.trends, 0);
});

test("journal en panne : le passage reste réussi", async () => {
  const original = { error: console.error, info: console.info };
  console.error = () => {};
  console.info = () => {};
  try {
    const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: fakeRunDb({ failLog: true }), get: runGet(), matchKeywords: match });
    assert.equal(run.error, null);
  } finally {
    Object.assign(console, original);
  }
});

test("nettoyage : 60 jours pour les offres collectées, 180 pour les offres collées", () => {
  assert.equal(COLLECTED_OFFERS_MAX_DAYS, 60);
  assert.equal(USER_OFFERS_MAX_DAYS, 180);
  assert.deepEqual(purgeCutoffs(Date.parse("2026-11-08T03:00:00Z")), {
    p_collected_before: "2026-09-09T03:00:00.000Z",
    p_user_before: "2026-05-12T03:00:00.000Z",
  });
});

test("nettoyage : lancé après le journal, compteur inscrit sur la même ligne", async () => {
  const db = fakeRunDb();
  const clock = Date.parse("2026-11-08T03:00:00Z");
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match, now: () => clock });
  assert.deepEqual(db.steps, ["journal", "nettoyage", "journal complété"]);
  assert.deepEqual(db.purges, [{ p_sector: "tech", ...purgeCutoffs(clock) }]);
  assert.deepEqual([run.offersDeleted, run.purgeError], [4, null]);
  assert.deepEqual([db.logs[0].offers_deleted, db.logs[0].purge_error], [4, null]);
});

test("nettoyage : sauté après un passage en erreur, raison notée au journal", async () => {
  const db = fakeRunDb({ failSave: true });
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match });
  assert.deepEqual(db.purges, []);
  assert.deepEqual([run.offersDeleted, db.logs[0].offers_deleted, db.logs[0].purge_error], [null, null, "sauté : passage en erreur"]);
});

test("nettoyage : sauté s'il reste moins de 10 s avant les 240 s, passage non bloqué", async () => {
  assert.equal(PURGE_MIN_REMAINING_MS, 10_000);
  const db = fakeRunDb();
  let clock = 0;
  const get = async (url) => {
    clock += 77_000; // 3 entreprises : 231 s, il reste 9 s
    return runGet()(url);
  };
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get, matchKeywords: match, now: () => clock });
  assert.deepEqual([run.partial, run.error], [false, null]);
  assert.deepEqual(db.purges, []);
  assert.equal(db.logs[0].purge_error, "sauté : temps restant trop court");
});

test("nettoyage : une erreur (réponse ou exception) est notée, le passage reste réussi", async () => {
  for (const purge of [{ data: null, error: { message: "délai dépassé" } }, new Error("réseau")]) {
    const db = fakeRunDb({ purge });
    const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match });
    assert.equal(run.error, null);
    assert.equal(run.offersDeleted, null);
    assert.match(db.logs[0].purge_error, /délai dépassé|réseau/);
  }
});

test("nettoyage : essai à blanc, rien supprimé ni journalisé", async () => {
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: null, get: runGet(), matchKeywords: match });
  assert.deepEqual([run.offersDeleted, run.purgeError], [null, "sauté : essai à blanc"]);
});

test("nettoyage : journal en panne, nettoyage lancé quand même et bilan dans la console", async () => {
  const db = fakeRunDb({ failLog: true });
  const original = { error: console.error, info: console.info };
  const infos = [];
  console.error = () => {};
  console.info = (...args) => infos.push(args.join(" "));
  try {
    const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: runGet(), matchKeywords: match });
    assert.equal(run.offersDeleted, 4);
    assert.match(infos.join("\n"), /"offersDeleted":4/);
  } finally {
    Object.assign(console, original);
  }
});

test("cron : une entrée hebdomadaire par secteur, à des heures différentes", () => {
  const { crons } = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const companies = JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
  const collect = crons.filter((cron) => cron.path.startsWith("/api/cron/collecte/"));
  assert.deepEqual(collect.map((cron) => cron.path.split("/").pop()).sort(), [...new Set(companies.flatMap((c) => c.sectors))].sort());
  for (const cron of collect) assert.match(cron.schedule, /^0 \d+ \* \* 0$/);
  assert.equal(new Set(collect.map((cron) => cron.schedule)).size, collect.length);
});

test("cron : pages carrières seulement, route fermée sans secret", () => {
  const source = readFileSync(new URL("../app/api/cron/collecte/[secteur]/route.ts", import.meta.url), "utf8");
  const imports = source.split("\n").filter((line) => line.startsWith("import")).join("\n");
  assert.doesNotMatch(imports, /france-travail|adzuna/);
  assert.match(source, /if \(!secret\) return false/);
  assert.match(source, /timingSafeEqual/);
  assert.ok(source.indexOf("isAuthorized(request)") < source.indexOf("context.params"));
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

// --- Lot 1a : fichier unique, retraits automatiques, journal, données gardées ------------------

// Liste par secteur d'avant le fichier unique (ats-companies.json, supprimé), figée : 148 couples
// (secteur, entreprise), dont 55 avec le filtre du métier.
const LEGACY_SECTORS = {
  finance: ["Pennylane","Qonto","Younited","Agicap","Finary","Seyna","N26","Point72"],
  conseil: ["Forvis Mazars","Devoteam","Artefact","Theodo","Alten","Assystem"],
  tech: ["Datadog","Mirakl","Scaleway","Dataiku","Algolia","Dashlane","Ledger","Photoroom","Dust","Mistral AI","lemlist","Sorare","BlaBlaCar","Swile","Ivalua","MongoDB"],
  marketing: ["Brevo","SeLoger","Too Good To Go","Heetch","Spotify","Red Bull","Media Participations","Braze","Taboola","Voodoo","Ubisoft","Veepee","Back Market","Doctolib","Alan","Qonto","Pennylane","SMCP","Salomon","Sisley","Kiabi","Accor","Believe","360Learning","Malt","Swile","BlaBlaCar","Deliveroo","Airbnb"],
  creatif: ["Ubisoft","Voodoo","Gameloft","Believe","Figma","ElevenLabs","Synthesia","Media Participations","Back Market","Doctolib","Qonto","Alan","Pennylane","Photoroom","Mirakl","Datadog","SMCP","Jacquemus","Salomon","Sisley","Petit Bateau","Veepee","Deliveroo","BlaBlaCar","Swile","Malt"],
  commercial: ["Doctolib","SumUp","Aircall","Pigment","Deliveroo","Veepee","Doctrine","360Learning","Malt","Stripe","Airbnb","Boulanger","Loxam"],
  rh: ["Accor","Kiabi","Nexity","Saint-Gobain","Bosch","Talan","Media Participations","Ubisoft","Alten","Assystem","Devoteam","Forvis Mazars","Eurofins","Loxam","Boulanger","SMCP","Sisley","Salomon","Petit Bateau","Doctolib","Alan","Pennylane","Qonto","Voodoo","Back Market","Datadog","Theodo","Veepee","Malt","BlaBlaCar","Swile","360Learning"],
  sante: ["Alan","Eurofins","Lifen","Owkin","Inato","Nabla"],
  etudiant: ["Back Market","Salomon","Ubisoft","Alten","Devoteam","Alan","Vestiaire Collective"],
  luxe: ["SMCP","Sisley","Jacquemus","Vestiaire Collective","Petit Bateau"],
};
const LEGACY_FILTERED = ["marketing:Brevo","marketing:SeLoger","marketing:Too Good To Go","marketing:Heetch","marketing:Spotify","marketing:Red Bull","marketing:Media Participations","marketing:Braze","marketing:Taboola","marketing:Voodoo","marketing:Ubisoft","marketing:Veepee","marketing:Back Market","marketing:Doctolib","marketing:Alan","marketing:Qonto","marketing:Pennylane","marketing:SMCP","marketing:Salomon","marketing:Sisley","marketing:Kiabi","marketing:Accor","marketing:Believe","marketing:360Learning","marketing:Malt","marketing:Swile","marketing:BlaBlaCar","marketing:Deliveroo","marketing:Airbnb","creatif:Ubisoft","creatif:Voodoo","creatif:Gameloft","creatif:Believe","creatif:Figma","creatif:ElevenLabs","creatif:Synthesia","creatif:Media Participations","creatif:Back Market","creatif:Doctolib","creatif:Qonto","creatif:Alan","creatif:Pennylane","creatif:Photoroom","creatif:Mirakl","creatif:Datadog","creatif:SMCP","creatif:Jacquemus","creatif:Salomon","creatif:Sisley","creatif:Petit Bateau","creatif:Veepee","creatif:Deliveroo","creatif:BlaBlaCar","creatif:Swile","creatif:Malt"];
const careerCompanies = () => JSON.parse(readFileSync(new URL("./career-companies.json", import.meta.url), "utf8"));
const exclusionsMigration = readFileSync(new URL("../../supabase/migrations/0043_job_collect_exclusions.sql", import.meta.url), "utf8");

/** Console muette le temps d'un passage (avertissements attendus). */
async function quiet(fn) {
  const original = { warn: console.warn, error: console.error, info: console.info };
  console.warn = console.error = console.info = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, original);
  }
}

/**
 * Base simulée pour les retraits : job_collect_exclusions, journal relu (passages précédents),
 * offres déjà connues. `missingMigration` : table et colonnes de la migration 0043 absentes.
 */
function fakeGuardDb({ exclusions = [], previousRuns = [], known = [], missingMigration = false, failExclusionWrite = false } = {}) {
  const db = { excluded: [], inserts: [], logs: [], rows: [] };
  const ok = (data) => ({ data, error: null });
  const noTable = { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.job_collect_exclusions'" } };
  db.from = (table) => {
    if (table === "job_collect_exclusions") {
      return {
        select: async () => (missingMigration ? noTable : ok(exclusions.map((company_key) => ({ company_key })))),
        upsert: async (row) =>
          missingMigration || failExclusionWrite
            ? { error: { code: "23514", message: "new row violates check constraint \"job_collect_exclusions_company_key_check\"" } }
            : (db.excluded.push(row), { error: null }),
      };
    }
    if (table === "job_collect_runs") {
      // Journal relu : filtres eq / lte, tri décroissant sur started_at et limite appliqués comme Postgres.
      const filters = [];
      let limit = Infinity;
      const chain = {
        eq: (column, value) => (filters.push((run) => run[column] === value), chain),
        lte: (column, value) => (filters.push((run) => run[column] <= value), chain),
        order: () => chain,
        limit: async (count) => {
          limit = count;
          if (missingMigration) return { data: null, error: { code: "42703", message: "column job_collect_runs.companies_rate_limited does not exist" } };
          const runs = previousRuns
            .map((run) => ({ source: "ats", ...run }))
            .filter((run) => filters.every((keep) => keep(run)))
            .sort((a, b) => b.started_at.localeCompare(a.started_at));
          return ok(runs.slice(0, limit));
        },
      };
      return {
        select: () => chain,
        insert: (row) => ({
          select: () => ({
            single: async () => {
              db.inserts.push(row);
              if (missingMigration && "companies_empty" in row)
                return { data: null, error: { code: "PGRST204", message: "Could not find the 'companies_empty' column of 'job_collect_runs' in the schema cache" } };
              db.logs.push({ id: `log${db.logs.length}`, ...row });
              return ok({ id: `log${db.logs.length - 1}` });
            },
          }),
        }),
        update: (patch) => ({ eq: async (_column, id) => (Object.assign(db.logs.find((log) => log.id === id), patch), { error: null }) }),
      };
    }
    if (table === "job_keywords") {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ok([]) };
      return chain;
    }
    if (table === "sector_trends") return { upsert: async () => ({ error: null }) };
    const lookup = {
      eq: () => lookup,
      in: async (_column, ids) => ok(known.filter((id) => ids.includes(id)).map((external_id) => ({ id: external_id, external_id }))),
    };
    return {
      select: () => lookup,
      update: () => ({ in: async () => ({ error: null }) }),
      upsert: (row) => ({ select: async () => (db.rows.push(row), ok([{ id: row.external_id }])) }),
    };
  };
  db.rpc = async (name) => (name === "purge_stale_job_offers" ? ok(0) : { error: null });
  return db;
}
/** Réponses d'Ashby : l'entreprise `blockedSlug` refuse l'accès (`reason`), « b » a une offre. */
const refusingGet = (reason, blockedSlug = "a", calls = []) => async (url) => {
  calls.push(url);
  if (url.endsWith(`job-board/${blockedSlug}`)) throw new AtsBlockedError(reason, reason === "challenge" ? 429 : Number(reason.slice(5)), url);
  return runGet("b")(url);
};

test("fichier unique : les 148 couples (secteur, entreprise) et les 55 filtres d'avant, une ligne par entreprise", () => {
  const companies = careerCompanies();
  const legacy = new Set(Object.values(LEGACY_SECTORS).flat());
  let couples = 0;
  for (const [sector, names] of Object.entries(LEGACY_SECTORS)) {
    const derived = companiesForSector(companies, sector).filter((company) => legacy.has(company.name));
    assert.deepEqual(derived.map((company) => company.name).sort(), [...names].sort(), sector);
    couples += derived.length;
  }
  assert.equal(couples, 148);
  const filtered = Object.keys(LEGACY_SECTORS).flatMap((sector) =>
    companiesForSector(companies, sector)
      .filter((company) => legacy.has(company.name) && company.filterTitles)
      .map((company) => `${sector}:${company.name}`),
  );
  assert.deepEqual(filtered.sort(), [...LEGACY_FILTERED].sort());
  assert.equal(new Set(companies.map(companyKey)).size, companies.length, "entreprise en double");
  assert.equal(new Set(companies.map((company) => company.name)).size, companies.length, "nom en double");
  for (const company of companies) {
    assert.ok(company.sectors.length > 0 && company.sectors.every((sector) => sector in LEGACY_SECTORS), company.name);
    for (const sector of company.filterTitles ?? []) assert.ok(company.sectors.includes(sector), `${company.name} : filtre hors de ses secteurs`);
  }
});

test("fichier unique : filtre du métier et produits résolus par secteur", () => {
  const companies = careerCompanies();
  const pennylane = (sector) => companiesForSector(companies, sector).find((company) => company.name === "Pennylane");
  assert.equal(pennylane("finance").filterTitles, undefined);
  assert.equal(pennylane("marketing").filterTitles, true);
  assert.equal(pennylane("rh").filterTitles, undefined);
  assert.equal(pennylane("finance").sectors, undefined, "secteurs non transmis à la collecte");
  const withProducts = companies.filter((company) => company.products?.length);
  for (const company of withProducts)
    for (const sector of company.sectors) assert.deepEqual(companiesForSector(companies, sector).find((c) => c.name === company.name).products, company.products);
});

test("ordre de lecture : dans chaque secteur, les anciennes entreprises avant les nouvelles", () => {
  const legacy = new Set(Object.values(LEGACY_SECTORS).flat());
  const companies = careerCompanies();
  const firstNew = companies.findIndex((company) => !legacy.has(company.name));
  if (firstNew >= 0) assert.ok(companies.slice(firstNew).every((company) => !legacy.has(company.name)), "nouvelle entreprise avant une ancienne");
  const added = [...companies, { name: "Nouvelle", domain: "nouvelle.fr", platform: "ashby", slug: "nouvelle", sectors: ["rh", "tech"] }];
  for (const sector of ["rh", "tech"]) assert.equal(companiesForSector(added, sector).at(-1).name, "Nouvelle");
});

test("clés des retraits : les 78 clés actuelles et une clé Oracle passent la contrainte de la migration", () => {
  const pattern = new RegExp(/company_key ~ '([^']+)'/.exec(exclusionsMigration)[1]);
  const keys = careerCompanies().map(companyKey);
  assert.equal(keys.length, 78);
  for (const key of keys) assert.match(key, pattern);
  assert.match("oracle:fa-errt-saasfaprod1.fa.ocs.oraclecloud.com/CX_2001", pattern);
  assert.match(companyKey({ platform: "lever-eu", slug: "jacquemus" }), pattern);
  // Refusées : majuscule dans la plateforme, espace, deux-points en trop, identifiant vide.
  for (const bad of ["Oracle:x", "ashby:mon slug", "ashby:a:b", "ashby:"]) assert.doesNotMatch(bad, pattern, bad);
  assert.equal(companyKey({ platform: "smartrecruiters", slug: "Ubisoft2" }), "smartrecruiters:Ubisoft2");
});

test("client : 401, 403, cf-mitigated, page HTML et 429 sont des refus ; 5xx et 404 non", async () => {
  const responses = {
    "/401": () => new Response("", { status: 401 }),
    "/403": () => new Response("", { status: 403 }),
    "/defi": () => new Response("<html>", { status: 429, headers: { "cf-mitigated": "challenge", "content-type": "text/html" } }),
    "/defi-200": () => Response.json({ jobs: [] }, { headers: { "cf-mitigated": "challenge" } }),
    "/html": () => new Response("<html>", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } }),
    "/429": () => new Response("", { status: 429 }),
    "/503": () => new Response("<html>maintenance</html>", { status: 503, headers: { "content-type": "text/html" } }),
    "/404": () => new Response("<html>introuvable</html>", { status: 404, headers: { "content-type": "text/html" } }),
  };
  const get = createAtsClient({ delayMs: 0, log: () => {}, fetchImpl: async (url) => responses[new URL(url).pathname]() });
  const reason = async (path) => {
    try {
      await get(`https://x${path}`);
      return "aucun";
    } catch (error) {
      assert.ok(error instanceof AtsBlockedError);
      return error.reason;
    }
  };
  const reasons = [];
  for (const path of ["/401", "/403", "/defi", "/defi-200", "/html", "/429"]) reasons.push(await reason(path));
  assert.deepEqual(reasons, ["http_401", "http_403", "challenge", "challenge", "challenge", "http_429"]);
  assert.equal(await get("https://x/503"), null);
  assert.equal(await get("https://x/404"), null);
});

test("refus d'accès : l'entreprise s'arrête aussitôt, les suivantes sont lues, entreprise sans offre signalée", async () => {
  const calls = [];
  const blocked = [];
  const result = await collectSector({
    sector: "tech",
    companies: runCompanies,
    get: refusingGet("http_403", "a", calls),
    onCompany: () => {},
    onBlocked: (company, block) => blocked.push([company.name, block.reason, block.status]),
  });
  assert.deepEqual(blocked, [["A", "http_403", 403]]);
  assert.equal(calls.filter((url) => url.endsWith("job-board/a")).length, 1);
  assert.deepEqual([result.companiesRead, result.companiesFailed, result.companiesEmpty], [3, ["A"], ["C"]]);
  assert.deepEqual(result.perCompany, [
    { name: "A", offers: 0, failed: true },
    { name: "B", offers: 1, failed: false },
    { name: "C", offers: 0, failed: false },
  ]);
});

test("refus au milieu des détails SmartRecruiters : offres déjà lues gardées, plus aucune requête", async () => {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (url.includes("postings?country=fr"))
      return { content: ["p1", "p2", "p3"].map((id) => ({ id, name: `Poste ${id}`, location: { country: "fr", city: "Paris" } })) };
    if (url.endsWith("/p2")) throw new AtsBlockedError("http_403", 403, url);
    return { postingUrl: `https://jobs.smartrecruiters.com/acme/${url.slice(-2)}`, jobAd: { sections: { a: { text: "Texte" } } } };
  };
  const read = await readCompanyOffers(company("smartrecruiters"), 10, all, get);
  assert.deepEqual([read.failed, read.blocked.reason, read.offers.map((offer) => offer.externalId)], [true, "http_403", ["smartrecruiters-acme-p1"]]);
  assert.equal(calls.some((url) => url.endsWith("/p3")), false);
});

test("passage : un 403 retire l'entreprise (table et journal) ; au passage suivant, elle n'est plus appelée", async () => {
  const db = fakeGuardDb();
  const run = await quiet(() => runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: refusingGet("http_403"), matchKeywords: match }));
  assert.deepEqual([run.error, run.companiesExcluded, run.companiesFailed, run.offersCreated], [null, ["A"], ["A"], 1]);
  assert.deepEqual(db.excluded.map((row) => [row.company_key, row.company_name, row.reason]), [["ashby:a", "A", "http_403"]]);
  assert.match(db.excluded[0].detail, /^HTTP 403 https:\/\/api\.ashbyhq\.com\//);
  assert.deepEqual([db.logs[0].companies_excluded, db.logs[0].companies_empty, db.logs[0].companies_rate_limited], [["A"], ["C"], []]);

  const next = fakeGuardDb({ exclusions: ["ashby:a"] });
  const calls = [];
  const again = await quiet(() =>
    runSectorCollection({ sector: "tech", companies: runCompanies, supabase: next, get: async (url) => (calls.push(url), runGet("b")(url)), matchKeywords: match }),
  );
  assert.equal(calls.some((url) => url.endsWith("job-board/a")), false);
  assert.deepEqual([again.companiesRead, again.companiesTotal, again.companiesExcluded, again.partial], [2, 3, ["A"], false]);
});

test("passage : 401 et défi anti-robot retirent aussi tout de suite", async () => {
  for (const reason of ["http_401", "challenge"]) {
    const db = fakeGuardDb();
    const run = await quiet(() => runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: refusingGet(reason), matchKeywords: match }));
    assert.deepEqual([run.companiesExcluded, db.excluded.map((row) => row.reason)], [["A"], [reason]], reason);
  }
});

// Règle du 429 : passage « tech » du dimanche 22/11 à 03:00 UTC.
const SUNDAY = Date.parse("2026-11-22T03:00:00.000Z");
const hoursBefore = (hours) => new Date(SUNDAY - hours * 3_600_000).toISOString();
const run429 = (db) =>
  quiet(() => runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: refusingGet("http_429"), matchKeywords: match, now: () => SUNDAY }));

test("429 sans défi : premier 429, arrêtée pour le passage et notée, jamais retirée", async () => {
  assert.equal(RATE_LIMIT_MEMORY_MIN_DAYS, 5);
  const db = fakeGuardDb();
  const run = await run429(db);
  assert.deepEqual([run.companiesRateLimited, run.companiesExcluded, run.companiesFailed, db.excluded.length], [["A"], [], ["A"], 0]);
  assert.deepEqual(db.logs[0].companies_rate_limited, ["A"]);
});

test("429 : retirée au deuxième passage consécutif, celui de la semaine précédente du même secteur", async () => {
  const db = fakeGuardDb({ previousRuns: [{ sector: "tech", started_at: hoursBefore(7 * 24), companies_rate_limited: ["A"] }] });
  const run = await run429(db);
  assert.deepEqual([run.companiesRateLimited, run.companiesExcluded], [[], ["A"]]);
  assert.deepEqual(db.excluded.map((row) => [row.company_key, row.reason]), [["ashby:a", "http_429"]]);
});

test("429 : un autre secteur, même le même jour, ne compte jamais", async () => {
  const db = fakeGuardDb({
    previousRuns: [
      { sector: "rh", started_at: hoursBefore(1), companies_rate_limited: ["A"] }, // même dimanche, une heure avant
      { sector: "rh", started_at: hoursBefore(7 * 24), companies_rate_limited: ["A"] }, // semaine précédente, autre secteur
      { sector: "tech", started_at: hoursBefore(7 * 24), companies_rate_limited: [] },
    ],
  });
  const run = await run429(db);
  assert.deepEqual([run.companiesRateLimited, run.companiesExcluded, db.excluded.length], [["A"], [], 0]);
});

test("429 : un passage du même secteur de moins de 5 jours (relance à la main) est ignoré", async () => {
  // Relance 2 jours avant, avec un 429 : ignorée ; la semaine précédente n'en avait pas.
  const recentOnly = fakeGuardDb({
    previousRuns: [
      { sector: "tech", started_at: hoursBefore(2 * 24), companies_rate_limited: ["A"] },
      { sector: "tech", started_at: hoursBefore(7 * 24), companies_rate_limited: [] },
    ],
  });
  const run1 = await run429(recentOnly);
  assert.deepEqual([run1.companiesRateLimited, run1.companiesExcluded], [["A"], []]);
  // Juste sous 5 jours : ignoré aussi ; juste au-dessus : pris en compte.
  const under = fakeGuardDb({ previousRuns: [{ sector: "tech", started_at: hoursBefore(5 * 24 - 1), companies_rate_limited: ["A"] }] });
  assert.deepEqual((await run429(under)).companiesExcluded, []);
  const over = fakeGuardDb({ previousRuns: [{ sector: "tech", started_at: hoursBefore(5 * 24 + 1), companies_rate_limited: ["A"] }] });
  assert.deepEqual((await run429(over)).companiesExcluded, ["A"]);
});

test("429 : consécutif seulement — une semaine sans 429 entre les deux remet le compteur à zéro", async () => {
  const db = fakeGuardDb({
    previousRuns: [
      { sector: "tech", started_at: hoursBefore(7 * 24), companies_rate_limited: [] },
      { sector: "tech", started_at: hoursBefore(14 * 24), companies_rate_limited: ["A"] },
    ],
  });
  const run = await run429(db);
  assert.deepEqual([run.companiesRateLimited, run.companiesExcluded, db.excluded.length], [["A"], [], 0]);
});

test("retrait non enregistré (écriture refusée) : entreprise sautée pour le passage, erreur dans la console et le journal", async () => {
  const db = fakeGuardDb({ failExclusionWrite: true });
  const calls = [];
  const errors = [];
  const original = { warn: console.warn, error: console.error, info: console.info };
  console.warn = console.info = () => {};
  console.error = (...args) => errors.push(args.join(" "));
  let run;
  try {
    run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: refusingGet("http_403", "a", calls), matchKeywords: match });
  } finally {
    Object.assign(console, original);
  }
  assert.equal(calls.filter((url) => url.endsWith("job-board/a")).length, 1, "une seule requête vers l'entreprise refusée");
  assert.deepEqual([run.error, run.companiesRead, run.offersCreated], [null, 3, 1]);
  assert.deepEqual(run.companiesExcluded, ["A (retrait non enregistré)"]);
  assert.deepEqual(db.logs[0].companies_excluded, ["A (retrait non enregistré)"]);
  assert.equal(db.excluded.length, 0);
  assert.ok(errors.some((line) => /retrait non enregistré A .*check constraint/.test(line)), errors.join("\n"));
});

test("panne 5xx (réponse illisible) : échec ordinaire, personne n'est retiré ni compté en 429", async () => {
  const db = fakeGuardDb();
  const get = async (url) => (url.endsWith("job-board/a") ? null : runGet("b")(url));
  const run = await quiet(() => runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get, matchKeywords: match }));
  assert.deepEqual([run.companiesFailed, run.companiesExcluded, run.companiesRateLimited, run.companiesEmpty, db.excluded.length], [["A"], [], [], ["C"], 0]);
});

test("essai à blanc : refus signalés sans rien écrire, offres par entreprise dans le bilan", async () => {
  const run = await runSectorCollection({ sector: "tech", companies: runCompanies, supabase: null, get: refusingGet("http_403"), matchKeywords: match });
  assert.deepEqual([run.dryRun, run.companiesExcluded, run.companiesEmpty], [true, ["A"], ["C"]]);
  assert.deepEqual(run.perCompany.map((entry) => [entry.name, entry.offers]), [["A", 0], ["B", 1], ["C", 0]]);
});

test("migration 0043 absente : la collecte tourne, le journal est écrit sans les nouvelles colonnes", async () => {
  const db = fakeGuardDb({ missingMigration: true });
  const run = await quiet(() => runSectorCollection({ sector: "tech", companies: runCompanies, supabase: db, get: refusingGet("http_403"), matchKeywords: match }));
  // Table absente : retrait impossible à enregistrer, l'entreprise est sautée et le journal le dit.
  assert.deepEqual([run.error, run.offersCreated, run.companiesExcluded, run.partial], [null, 1, ["A (retrait non enregistré)"], false]);
  assert.equal(db.inserts.length, 2);
  assert.ok("companies_empty" in db.inserts[0]);
  assert.ok(!("companies_empty" in db.inserts[1]) && !("companies_excluded" in db.inserts[1]));
  assert.equal(db.logs.length, 1);
  assert.equal(db.logs[0].offers_deleted, 0, "nettoyage inscrit sur la ligne du journal");
});

test("description lue seulement pour les offres nouvelles (SmartRecruiters), offres connues revues", async () => {
  const get = fakeGet({
    "postings?country=fr": { content: [{ id: "p1", name: "Analyste", location: { country: "fr", city: "Paris" } }, { id: "p2", name: "Juriste", location: { country: "fr", city: "Lyon" } }] },
    "postings/p2": { postingUrl: "https://jobs.smartrecruiters.com/acme/p2", jobAd: { sections: { a: { text: "Texte" } } } },
  });
  const known = async (ids) => new Set(ids.filter((id) => id === "smartrecruiters-acme-p1"));
  const { offers } = await readCompanyOffers(company("smartrecruiters"), 10, all, get, undefined, known);
  assert.deepEqual(get.calls.filter((url) => /postings\/p\d$/.test(url)), ["https://api.smartrecruiters.com/v1/companies/acme/postings/p2"]);
  assert.deepEqual(offers.map((offer) => [offer.externalId, offer.description]), [["smartrecruiters-acme-p1", ""], ["smartrecruiters-acme-p2", "Texte"]]);

  // Passage complet : offres connues lues en base, revues sans requête de détail.
  const db = fakeGuardDb({ known: ["smartrecruiters-acme-p1"] });
  const passGet = fakeGet({
    "postings?country=fr": { content: [{ id: "p1", name: "Analyste", location: { country: "fr", city: "Paris" } }, { id: "p2", name: "Juriste", location: { country: "fr", city: "Lyon" } }] },
    "postings/p2": { jobAd: { sections: { a: { text: "SQL" } } } },
  });
  const run = await quiet(() => runSectorCollection({ sector: "tech", companies: [company("smartrecruiters")], supabase: db, get: passGet, matchKeywords: match }));
  assert.equal(passGet.calls.filter((url) => /postings\/p\d$/.test(url)).length, 1);
  assert.deepEqual([run.offersRead, run.offersCreated, run.offersSeen], [2, 1, 1]);
  // Essai à blanc : rien n'est connu, toutes les descriptions sont lues (comme avant).
  const dryGet = fakeGet({ "postings?country=fr": { content: [{ id: "p1", name: "Analyste", location: { country: "fr", city: "Paris" } }] }, "postings/p1": { jobAd: { sections: {} } } });
  await runSectorCollection({ sector: "tech", companies: [company("smartrecruiters")], supabase: null, get: dryGet, matchKeywords: match });
  assert.equal(dryGet.calls.filter((url) => /postings\/p\d$/.test(url)).length, 1);
});

test("10 offres au plus par entreprise et par secteur", async () => {
  assert.equal(ATS_OFFERS_PER_COMPANY, 10);
  const jobs = Array.from({ length: 15 }, (_, i) => ({ id: i, title: `Poste ${i}`, absolute_url: `https://a.fr/${i}`, location: { name: "Paris, France" } }));
  const result = await collectSector({ sector: "tech", companies: [company("greenhouse")], get: fakeGet({ "boards-api.greenhouse.io": { jobs } }), onCompany: () => {} });
  assert.deepEqual([result.offersRead, result.perCompany[0].offers], [10, 10]);
});

test("données gardées : aucun e-mail ni téléphone, description limitée à 4 000 caractères", async () => {
  assert.equal(STORED_DESCRIPTION_MAX_LENGTH, 4_000);
  const db = fakeDb();
  const description = `Écrire à rh.paris@acme.fr, au 06 12 34 56 78 ou au +33 1 23 45 67 89. ${"x".repeat(5_000)} fin`;
  await saveOffers(db, [toSave("1", { title: "Stage – écrire à jobs@acme.fr", description })]);
  const row = db.rows[0];
  assert.equal(row.description.length, STORED_DESCRIPTION_MAX_LENGTH);
  for (const text of [row.title, row.description]) {
    assert.doesNotMatch(text, /@/);
    assert.doesNotMatch(text, /(\+33\s?|0)[1-9]([\s.-]?\d{2}){4}/);
  }
  assert.match(row.description, /^Écrire à \[email\], au \[téléphone\] ou au \[téléphone\]\./);
  assert.equal(row.title, "Stage – écrire à [email]");
  assert.equal(storedDescription("court"), "court");
});

test("masquage mis en commun : les offres collées utilisent le même masquage", () => {
  assert.equal(maskContacts("jean.dupont@acme.fr / 01.23.45.67.89"), "[email] / [téléphone]");
  const source = readFileSync(new URL("./user-job-offers.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ maskContacts \} from "\.\/contact-mask"/);
  assert.match(source, /const text = maskContacts\(description\)/);
  assert.doesNotMatch(source, /const (EMAIL|PHONE) =/);
});

test("migration 0043 : ajouts seulement, rejouable, table fermée aux clients, retour arrière en commentaire", () => {
  const code = exclusionsMigration.replace(/--.*$/gm, "");
  assert.doesNotMatch(code, /\b(delete|drop|truncate|update|insert)\b/i);
  assert.equal(code.match(/add column if not exists/g).length, 3);
  for (const column of ["companies_empty", "companies_excluded", "companies_rate_limited"])
    assert.match(code, new RegExp(`add column if not exists ${column} text\\[\\] not null default '\\{\\}'`));
  assert.match(code, /create table if not exists job_collect_exclusions/);
  assert.match(code, /alter table job_collect_exclusions enable row level security;/);
  assert.match(code, /revoke all on job_collect_exclusions from anon, authenticated;/);
  assert.doesNotMatch(code, /create policy|\bgrant\b/i);
  assert.match(exclusionsMigration, /-- Retour arrière : drop table if exists job_collect_exclusions;/);
  assert.match(exclusionsMigration, /--\s+delete from job_collect_exclusions where company_key = '[^']+';/);
  // Raisons admises par la table = raisons notées par la collecte (+ robots, pour les nouveaux connecteurs).
  const reasons = /reason in \(([^)]+)\)/.exec(code)[1].match(/'([^']+)'/g).map((r) => r.slice(1, -1));
  assert.deepEqual(reasons, ["http_401", "http_403", "http_429", "challenge", "robots"]);
});
