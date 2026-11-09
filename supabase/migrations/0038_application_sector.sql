-- Secteur d'une candidature (pastille de couleur dans /candidatures et sa fiche).
-- Valeurs attendues : finance, conseil, tech, marketing, creatif, commercial, rh, sante, etudiant,
-- luxe (src/lib/sectors.ts). Volontairement sans contrainte : un secteur nouveau ou inconnu
-- s'affiche « Autre ». Null si aucun secteur n'est reconnu dans le poste et la description.
-- Couvert par les politiques RLS existantes de la table applications.

alter table applications add column if not exists sector text;

comment on column applications.sector is
  'Secteur détecté (poste + description de l''offre), null si aucun ; affiché « Autre » s''il est inconnu.';
