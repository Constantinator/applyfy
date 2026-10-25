-- CV Builder : « Importer un CV » (PDF ou Word lu par l'IA pour pré-remplir le formulaire).
-- Un essai gratuit par mois, illimité en Premium : la branche « else 1 » de
-- record_ai_usage (migration 0025) s'applique à ce nouveau type. Limite alignée avec
-- AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts).
--
-- Le fichier est déposé par le navigateur dans le bucket privé « documents »
-- (<user_id>/cv-builder-import/…, policy documents_own_files de la migration 0003), lu par
-- le serveur puis supprimé aussitôt.

alter type ai_usage_kind add value if not exists 'cvb_import';
