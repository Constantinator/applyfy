-- Limite du coach (plan gratuit, CVB_COACH_DAILY_LIMIT questions par jour) : une ligne par refus,
-- pour mesurer si la limite gêne (/admin, section « Limite du coach »). Surfaces alignées avec
-- src/lib/coach-limit-rules.ts.
-- Rejouable, additive : une table, aucune donnée existante modifiée.
--
-- Retour arrière : drop table if exists coach_limit_hits;

create table if not exists coach_limit_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  -- « editeur » : coach de l'éditeur du CV Builder ; « panneau » : panneau de Lumeo.
  surface text not null check (surface in ('editeur', 'panneau'))
);

create index if not exists coach_limit_hits_occurred_idx on coach_limit_hits (occurred_at desc);

-- Aucune règle d'accès : seul le service_role (qui contourne la RLS) écrit et lit.
alter table coach_limit_hits enable row level security;
revoke all on coach_limit_hits from anon, authenticated;
