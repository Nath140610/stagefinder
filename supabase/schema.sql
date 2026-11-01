-- Stage Finder : à exécuter une fois dans Supabase > SQL Editor.
-- Le script peut être relancé sans perdre de données.
-- Seul le serveur accède à ces tables, avec la clé secrète. Aucune donnée n'est accessible depuis le navigateur.

create table if not exists public.visits (
  flow_id uuid primary key,
  visited_at timestamptz not null
);

create table if not exists public.flows (
  id uuid primary key,
  first_seen timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  payment_viewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  referrals text[]
);

create table if not exists public.links (
  code text primary key,
  label text not null,
  visits integer not null default 0,
  created_at timestamptz not null
);

create table if not exists public.checkouts (
  session_id text primary key,
  amount_cents integer not null check (amount_cents >= 0),
  company_count integer not null check (company_count >= 0),
  mode text not null check (mode in ('test', 'live')),
  flow_id uuid,
  created_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  checked_at timestamptz
);

create table if not exists public.trackers (
  token text primary key,
  created_at timestamptz not null,
  opened_at timestamptz,
  opens integer not null default 0
);

create index if not exists visits_visited_at_idx on public.visits (visited_at);
create index if not exists checkouts_paid_at_idx on public.checkouts (paid_at) where paid_at is not null;

-- RLS activé sans aucune policy : les clés publiques ne peuvent rien lire ni écrire.
alter table public.visits enable row level security;
alter table public.flows enable row level security;
alter table public.links enable row level security;
alter table public.checkouts enable row level security;
alter table public.trackers enable row level security;

revoke all on public.visits, public.flows, public.links, public.checkouts, public.trackers from anon, authenticated;
grant select, insert, update on public.visits, public.flows, public.links, public.checkouts, public.trackers to service_role;
