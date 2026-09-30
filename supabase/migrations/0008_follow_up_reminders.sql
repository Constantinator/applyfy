-- Rappels de relance par email (tâche quotidienne, cf. src/app/api/cron/relances).

-- 1. Préférences de l'utilisateur (valeurs par défaut si la ligne n'existe pas encore).
alter table profiles add column if not exists reminders_enabled boolean not null default true;
alter table profiles add column if not exists first_reminder_days integer not null default 7;
alter table profiles add column if not exists second_reminder_days integer not null default 14;

alter table profiles drop constraint if exists profiles_first_reminder_days_check;
alter table profiles add constraint profiles_first_reminder_days_check
  check (first_reminder_days in (5, 7, 10, 14));
alter table profiles drop constraint if exists profiles_second_reminder_days_check;
alter table profiles add constraint profiles_second_reminder_days_check
  check (second_reminder_days in (7, 10, 14));

-- 2. Suivi des rappels envoyés par candidature (2 maximum ; évite les doublons).
alter table applications add column if not exists reminders_sent integer not null default 0;
alter table applications add column if not exists last_reminder_at timestamptz;

-- 3. Nouveau type d'événement d'historique : rappel envoyé par email.
alter type application_event_type add value if not exists 'rappel';
