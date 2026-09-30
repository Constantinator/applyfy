-- Documents (CV, lettre de motivation) rattachés à une candidature + événement "réponse".

alter type application_event_type add value if not exists 'reponse';

-- La lettre vit désormais dans application_documents.
alter table applications drop column if exists cover_letter;

create type application_document_kind as enum ('cv', 'lettre_motivation');

-- Un document est soit un fichier (Storage, bucket "documents"), soit un texte généré.
create table application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind application_document_kind not null,
  file_name text not null,
  storage_path text,
  content text,
  created_at timestamptz not null default now(),
  check (storage_path is not null or content is not null)
);

create index application_documents_application_id_idx on application_documents (application_id);

alter table application_documents enable row level security;

create policy "application_documents_own" on application_documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bucket privé ; chemins attendus : <user_id>/<application_id>/<fichier>
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_own_files" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
