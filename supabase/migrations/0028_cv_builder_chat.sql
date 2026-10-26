-- CV Builder : chat « Affiner avec l'IA » de l'éditeur (modifications du CV en langage
-- naturel). Un essai gratuit par mois, illimité en Premium : la branche « else 1 » de
-- record_ai_usage (migration 0025) s'applique à ce nouveau type. Limite alignée avec
-- AI_MONTHLY_LIMITS (src/lib/ai-usage-limits.ts).

alter type ai_usage_kind add value if not exists 'cvb_chat';
