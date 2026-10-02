-- Chat « Affiner avec l'IA » : 5 messages maximum par candidature.
-- Chaque message est enregistré dans la table usage (migration 0011) avec le type
-- 'affinage_cv' et la candidature concernée. Ces messages ne comptent pas dans les
-- limites mensuelles (résumés, adaptations, lettres).

alter type ai_usage_kind add value if not exists 'affinage_cv';

alter table usage
  add column if not exists application_id uuid references applications (id) on delete cascade;

create index if not exists usage_application_idx on usage (application_id, kind)
  where application_id is not null;

-- Enregistre un message du chat pour une candidature de l'utilisateur connecté. Refuse
-- (erreur P0001) si les 5 messages sont déjà utilisés. Retourne le nombre de messages
-- utilisés pour cette candidature. La limite (5) doit rester alignée avec
-- CV_REFINE_LIMIT (src/lib/ai-usage-limits.ts).
create or replace function record_cv_refinement(p_application uuid) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;
  if not exists (select 1 from applications where id = p_application and user_id = v_user) then
    raise exception 'Candidature introuvable' using errcode = 'P0002';
  end if;

  -- Sérialise les messages simultanés pour une même candidature.
  perform pg_advisory_xact_lock(hashtext('affinage:' || p_application::text));

  select count(*) into v_used
  from usage
  where application_id = p_application and kind = 'affinage_cv';

  if v_used >= 5 then
    raise exception 'Limite de messages atteinte' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, application_id) values (v_user, 'affinage_cv', p_application);
  return v_used + 1;
end;
$$;

revoke all on function record_cv_refinement(uuid) from public, anon;
grant execute on function record_cv_refinement(uuid) to authenticated;
