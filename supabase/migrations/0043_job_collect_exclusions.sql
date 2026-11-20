-- Collecte des offres (lot 1a) : journal des entreprises à zéro offre, retirées ou arrêtées par un
-- 429, et liste des entreprises retirées de la collecte. Rejouable, additive : trois colonnes au
-- journal et une table, aucune donnée existante modifiée ni supprimée.
--
-- Retrait automatique (src/lib/job-collect.ts) : 401, 403, en-tête cf-mitigated ou page HTML à la
-- place du JSON → entreprise retirée tout de suite ; 429 sans cf-mitigated → arrêtée pour le passage,
-- retirée au deuxième passage consécutif ; panne 5xx → aucun retrait.
--
-- Défaire un retrait (l'entreprise est relue au passage suivant) :
--   delete from job_collect_exclusions where company_key = 'smartrecruiters:Ubisoft2';
--
-- Retour arrière : drop table if exists job_collect_exclusions;
--                  alter table job_collect_runs drop column if exists companies_empty,
--                    drop column if exists companies_excluded, drop column if exists companies_rate_limited;

-- Entreprises lues sans échec et sans aucune offre retenue (en France, du métier du secteur).
alter table job_collect_runs add column if not exists companies_empty text[] not null default '{}';
-- Entreprises retirées : déjà retirées (ignorées), ou retirées pendant ce passage.
alter table job_collect_runs add column if not exists companies_excluded text[] not null default '{}';
-- Entreprises arrêtées par un 429 sans cf-mitigated : un second 429 au passage suivant les retire.
alter table job_collect_runs add column if not exists companies_rate_limited text[] not null default '{}';

-- Une ligne par entreprise retirée. Aucune politique : seul le service_role (qui contourne la RLS) y accède.
create table if not exists job_collect_exclusions (
  -- « plateforme:identifiant » (companyKey) : smartrecruiters:Ubisoft2, ashby:mistral.ai…
  company_key  text primary key check (company_key ~ '^[a-z-]+:[A-Za-z0-9._/-]{1,200}$'),
  company_name text not null check (char_length(company_name) between 1 and 200),
  reason       text not null check (reason in ('http_401', 'http_403', 'http_429', 'challenge', 'robots')),
  -- Statut HTTP et adresse refusée, pour relire la décision.
  detail       text check (detail is null or char_length(detail) <= 500),
  excluded_at  timestamptz not null default now()
);

alter table job_collect_exclusions enable row level security;
revoke all on job_collect_exclusions from anon, authenticated;
