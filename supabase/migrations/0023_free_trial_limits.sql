-- Plan gratuit : un essai par fonctionnalité IA et par mois (au lieu de 2), et nouveau type
-- d'action « resume_recherche » : résumé d'une offre de la page « Trouver une offre »,
-- compté à part du résumé d'offre d'une candidature. Limites alignées avec
-- AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts). Le reste de record_ai_usage
-- (limite du jour, Premium sans limite mensuelle) est inchangé depuis la migration 0020.

alter type ai_usage_kind add value if not exists 'resume_recherche';

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
    when 'resume_offre' then 1
    when 'resume_recherche' then 1
    when 'adaptation_cv' then 1
    when 'cv_ameliore' then 1
    when 'affinage_cv' then 1
    when 'lettre' then 1
    when 'affinage_lettre' then 1
    else 1
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
    raise exception 'Essai gratuit utilisé' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, period) values (v_user, p_kind, v_period);
  return v_used + 1;
end;
$$;

revoke all on function record_ai_usage(ai_usage_kind) from public, anon;
grant execute on function record_ai_usage(ai_usage_kind) to authenticated;
