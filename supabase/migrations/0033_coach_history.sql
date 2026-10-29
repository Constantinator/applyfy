-- CV Builder : historique de la conversation avec le coach, une ligne par CV, pour la retrouver
-- d'une session à l'autre. Lu et écrit par l'éditeur avec la session de l'utilisateur (client
-- Supabase du navigateur, RLS) :
--   messages        échanges affichés dans le chat ({ role: "user" | "assistant", content }),
--                   les 60 derniers ;
--   skipped_points  points que le coach a abandonnés (le candidat ne sait pas ou ne veut pas
--                   répondre), renvoyés au coach à chaque échange.
-- Supprimée avec le CV (et donc avec le compte).

create table if not exists cv_coach_history (
  cv_id uuid primary key references cv_builder (id) on delete cascade,
  -- Écrit par le navigateur : bornes larges contre les abus.
  messages jsonb not null default '[]'::jsonb check (pg_column_size(messages) <= 200000),
  skipped_points jsonb not null default '[]'::jsonb check (pg_column_size(skipped_points) <= 20000),
  updated_at timestamptz not null default now()
);

drop trigger if exists cv_coach_history_updated_at on cv_coach_history;
create trigger cv_coach_history_updated_at before update on cv_coach_history
  for each row execute function set_updated_at();

alter table cv_coach_history enable row level security;

-- Lecture et écriture réservées au propriétaire du CV.
drop policy if exists "cv_coach_history_own" on cv_coach_history;
create policy "cv_coach_history_own" on cv_coach_history
  for all
  using (cv_id in (select id from cv_builder where user_id = auth.uid()))
  with check (cv_id in (select id from cv_builder where user_id = auth.uid()));
