-- Personnalisation du CV amélioré (police, taille, couleur d'accent, mise en page).
alter table applications add column if not exists cv_improved_style jsonb;
