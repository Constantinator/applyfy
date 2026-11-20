-- Titre d'origine d'une candidature dont le titre importé a été nettoyé (« H/F », lieu,
-- département, référence, capitales… : tidyImportedTitle dans src/lib/position-title.ts).
-- Rempli seulement quand le nettoyage a changé le titre et que le titre proposé a été enregistré
-- sans retouche ; null sinon (titre tapé à la main, ou titre déjà propre). Sert à revenir en arrière.
-- Colonne nullable sans valeur par défaut : aucune réécriture de la table.
-- Couvert par les politiques RLS existantes de la table applications.
--
-- Annulation (le code tolère l'absence de la colonne) :
--   alter table applications drop column if exists position_original;

alter table applications add column if not exists position_original text;

comment on column applications.position_original is
  'Titre de l''offre avant nettoyage, si le nettoyage à l''import l''a changé ; null sinon.';
