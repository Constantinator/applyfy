-- Suggestions d'adaptation de CV générées par l'assistant (le CV lui-même n'est pas stocké).
alter table applications add column if not exists cv_suggestions jsonb;
alter table applications add column if not exists cv_suggestions_at timestamptz;
