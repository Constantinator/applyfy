-- Messagerie interne du programme beta : un fil de discussion par beta testeur, entre lui
-- et l'équipe Applyfy (page /beta côté testeur, /admin/beta côté équipe). S'ajoute aux
-- emails existants (rappels, suspensions, messages par email), sans les remplacer.

create table if not exists beta_messages (
  id uuid primary key default gen_random_uuid(),
  -- Fil de discussion : le beta testeur concerné.
  tester_id uuid not null references beta_testers (user_id) on delete cascade,
  sender text not null check (sender in ('admin', 'tester')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  -- Lu par le destinataire (le testeur pour un message de l'équipe, et inversement).
  read_at timestamptz
);

create index if not exists beta_messages_thread_idx on beta_messages (tester_id, created_at);
create index if not exists beta_messages_unread_idx on beta_messages (sender) where read_at is null;

-- Le testeur lit son fil. Aucune policy d'écriture : l'envoi et la lecture passent par les
-- fonctions ci-dessous ; l'équipe utilise la clé service_role.
alter table beta_messages enable row level security;

drop policy if exists "beta_messages_select_own" on beta_messages;
create policy "beta_messages_select_own" on beta_messages
  for select using (tester_id = auth.uid());

-- Message du beta testeur connecté à l'équipe (possible même suspendu, pour poser une
-- question). Erreur (P0001) : « non_inscrit ».
create or replace function send_beta_message(p_body text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := btrim(p_body);
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;
  if not exists (select 1 from beta_testers where user_id = v_user) then
    raise exception 'non_inscrit' using errcode = 'P0001';
  end if;
  insert into beta_messages (tester_id, sender, body) values (v_user, 'tester', v_body);
end;
$$;

revoke all on function send_beta_message(text) from public, anon;
grant execute on function send_beta_message(text) to authenticated;

-- Le testeur connecté a lu les messages de l'équipe.
create or replace function mark_beta_messages_read() returns void
language sql
security definer
set search_path = public
as $$
  update beta_messages set read_at = now()
  where tester_id = auth.uid() and sender = 'admin' and read_at is null;
$$;

revoke all on function mark_beta_messages_read() from public, anon;
grant execute on function mark_beta_messages_read() to authenticated;
