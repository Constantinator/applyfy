-- CV Builder : 6e modèle « Finance » (sobre, accent marine, titres en Gelasio). La contrainte
-- de la colonne template_id (migration 0025) est élargie au nouvel identifiant. Liste alignée
-- avec CV_TEMPLATES (src/lib/cv-builder-types.ts).

alter table cv_builder drop constraint if exists cv_builder_template_id_check;
alter table cv_builder add constraint cv_builder_template_id_check
  check (template_id in ('minimaliste', 'classique', 'moderne', 'sidebar', 'tech', 'finance'));
