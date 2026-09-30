-- Lettre de motivation générée pour une candidature (HTML nettoyé, modifiable dans
-- l'éditeur), date de dernière modification et personnalisation (police, taille, couleur).
alter table applications add column if not exists cover_letter_html text;
alter table applications add column if not exists cover_letter_at timestamptz;
alter table applications add column if not exists cover_letter_style jsonb;
