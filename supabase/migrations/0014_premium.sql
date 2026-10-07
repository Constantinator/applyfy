-- Abonnement Premium (Stripe, 8 €/mois) : actions IA illimitées.
--
-- Une ligne par utilisateur ayant ouvert un paiement, écrite uniquement par le serveur
-- (webhook Stripe et retour de Stripe Checkout, avec la clé service_role) : aucune policy
-- d'écriture, un utilisateur ne peut pas se déclarer Premium lui-même. Le statut est
-- celui de l'abonnement Stripe (active, trialing, past_due, canceled, unpaid…).

create table if not exists subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  -- Fin de la période payée ; avec cancel_at_period_end, date de fin du Premium.
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on subscriptions;
create policy "subscriptions_select_own" on subscriptions
  for select using (user_id = auth.uid());

-- Premium : abonnement en cours, y compris pendant les nouvelles tentatives de paiement
-- (past_due). Statuts alignés avec PREMIUM_STATUSES (src/lib/subscription.ts).
create or replace function is_premium(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user and status in ('active', 'trialing', 'past_due')
  );
$$;

revoke all on function is_premium(uuid) from public, anon, authenticated;

-- record_ai_usage (migration 0013) : plus de limite pour les utilisateurs Premium. Leurs
-- actions restent comptées (affichage de « Mon utilisation »).
create or replace function record_ai_usage(p_kind ai_usage_kind) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period date := (date_trunc('month', now() at time zone 'Europe/Paris'))::date;
  v_limit integer := case p_kind::text
    when 'resume_offre' then 2
    when 'adaptation_cv' then 2
    when 'cv_ameliore' then 2
    when 'affinage_cv' then 2
    when 'lettre' then 2
    when 'affinage_lettre' then 2
    else 2
  end;
  v_used integer;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '28000';
  end if;

  -- Sérialise les appels simultanés d'un même utilisateur pour un même type d'action.
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':' || p_kind::text));

  select count(*) into v_used
  from usage
  where user_id = v_user and kind = p_kind and period = v_period;

  if v_used >= v_limit and not is_premium(v_user) then
    raise exception 'Limite mensuelle atteinte' using errcode = 'P0001';
  end if;

  insert into usage (user_id, kind, period) values (v_user, p_kind, v_period);
  return v_used + 1;
end;
$$;

revoke all on function record_ai_usage(ai_usage_kind) from public, anon;
grant execute on function record_ai_usage(ai_usage_kind) to authenticated;
