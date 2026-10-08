-- CV du profil au format de l'éditeur : « Ouvrir l'éditeur de CV » sur une candidature
-- retranscrit le PDF du profil une seule fois, puis réutilise cette version pour les
-- candidatures suivantes. Mis à jour avec la session de l'utilisateur (policy
-- profile_cvs_own, migration 0007).

alter table profile_cvs add column if not exists html text;
alter table profile_cvs add column if not exists html_at timestamptz;
