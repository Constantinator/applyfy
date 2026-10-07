-- Avis des utilisateurs (« Donner mon avis », dans la sidebar) : un avis par utilisateur,
-- modifiable. Valeurs alignées avec src/lib/feedback-options.ts.

create table if not exists feedback (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  favorite_feature text not null check (
    favorite_feature in ('suivi', 'adaptation_cv', 'lettre', 'recherche_offres', 'relances')
  ),
  missing text[] not null default '{}' check (
    missing <@ array['plus_offres', 'adaptation_cv', 'mobile', 'linkedin', 'autre']::text[]
  ),
  improvement text check (char_length(improvement) <= 2000),
  recommend text not null check (recommend in ('oui', 'peut_etre', 'non')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists feedback_updated_at on feedback;
create trigger feedback_updated_at before update on feedback
  for each row execute function set_updated_at();

-- Chacun lit, crée et modifie uniquement son propre avis ; la lecture de tous les avis
-- (tableau de bord admin) passe par la clé service_role.
alter table feedback enable row level security;

drop policy if exists "feedback_select_own" on feedback;
create policy "feedback_select_own" on feedback
  for select using (user_id = auth.uid());

drop policy if exists "feedback_insert_own" on feedback;
create policy "feedback_insert_own" on feedback
  for insert with check (user_id = auth.uid());

drop policy if exists "feedback_update_own" on feedback;
create policy "feedback_update_own" on feedback
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
