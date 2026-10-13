-- Roadmap produit (/admin/roadmap) : éléments gérés par l'admin uniquement. Valeurs alignées
-- avec src/lib/roadmap-options.ts.

create table if not exists roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'termine')),
  category text not null check (category in ('court_terme', 'moyen_terme', 'long_terme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roadmap_items_category_idx on roadmap_items (category, created_at);

drop trigger if exists roadmap_items_updated_at on roadmap_items;
create trigger roadmap_items_updated_at before update on roadmap_items
  for each row execute function set_updated_at();

-- Aucune policy : lecture et écriture uniquement par le serveur avec la clé service_role,
-- après vérification de l'admin (requireAdmin).
alter table roadmap_items enable row level security;
