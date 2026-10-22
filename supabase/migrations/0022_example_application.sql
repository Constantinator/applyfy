-- Candidature exemple créée à l'inscription (src/lib/example-application.ts) : affichée
-- avec un badge « Exemple », ignorée par les rappels de relance, l'email J+2 et les KPI admin.
alter table applications
  add column if not exists is_example boolean not null default false;
