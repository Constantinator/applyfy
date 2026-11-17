-- CV Builder : langue du CV et traduction complète (français <-> anglais).
-- 1. cv_builder.language : langue du contenu ('fr' ou 'en'). Elle fixe les titres des rubriques,
--    « Aujourd'hui / Present » et la langue du PDF. Null : langue détectée par l'application
--    (cvLanguage, src/lib/coach-language.ts) ; aucun rattrapage des CV existants.
-- 2. cvb_traduction : traduction de tout le CV, 1 par mois avec le plan gratuit, sans quota
--    mensuel en Premium et pour les beta testeurs actifs (is_premium), dans la limite commune
--    de 50 actions IA par jour. Limites alignées avec AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts).
-- Couvert par les politiques RLS existantes de cv_builder.

alter table cv_builder add column if not exists language text
  check (language is null or language in ('fr', 'en'));

comment on column cv_builder.language is
  'Langue du contenu du CV (fr, en) ; null : détectée par l''application.';

alter type ai_usage_kind add value if not exists 'cvb_traduction';

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
    when 'cvb_puce' then 1
    when 'cvb_resume' then 1
    when 'cvb_adaptation' then 1
    when 'cvb_import' then 1
    when 'cvb_chat' then 2
    when 'cvb_coach' then 1000
    when 'cvb_traduction' then 1
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
