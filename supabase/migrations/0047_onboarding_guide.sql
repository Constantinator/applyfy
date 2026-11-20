-- Phase guidée du chemin A (lot 6) : après l'import ou la création du CV, l'éditeur guide la
-- personne (améliorer le CV, le télécharger, ajouter une offre) avant de terminer le parcours.
-- Étapes alignées avec src/lib/onboarding.ts (ONBOARDING_STEPS).
-- Rejouable, additive : les deux contrôles de onboarding_progress sont élargis, deux colonnes
-- facultatives sont ajoutées ; aucune donnée existante modifiée.
--
-- Sans cette migration, le code garde le comportement d'avant : parcours terminé au clic du
-- chemin A, pas de bandeau sur la fiche.
--
-- Retour arrière (seulement après avoir ramené les étapes guidées à une étape de la 0045) :
--   update onboarding_progress set step = 'chemin_cv' where step in ('guide_cv', 'guide_telecharger', 'guide_offre');
--   update onboarding_progress set skipped_steps = array(
--     select s from unnest(skipped_steps) s where s not in ('guide_cv', 'guide_telecharger', 'guide_offre'));
--   alter table onboarding_progress drop constraint if exists onboarding_progress_step_check;
--   alter table onboarding_progress add constraint onboarding_progress_step_check
--     check (step in ('accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre'));
--   alter table onboarding_progress drop constraint if exists onboarding_progress_skipped_steps_check;
--   alter table onboarding_progress add constraint onboarding_progress_skipped_steps_check
--     check (skipped_steps <@ array['accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre']::text[]);
--   alter table onboarding_progress drop column if exists guide_application_id, drop column if exists fiche_banner_seen_at;

-- Anciens contrôles des étapes (créés par la 0045, quel que soit leur nom) : retirés, puis recréés
-- avec un nom fixe et la liste élargie.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.onboarding_progress'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%accueil%'
  loop
    execute format('alter table onboarding_progress drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table onboarding_progress add constraint onboarding_progress_step_check
  check (step in ('accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre', 'guide_cv', 'guide_telecharger', 'guide_offre'));

alter table onboarding_progress add constraint onboarding_progress_skipped_steps_check
  check (skipped_steps <@ array['accueil', 'apport', 'temps', 'cv', 'chemin_cv', 'chemin_offre', 'guide_cv', 'guide_telecharger', 'guide_offre']::text[]);

-- Candidature ajoutée depuis la phase guidée (bandeau de Lumeo sur sa fiche, lot 6b).
alter table onboarding_progress
  add column if not exists guide_application_id uuid references applications (id) on delete set null;
-- Bandeau de la fiche vu (affiché une seule fois).
alter table onboarding_progress add column if not exists fiche_banner_seen_at timestamptz;
