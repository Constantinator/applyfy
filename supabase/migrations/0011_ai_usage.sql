-- Limites mensuelles d'utilisation de l'IA (plan gratuit) : 3 résumés d'offre,
-- 3 adaptations de CV et 3 lettres de motivation par mois.
--
-- Chaque action IA réussie ajoute une ligne, rattachée au mois en cours (heure de Paris).
-- Le compteur d'un mois = nombre de lignes de ce mois : la remise à zéro au 1er du mois
-- est automatique, sans tâche planifiée. L'historique des mois passés est conservé.

do $$
begin
  create type ai_usage_kind as enum ('resume_offre', 'adaptation_cv', 'lettre');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind ai_usage_kind not null,
  -- 1er jour du mois de l'action (fuseau Europe/Paris).
  period date not null default (date_trunc('month', now() at time zone 'Europe/Paris'))::date,
  created_at timestamptz not null default now()
);

create index if not exists usage_user_period_idx on usage (user_id, period, kind);

-- Lecture de ses propres compteurs uniquement. Aucune policy d'écriture : un utilisateur
-- ne peut ni supprimer ses lignes (remise à zéro) ni en insérer directement ; l'ajout
-- passe exclusivement par record_ai_usage, qui vérifie la limite.
alter table usage enable row level security;

drop policy if exists "usage_select_own" on usage;
create policy "usage_select_own" on usage
  for select using (user_id = auth.uid());

-- Enregistre une action IA de l'utilisateur connecté. Refuse (erreur P0001) si la limite
-- du mois est déjà atteinte. Retourne le nombre d'actions de ce type utilisées ce mois-ci.
-- La limite (3) doit rester alignée avec FREE_MONTHLY_LIMIT (src/lib/ai-usage-limits.ts).
create or replace function record_ai_usage(p_kind ai_usage_kind) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period date := (date_trunc('month', now() at time zone 'Europe/Paris'))::date;
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

  if v_used >= 3 then
    raise exception 'Limite mensuelle atteinte' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, period) values (v_user, p_kind, v_period);
  return v_used + 1;
end;
$$;

revoke all on function record_ai_usage(ai_usage_kind) from public, anon;
grant execute on function record_ai_usage(ai_usage_kind) to authenticated;
