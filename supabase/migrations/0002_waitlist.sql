-- Liste d'attente de la landing page.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

-- Les visiteurs peuvent s'inscrire, mais personne ne peut lire la liste via l'API publique.
create policy "waitlist_insert_public" on waitlist
  for insert to anon, authenticated with check (true);
