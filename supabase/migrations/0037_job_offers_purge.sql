-- Nettoyage des offres anciennes, lancé à la fin de chaque passage du cron de collecte, après le
-- journal. Rejouable. Aucune donnée supprimée par cette migration : elle ajoute deux colonnes au
-- journal, deux index et la fonction de nettoyage.

-- null : nettoyage non lancé (essai à blanc, passage en erreur, temps restant trop court).
alter table job_collect_runs add column if not exists offers_deleted integer;
-- Erreur du nettoyage, ou raison pour laquelle il a été sauté ; le passage reste réussi.
alter table job_collect_runs add column if not exists purge_error text;

-- Recherche des offres liées à une candidature : par leur lien, et par entreprise + intitulé.
create index if not exists applications_offer_url_idx on applications (offer_url) where offer_url is not null;
create index if not exists applications_company_position_idx on applications (lower(company), lower(position));

-- Supprime les offres d'un secteur non revues depuis p_collected_before (offres collectées) ou
-- p_user_before (offres collées par les utilisateurs, source « user »). Jamais une offre liée à
-- une candidature : même lien, ou même entreprise et même intitulé. Les deux conditions sont
-- deux « not exists » (équivalent à un « or ») pour que chacune s'appuie sur son index.
create or replace function purge_stale_job_offers(p_sector text, p_collected_before timestamptz, p_user_before timestamptz)
returns integer
language sql
security invoker
set search_path = public
as $$
  with deleted as (
    delete from job_offers_raw o
    where o.sector = p_sector
      and o.last_seen_at < case when o.source = 'user' then p_user_before else p_collected_before end
      and not exists (
        select 1 from applications a
        where o.url is not null and a.offer_url = o.url
      )
      and not exists (
        select 1 from applications a
        where o.company is not null and lower(a.company) = lower(o.company) and lower(a.position) = lower(o.title)
      )
    returning 1
  )
  select count(*)::int from deleted;
$$;

revoke all on function purge_stale_job_offers(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function purge_stale_job_offers(text, timestamptz, timestamptz) to service_role;

-- Vérification (éditeur SQL, sans rien supprimer) : le plan doit passer par
-- job_offers_raw_sector_seen_idx, applications_offer_url_idx et applications_company_position_idx
-- (sur une petite table, Postgres peut préférer un parcours complet : c'est normal).
--
--   explain
--   select o.id from job_offers_raw o
--   where o.sector = 'tech' and o.last_seen_at < now() - interval '60 days'
--     and not exists (select 1 from applications a where o.url is not null and a.offer_url = o.url)
--     and not exists (select 1 from applications a where o.company is not null
--                     and lower(a.company) = lower(o.company) and lower(a.position) = lower(o.title));
