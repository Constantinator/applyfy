-- Fiche candidature : « Ouvrir l'éditeur de CV » crée désormais un CV dans le CV Builder.
--   cv_builder.application_id  candidature liée (un seul CV par candidature). Supprimer la
--                              candidature garde le CV, sans lien.
--   profile_cvs.cv_data        CV du profil au format du CV Builder : extrait une seule fois, puis
--                              réutilisé gratuitement pour chaque candidature (comme la colonne
--                              html, migration 0019).

alter table cv_builder
  add column if not exists application_id uuid references applications (id) on delete set null;

create unique index if not exists cv_builder_application_idx on cv_builder (application_id)
  where application_id is not null;

-- Un CV ne peut être lié qu'à une candidature du même utilisateur.
drop policy if exists "cv_builder_insert_own" on cv_builder;
create policy "cv_builder_insert_own" on cv_builder
  for insert with check (
    user_id = auth.uid()
    and (application_id is null or application_id in (select id from applications where user_id = auth.uid()))
  );

drop policy if exists "cv_builder_update_own" on cv_builder;
create policy "cv_builder_update_own" on cv_builder
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (application_id is null or application_id in (select id from applications where user_id = auth.uid()))
  );

alter table profile_cvs
  add column if not exists cv_data jsonb check (pg_column_size(cv_data) <= 1000000),
  add column if not exists cv_data_at timestamptz;
