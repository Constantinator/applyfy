-- Applyfy — schéma initial
-- À exécuter dans Supabase (SQL Editor) ou via `supabase db push`.

create type application_status as enum (
  'brouillon',
  'envoyee',
  'relancee',
  'entretien',
  'offre',
  'refusee'
);

create type application_event_type as enum (
  'creation',
  'envoi',
  'relance',
  'changement_statut',
  'note'
);

-- Profil étudiant (1 par utilisateur), utilisé par l'assistant de rédaction.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  school text,
  degree text,
  skills text[] not null default '{}',
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null,
  position text not null,
  location text,
  offer_url text,
  offer_description text,
  contact_name text,
  contact_email text,
  status application_status not null default 'brouillon',
  applied_at date,
  last_contact_at date,
  cover_letter text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_id_idx on applications (user_id, created_at desc);

-- Historique d'une candidature (fiche candidature).
create table application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type application_event_type not null,
  content text,
  created_at timestamptz not null default now()
);

create index application_events_application_id_idx on application_events (application_id, created_at desc);

-- updated_at automatique
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger applications_updated_at before update on applications
  for each row execute function set_updated_at();

-- Row Level Security : chaque étudiant ne voit que ses données.
alter table profiles enable row level security;
alter table applications enable row level security;
alter table application_events enable row level security;

create policy "profiles_own" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "applications_own" on applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "application_events_own" on application_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
