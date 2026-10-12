-- Protection de l'API Claude contre les abus :
--   1. Limite quotidienne : 50 actions IA par jour et par utilisateur, tous types confondus,
--      remise à zéro à minuit (heure de Paris). Concerne en pratique le Premium : le plan
--      gratuit est déjà limité à 2 actions par type et par mois.
--   2. Anti-rafale : 10 requêtes IA par minute et par utilisateur, sur toutes les actions
--      IA (y compris l'import d'offre par lien, qui n'est pas compté dans « usage »).
-- Limites alignées avec AI_DAILY_LIMIT et AI_RATE_LIMIT_PER_MINUTE
-- (src/lib/ai-usage-limits.ts).

-- Comptage du jour : actions de l'utilisateur depuis minuit (heure de Paris).
create index if not exists usage_user_created_idx on usage (user_id, created_at);

-- record_ai_usage (migrations 0013, 0014) : refuse aussi au-delà de 50 actions dans la
-- journée, Premium compris (erreur P0003).
create or replace function record_ai_usage(p_kind ai_usage_kind) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period date := (date_trunc('month', now() at time zone 'Europe/Paris'))::date;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  v_limit integer := case p_kind::text
    when 'resume_offre' then 2
    when 'adaptation_cv' then 2
    when 'cv_ameliore' then 2
    when 'affinage_cv' then 2
    when 'lettre' then 2
    when 'affinage_lettre' then 2
    else 2
  end;
  v_used integer;
  v_used_today integer;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;

  -- Sérialise les appels simultanés d'un même utilisateur (tous types : la limite du jour
  -- est commune).
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':usage'));

  select count(*) into v_used_today
  from usage
  where user_id = v_user and created_at >= v_day_start;

  if v_used_today >= 50 then
    raise exception 'Limite quotidienne atteinte' using errcode = 'P0003';
  end if;

  select count(*) into v_used
  from usage
  where user_id = v_user and kind = p_kind and period = v_period;

  if v_used >= v_limit and not is_premium(v_user) then
    raise exception 'Limite mensuelle atteinte' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, period) values (v_user, p_kind, v_period);
  return v_used + 1;
end;
$$;

revoke all on function record_ai_usage(ai_usage_kind) from public, anon;
grant execute on function record_ai_usage(ai_usage_kind) to authenticated;

-- Requêtes IA récentes (anti-rafale) : une ligne par requête envoyée à Claude, gardée une
-- heure au plus. Aucune policy : seule check_ai_rate_limit y accède.
create table if not exists ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_requests_user_created_idx on ai_requests (user_id, created_at);

alter table ai_requests enable row level security;

-- À appeler juste avant chaque requête à Claude : refuse (erreur P0002) au-delà de
-- 10 requêtes dans la dernière minute, sinon enregistre la requête.
create or replace function check_ai_rate_limit() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_recent integer;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':ai_rate'));

  -- Ménage : seules les requêtes récentes servent.
  delete from ai_requests where user_id = v_user and created_at < now() - interval '1 hour';

  select count(*) into v_recent
  from ai_requests
  where user_id = v_user and created_at > now() - interval '1 minute';

  if v_recent >= 10 then
    raise exception 'Trop de requêtes' using errcode = 'P0002';
  end if;

  insert into ai_requests (user_id) values (v_user);
end;
$$;

revoke all on function check_ai_rate_limit() from public, anon;
grant execute on function check_ai_rate_limit() to authenticated;
