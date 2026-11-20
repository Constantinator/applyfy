-- Temps gagné par candidature (bêta) : deux réponses par testeur, en minutes (avant Applyfy,
-- avec Applyfy), modifiables. Le gain (1 - après / avant) n'est pas stocké : il est recalculé.
-- Règles alignées avec src/lib/beta-time-saving.ts (bornes 1 à 600 minutes).
-- Rejouable, additive : une table et une fonction, aucune donnée existante modifiée.
--
-- Peuvent répondre : testeurs actifs ou suspendus (pas les retirés), avec au moins une vraie
-- candidature (la candidature exemple ne compte pas).
--
-- Retour arrière : drop function if exists save_beta_time_saving(integer, integer);
--                  drop table if exists beta_time_savings;

create table if not exists beta_time_savings (
  user_id uuid primary key references beta_testers (user_id) on delete cascade,
  minutes_before smallint not null check (minutes_before between 1 and 600),
  minutes_after smallint not null check (minutes_after between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists beta_time_savings_updated_at on beta_time_savings;
create trigger beta_time_savings_updated_at before update on beta_time_savings
  for each row execute function set_updated_at();

-- Lecture de sa propre réponse uniquement. Aucune policy d'écriture : l'enregistrement passe par
-- save_beta_time_saving ; le suivi admin utilise la clé service_role.
alter table beta_time_savings enable row level security;
revoke all on beta_time_savings from anon;

drop policy if exists "beta_time_savings_select_own" on beta_time_savings;
create policy "beta_time_savings_select_own" on beta_time_savings
  for select using (user_id = auth.uid());

-- Erreurs (P0001) : « non_inscrit », « retire », « sans_candidature », « minutes_invalides ».
create or replace function save_beta_time_saving(p_before integer, p_after integer) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;
  if p_before is null or p_after is null or p_before not between 1 and 600 or p_after not between 1 and 600 then
    raise exception 'minutes_invalides' using errcode = 'P0001';
  end if;

  select status into v_status from beta_testers where user_id = v_user;
  if not found then
    raise exception 'non_inscrit' using errcode = 'P0001';
  end if;
  if v_status not in ('active', 'suspended') then
    raise exception 'retire' using errcode = 'P0001';
  end if;
  if not exists (select 1 from applications where user_id = v_user and is_example = false) then
    raise exception 'sans_candidature' using errcode = 'P0001';
  end if;

  insert into beta_time_savings (user_id, minutes_before, minutes_after)
  values (v_user, p_before, p_after)
  on conflict (user_id) do update
    set minutes_before = excluded.minutes_before, minutes_after = excluded.minutes_after;
end;
$$;

revoke all on function save_beta_time_saving(integer, integer) from public, anon;
grant execute on function save_beta_time_saving(integer, integer) to authenticated;
