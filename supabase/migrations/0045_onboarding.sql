-- Parcours d'accueil (/bienvenue) : réponses et progression, une ligne par compte, pour la reprise
-- et les statistiques (/admin). Seuls les comptes créés après la mise en ligne le suivent
-- (ONBOARDING_LAUNCHED_AT, src/lib/onboarding.ts). Valeurs alignées avec ce fichier.
-- Rejouable, additive : une table, aucune donnée existante modifiée.
--
-- Retour arrière : drop table if exists onboarding_progress;

create table if not exists onboarding_progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Écran 1 : « Tu cherches un job en ce moment ? » (null : écran passé).
  job_search text check (job_search in ('oui', 'pas_encore')),
  -- Écran 3 : « Tu as déjà un CV ? » (null : écran passé ou pas encore atteint).
  has_cv text check (has_cv in ('oui', 'plus_tard')),
  -- Écran en cours, pour reprendre là où la personne s'est arrêtée.
  step text not null default 'accueil'
    check (step in ('accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre')),
  -- Chemins A et B (lot suivant) : ce que la personne a choisi en dernier.
  choice text check (choice in ('import', 'zero', 'lien', 'recherche')),
  -- Écrans quittés par « Passer ».
  skipped_steps text[] not null default '{}' check (
    skipped_steps <@ array['accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre']::text[]
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists onboarding_progress_updated_at on onboarding_progress;
create trigger onboarding_progress_updated_at before update on onboarding_progress
  for each row execute function set_updated_at();

-- Chacun lit, crée et modifie uniquement sa propre ligne ; les statistiques (/admin) passent par
-- la clé service_role.
alter table onboarding_progress enable row level security;
revoke all on onboarding_progress from anon;

drop policy if exists "onboarding_progress_select_own" on onboarding_progress;
create policy "onboarding_progress_select_own" on onboarding_progress
  for select using (user_id = auth.uid());

drop policy if exists "onboarding_progress_insert_own" on onboarding_progress;
create policy "onboarding_progress_insert_own" on onboarding_progress
  for insert with check (user_id = auth.uid());

drop policy if exists "onboarding_progress_update_own" on onboarding_progress;
create policy "onboarding_progress_update_own" on onboarding_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
