-- CV de référence du profil (fichier dans le bucket privé "documents",
-- chemin <user_id>/profil/cv.pdf) et CV amélioré par candidature.

alter table profiles add column if not exists cv_file_name text;
alter table profiles add column if not exists cv_path text;
alter table profiles add column if not exists cv_uploaded_at timestamptz;

-- CV amélioré (HTML nettoyé côté serveur : balises de mise en forme uniquement).
alter table applications add column if not exists cv_improved_html text;
alter table applications add column if not exists cv_improved_at timestamptz;
