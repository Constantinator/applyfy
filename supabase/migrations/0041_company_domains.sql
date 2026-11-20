-- Domaines des entreprises, partagés entre tous les utilisateurs, pour afficher leur logo
-- (Logo.dev). Une résolution faite pour une personne sert à toutes. Rejouable, additive : une
-- table et une fonction, aucune donnée existante modifiée.
--
-- La table contient des noms d'entreprises tirés des candidatures de TOUS les utilisateurs :
-- RLS activée SANS aucune règle d'accès. Seul le serveur (clé service_role, qui contourne la RLS)
-- la lit, uniquement pour les noms affichés à la personne connectée, et l'écrit.
--
-- Retour arrière : drop function if exists upsert_company_domain(text, text, text, text, timestamptz);
--                  drop table if exists company_domains;

create table if not exists company_domains (
  -- Nom normalisé (nameKey, src/lib/company-domain.ts) : « ING Bank N.V. France » → « ingbank ».
  name_key     text primary key check (name_key ~ '^[a-z0-9]{2,120}$'),
  display_name text not null check (char_length(display_name) between 1 and 200),
  -- Domaine principal en minuscules (qonto.com), null quand rien n'a été trouvé.
  domain       text check (domain is null or domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  source       text not null check (source in ('curated', 'logo_dev_search', 'admin')),
  -- verified : logo affiché ; ambiguous / none : initiales, nouvel essai à next_try_at ;
  -- blocked : initiales pour toujours (mauvais logo signalé, marque qui ne veut pas apparaître).
  status       text not null check (status in ('verified', 'ambiguous', 'none', 'blocked')),
  verified_at  timestamptz,
  attempts     integer not null default 0 check (attempts >= 0),
  next_try_at  timestamptz,
  updated_at   timestamptz not null default now(),
  constraint company_domains_verified_has_domain check (status <> 'verified' or domain is not null)
);

create index if not exists company_domains_retry_idx
  on company_domains (next_try_at) where status in ('none', 'ambiguous');

alter table company_domains enable row level security;
revoke all on company_domains from anon, authenticated;

-- Seule écriture prévue (recherche Logo.dev) : n'écrase jamais une ligne « admin » ni « blocked »,
-- ni un domaine vérifié par un résultat moins bon. Deux résolutions simultanées du même nom :
-- « on conflict » verrouille la ligne, la seconde réécrit le même résultat (idempotent).
create or replace function upsert_company_domain(
  p_name_key text,
  p_display_name text,
  p_domain text,
  p_status text,
  p_next_try_at timestamptz
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into company_domains as c
    (name_key, display_name, domain, source, status, verified_at, attempts, next_try_at, updated_at)
  values
    (p_name_key, p_display_name, p_domain, 'logo_dev_search', p_status,
     case when p_status = 'verified' then now() end, 1, p_next_try_at, now())
  on conflict (name_key) do update set
    display_name = excluded.display_name,
    domain       = excluded.domain,
    source       = excluded.source,
    status       = excluded.status,
    verified_at  = excluded.verified_at,
    attempts     = c.attempts + 1,
    next_try_at  = excluded.next_try_at,
    updated_at   = now()
  where c.source <> 'admin'
    and c.status <> 'blocked'
    and (c.status <> 'verified' or excluded.status = 'verified');
$$;

revoke execute on function upsert_company_domain(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function upsert_company_domain(text, text, text, text, timestamptz) to service_role;
