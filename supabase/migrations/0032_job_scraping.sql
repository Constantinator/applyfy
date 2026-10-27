-- Offres d'emploi collectées et mots-clés par secteur, passés en bonus au coach du CV Builder
-- (src/lib/job-scraper.ts). Écriture réservée au service_role (script de collecte) ; lecture
-- publique des mots-clés et des tendances, qui ne contiennent aucune donnée personnelle.

create table if not exists job_offers_raw (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title text not null,
  company text,
  sector text not null,
  description text,
  url text,
  scraped_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists job_offers_raw_sector_idx on job_offers_raw (sector, scraped_at desc);

create table if not exists job_keywords (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  keyword text not null,
  frequency integer not null default 1 check (frequency >= 0),
  source text,
  last_seen timestamptz not null default now(),
  unique (sector, keyword)
);

create index if not exists job_keywords_top_idx on job_keywords (sector, frequency desc);

create table if not exists sector_trends (
  id uuid primary key default gen_random_uuid(),
  sector text not null unique,
  top_keywords jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table job_offers_raw enable row level security;
alter table job_keywords enable row level security;
alter table sector_trends enable row level security;

-- Aucune politique sur job_offers_raw : seul le service_role (qui contourne la RLS) y accède.

drop policy if exists "job_keywords lecture publique" on job_keywords;
create policy "job_keywords lecture publique" on job_keywords
  for select to anon, authenticated using (true);

drop policy if exists "sector_trends lecture publique" on sector_trends;
create policy "sector_trends lecture publique" on sector_trends
  for select to anon, authenticated using (true);

revoke insert, update, delete on job_offers_raw, job_keywords, sector_trends from anon, authenticated;
revoke select on job_offers_raw from anon, authenticated;

-- Ajout de mots-clés relevés dans une offre : fréquence incrémentée s'ils existent déjà.
create or replace function increment_job_keywords(p_sector text, p_keywords text[], p_source text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into job_keywords (sector, keyword, frequency, source, last_seen)
  select p_sector, k, 1, p_source, now()
  from (select distinct lower(trim(unnest(p_keywords))) as k) as keywords
  where k <> ''
  on conflict (sector, keyword) do update
    set frequency = job_keywords.frequency + 1,
        source = excluded.source,
        last_seen = excluded.last_seen;
$$;

revoke all on function increment_job_keywords(text, text[], text) from public, anon, authenticated;
grant execute on function increment_job_keywords(text, text[], text) to service_role;
