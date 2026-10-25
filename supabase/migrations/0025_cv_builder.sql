-- CV Builder (/cv-builder) : CV créés dans Applyfy à partir d'un formulaire, avec 5 modèles
-- de mise en page. Toutes les sections du CV sont dans « data » (JSONB), validées côté
-- serveur par CvDataSchema (src/lib/cv-builder-types.ts).
--
-- Trois nouveaux types d'action IA, un essai gratuit par mois chacun (illimité en Premium) :
--   cvb_puce        « Améliorer avec l'IA » sur un point d'expérience
--   cvb_resume      « Générer un résumé » de la section Profil
--   cvb_adaptation  « Adapter à une offre »
-- Limites alignées avec AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts).

create table if not exists cv_builder (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Mon CV' check (char_length(title) between 1 and 120),
  template_id text not null default 'minimaliste'
    check (template_id in ('minimaliste', 'classique', 'moderne', 'sidebar', 'tech')),
  -- Photo comprise (JPEG redimensionné, ~50 Ko) : borne large contre les abus.
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cv_builder_user_idx on cv_builder (user_id, updated_at desc);

drop trigger if exists cv_builder_updated_at on cv_builder;
create trigger cv_builder_updated_at before update on cv_builder
  for each row execute function set_updated_at();

alter table cv_builder enable row level security;

drop policy if exists "cv_builder_select_own" on cv_builder;
create policy "cv_builder_select_own" on cv_builder
  for select using (user_id = auth.uid());

drop policy if exists "cv_builder_insert_own" on cv_builder;
create policy "cv_builder_insert_own" on cv_builder
  for insert with check (user_id = auth.uid());

drop policy if exists "cv_builder_update_own" on cv_builder;
create policy "cv_builder_update_own" on cv_builder
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cv_builder_delete_own" on cv_builder;
create policy "cv_builder_delete_own" on cv_builder
  for delete using (user_id = auth.uid());

alter type ai_usage_kind add value if not exists 'cvb_puce';
alter type ai_usage_kind add value if not exists 'cvb_resume';
alter type ai_usage_kind add value if not exists 'cvb_adaptation';

-- Limite des nouveaux types : la branche « else 1 » de record_ai_usage (migration 0023)
-- s'applique déjà ; la fonction est réécrite pour les nommer explicitement.
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
