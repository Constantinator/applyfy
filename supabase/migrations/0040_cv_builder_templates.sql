-- CV Builder : nouveaux modèles. La contrainte de la colonne template_id (migrations 0025 et 0030)
-- est élargie aux identifiants des lots « nouveaux modèles » : serif-centre et bandeau-droite
-- (partie 1), puis lateral, bandeau-gauche et serif-compact (lots suivants), pour ne la modifier
-- qu'une fois. Additive : les 6 identifiants actuels restent valides, le code déjà en production
-- continue de fonctionner. Les identifiants proposés par l'application : CV_TEMPLATES
-- (src/lib/cv-builder-types.ts).

alter table cv_builder drop constraint if exists cv_builder_template_id_check;
alter table cv_builder add constraint cv_builder_template_id_check
  check (template_id in (
    'minimaliste', 'classique', 'moderne', 'sidebar', 'tech', 'finance',
    'serif-centre', 'bandeau-droite', 'lateral', 'bandeau-gauche', 'serif-compact'
  ));
