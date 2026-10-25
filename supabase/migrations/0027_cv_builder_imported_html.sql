-- CV Builder : « Créer un CV à partir d'un CV existant ». Le CV importé (PDF ou Word) est
-- d'abord retranscrit en HTML et modifiable tel quel (même éditeur que le CV d'une
-- candidature), pendant que l'IA extrait ses données en arrière-plan dans « data ».
-- « Convertir en template Applyfy » vide ces colonnes et passe aux modèles.
--   imported_html   HTML du CV importé (nettoyé côté serveur, cf. sanitizeCvHtml)
--   imported_style  sa mise en forme (police, taille, couleur, mise en page)
--   import_status   extraction des données : pending, ready ou failed ; null une fois converti
--   imported_edited le HTML a été modifié : la conversion relit le CV modifié

alter table cv_builder add column if not exists imported_html text
  check (imported_html is null or char_length(imported_html) <= 100000);
alter table cv_builder add column if not exists imported_style jsonb;
alter table cv_builder add column if not exists import_status text
  check (import_status is null or import_status in ('pending', 'ready', 'failed'));
alter table cv_builder add column if not exists imported_edited boolean not null default false;
