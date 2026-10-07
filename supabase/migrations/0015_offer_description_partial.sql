-- Candidature créée depuis une offre (Adzuna, France Travail) dont seule une partie de la
-- description a pu être récupérée : la fiche affiche « Description partielle — voir
-- l'offre complète ↗ » avec un lien vers l'offre originale (offer_url).

alter table applications
  add column if not exists offer_description_partial boolean not null default false;
