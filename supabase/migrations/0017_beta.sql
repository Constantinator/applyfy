-- Programme beta testeurs : Premium gratuit jusqu'au 31 décembre 2026, en échange de
-- 3 rapports (semaine 1, semaine 2, mois 1). 30 places au plus. Un rapport non soumis à
-- temps suspend l'accès (tâche quotidienne /api/cron/beta).
-- Règles alignées avec src/lib/beta-rules.ts.

create table if not exists beta_testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  joined_at timestamptz not null default now(),
  premium_until date not null default '2026-12-31',
  -- Rapports (1, 2, 3) dont le rappel « J-2 » a déjà été envoyé.
  reminders_sent smallint[] not null default '{}',
  suspended_at timestamptz,
  suspension_reason text,
  updated_at timestamptz not null default now()
);

drop trigger if exists beta_testers_updated_at on beta_testers;
create trigger beta_testers_updated_at before update on beta_testers
  for each row execute function set_updated_at();

create table if not exists beta_reports (
  user_id uuid not null references beta_testers (user_id) on delete cascade,
  report_number smallint not null check (report_number between 1 and 3),
  answers jsonb not null check (char_length(answers::text) <= 20000),
  submitted_at timestamptz not null default now(),
  primary key (user_id, report_number)
);

create index if not exists beta_reports_submitted_idx on beta_reports (submitted_at desc);

-- Lecture de ses propres données uniquement. Aucune policy d'écriture : l'inscription et
-- les rapports passent par les fonctions ci-dessous, qui appliquent les règles ; le
-- tableau de bord admin et la tâche quotidienne utilisent la clé service_role.
alter table beta_testers enable row level security;
alter table beta_reports enable row level security;

drop policy if exists "beta_testers_select_own" on beta_testers;
create policy "beta_testers_select_own" on beta_testers
  for select using (user_id = auth.uid());

drop policy if exists "beta_reports_select_own" on beta_reports;
create policy "beta_reports_select_own" on beta_reports
  for select using (user_id = auth.uid());

-- Date limite d'un rapport : 7, 14 et 30 jours après l'inscription (calcul identique à
-- reportDeadline côté application : sessions Supabase en UTC, sans changement d'heure).
create or replace function beta_report_deadline(p_joined timestamptz, p_number integer)
returns timestamptz
language sql
stable
as $$
  select p_joined + make_interval(days => case p_number when 1 then 7 when 2 then 14 else 30 end);
$$;

-- Places restantes (affichées avant l'inscription).
create or replace function beta_spots_left() returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 30 - count(*)::integer) from beta_testers where status = 'active';
$$;

revoke all on function beta_spots_left() from public;
grant execute on function beta_spots_left() to anon, authenticated;

-- Inscription de l'utilisateur connecté. Erreurs (P0001) : « deja_inscrit », « complet ».
create or replace function join_beta() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;

  -- Sérialise les inscriptions : la limite de 30 places ne peut pas être dépassée.
  perform pg_advisory_xact_lock(hashtext('beta_join'));

  if exists (select 1 from beta_testers where user_id = v_user) then
    raise exception 'deja_inscrit' using errcode = 'P0001';
  end if;
  if (select count(*) from beta_testers where status = 'active') >= 30 then
    raise exception 'complet' using errcode = 'P0001';
  end if;

  insert into beta_testers (user_id) values (v_user);
end;
$$;

revoke all on function join_beta() from public, anon;
grant execute on function join_beta() to authenticated;

-- Dépôt d'un rapport par l'utilisateur connecté (contenu vérifié par l'application).
-- Erreurs (P0001) : « non_inscrit », « suspendu », « pas_encore_ouvert », « en_retard »,
-- « deja_soumis ».
create or replace function submit_beta_report(p_number integer, p_answers jsonb) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tester beta_testers%rowtype;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;
  if p_number not between 1 and 3 then
    raise exception 'rapport_invalide' using errcode = 'P0001';
  end if;

  select * into v_tester from beta_testers where user_id = v_user for update;
  if not found then
    raise exception 'non_inscrit' using errcode = 'P0001';
  end if;
  if v_tester.status <> 'active' then
    raise exception 'suspendu' using errcode = 'P0001';
  end if;
  -- Un rapport s'ouvre à la date limite du précédent (dès l'inscription pour le 1er).
  if p_number > 1 and now() < beta_report_deadline(v_tester.joined_at, p_number - 1) then
    raise exception 'pas_encore_ouvert' using errcode = 'P0001';
  end if;
  if now() > beta_report_deadline(v_tester.joined_at, p_number) then
    raise exception 'en_retard' using errcode = 'P0001';
  end if;
  if exists (select 1 from beta_reports where user_id = v_user and report_number = p_number) then
    raise exception 'deja_soumis' using errcode = 'P0001';
  end if;

  insert into beta_reports (user_id, report_number, answers) values (v_user, p_number, p_answers);
end;
$$;

revoke all on function submit_beta_report(integer, jsonb) from public, anon;
grant execute on function submit_beta_report(integer, jsonb) to authenticated;

-- Premium : abonnement Stripe en cours (migration 0014) OU beta testeur actif jusqu'à la
-- fin du programme. Aligné avec isPremium (src/lib/subscription.ts).
create or replace function is_premium(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user and status in ('active', 'trialing', 'past_due')
  ) or exists (
    select 1 from beta_testers
    where user_id = p_user
      and status = 'active'
      and premium_until >= (now() at time zone 'Europe/Paris')::date
  );
$$;

revoke all on function is_premium(uuid) from public, anon, authenticated;
