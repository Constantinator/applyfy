-- Refonte des limites IA du plan gratuit : toutes mensuelles, 2 par type et par mois.
--   resume_offre     2/mois   résumé d'offre
--   adaptation_cv    2/mois   analyse de CV
--   cv_ameliore      2/mois   génération du CV amélioré (regénérations comprises)
--   affinage_cv      2/mois   message du chat « Affiner avec l'IA » du CV
--   lettre           2/mois   génération de lettre (regénérations comprises)
--   affinage_lettre  2/mois   message du chat « Affiner avec l'IA » de la lettre
-- Limites alignées avec AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts).
-- Remplace la limite de 5 messages par candidature (migration 0012).

alter type ai_usage_kind add value if not exists 'cv_ameliore';
alter type ai_usage_kind add value if not exists 'affinage_lettre';

-- Limite par type (aujourd'hui 2 pour tous), comparée sur le texte : les nouvelles
-- valeurs de l'enum ne sont utilisables qu'après validation de cette migration.
create or replace function record_ai_usage(p_kind ai_usage_kind) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period date := (date_trunc('month', now() at time zone 'Europe/Paris'))::date;
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
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;

  -- Sérialise les appels simultanés d'un même utilisateur pour un même type d'action.
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':' || p_kind::text));

  select count(*) into v_used
  from usage
  where user_id = v_user and kind = p_kind and period = v_period;

  if v_used >= v_limit then
    raise exception 'Limite mensuelle atteinte' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, period) values (v_user, p_kind, v_period);
  return v_used + 1;
end;
$$;

revoke all on function record_ai_usage(ai_usage_kind) from public, anon;
grant execute on function record_ai_usage(ai_usage_kind) to authenticated;

-- Plus de limite par candidature : les messages du chat passent par record_ai_usage.
-- (La colonne usage.application_id est conservée : elle n'est plus remplie.)
drop function if exists record_cv_refinement(uuid);
