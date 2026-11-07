-- Collecte hebdomadaire des offres : dernière fois qu'une offre a été revue, lieu, date de
-- publication et journal des passages. « Offres pour toi » lit désormais last_seen_at : les offres
-- existantes le reçoivent de scraped_at, pour que le bloc ne se vide pas.

alter table job_offers_raw add column if not exists location text;
alter table job_offers_raw add column if not exists published_at timestamptz;
alter table job_offers_raw add column if not exists last_seen_at timestamptz;

update job_offers_raw set last_seen_at = scraped_at where last_seen_at is null;

alter table job_offers_raw alter column last_seen_at set default now();
alter table job_offers_raw alter column last_seen_at set not null;

create index if not exists job_offers_raw_sector_seen_idx on job_offers_raw (sector, last_seen_at desc);

-- Un passage du cron par secteur. Aucune politique : seul le service_role (qui contourne la RLS) y accède.
create table if not exists job_collect_runs (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  source text not null,
  started_at timestamptz not null,
  duration_ms integer not null,
  companies_read integer not null default 0,
  companies_total integer not null default 0,
  companies_failed text[] not null default '{}',
  offers_read integer not null default 0,
  offers_created integer not null default 0,
  offers_seen integer not null default 0,
  partial boolean not null default false,
  error text
);

create index if not exists job_collect_runs_started_idx on job_collect_runs (started_at desc);

alter table job_collect_runs enable row level security;
revoke all on job_collect_runs from anon, authenticated;
