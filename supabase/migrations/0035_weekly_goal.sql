-- Objectif facultatif de candidatures envoyées par semaine (carte « Ma semaine »).
alter table profiles add column if not exists weekly_goal smallint;

alter table profiles drop constraint if exists profiles_weekly_goal_check;
alter table profiles add constraint profiles_weekly_goal_check
  check (weekly_goal between 1 and 50);
