-- 1. Nouveau statut « En attente » (entre « Envoyée » et « Relancée »).
alter type application_status add value if not exists 'en_attente' after 'envoyee';

-- 2. Plusieurs CV par utilisateur (5 maximum), chacun avec un nom personnalisable.
--    Fichiers dans le bucket privé "documents" : <user_id>/profil/<id>.pdf
create table if not exists profile_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists profile_cvs_user_id_idx on profile_cvs (user_id, created_at);

alter table profile_cvs enable row level security;

drop policy if exists "profile_cvs_own" on profile_cvs;
create policy "profile_cvs_own" on profile_cvs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Limite de 5 CV garantie par la base (en plus du contrôle côté application).
create or replace function enforce_profile_cv_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from profile_cvs where user_id = new.user_id) >= 5 then
    raise exception 'Limite de 5 CV atteinte' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_cvs_limit on profile_cvs;
create trigger profile_cvs_limit before insert on profile_cvs
  for each row execute function enforce_profile_cv_limit();

-- Reprise du CV unique enregistré auparavant dans profiles (migration 0006).
insert into profile_cvs (user_id, name, file_name, storage_path, created_at)
select id, 'Mon CV', coalesce(cv_file_name, 'cv.pdf'), cv_path, coalesce(cv_uploaded_at, now())
from profiles
where cv_path is not null
  and not exists (select 1 from profile_cvs p where p.storage_path = profiles.cv_path);

-- Les colonnes cv_* de profiles ne sont plus utilisées (conservées par prudence).
