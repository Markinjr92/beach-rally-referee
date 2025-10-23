-- Tournaments, Teams (duplas), Matches minimal schema
-- WARNING: adjust in production as needed. RLS grants admin-only writes using existing permission function.

-- Tournaments
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  start_date date,
  end_date date,
  category text,             -- 'M' | 'F' | 'Misto'
  modality text,             -- 'dupla' | 'quarteto' (free text for now)
  status text default 'upcoming', -- 'upcoming' | 'active' | 'completed'
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Teams (duplas)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  player_a text not null,
  player_b text not null,
  created_at timestamptz default now()
);

-- Registration: teams in a tournament
create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  seed int,
  group_label text, -- e.g., 'A', 'B'
  created_at timestamptz default now(),
  unique (tournament_id, team_id)
);

-- Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_a_id uuid not null references public.teams(id) on delete restrict,
  team_b_id uuid not null references public.teams(id) on delete restrict,
  scheduled_at timestamptz,
  court text,
  phase text,
  status text default 'scheduled', -- scheduled | in_progress | completed | canceled
  best_of int default 3,
  points_per_set int[] default '{21,21,15}',
  side_switch_sum int[] default '{7,7,5}',
  modality text default 'dupla',
  created_at timestamptz default now()
);

-- Scores per set
create table if not exists public.match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number int not null,
  team_a_points int not null default 0,
  team_b_points int not null default 0,
  created_at timestamptz default now(),
  unique (match_id, set_number)
);

-- Enable RLS
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_scores enable row level security;

-- Policies: read for authenticated users
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='authenticated can read tournaments'
  ) then
    create policy "authenticated can read tournaments" on public.tournaments for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='authenticated can read teams'
  ) then
    create policy "authenticated can read teams" on public.teams for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_teams' and policyname='authenticated can read tournament_teams'
  ) then
    create policy "authenticated can read tournament_teams" on public.tournament_teams for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='authenticated can read matches'
  ) then
    create policy "authenticated can read matches" on public.matches for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='match_scores' and policyname='authenticated can read match_scores'
  ) then
    create policy "authenticated can read match_scores" on public.match_scores for select using (auth.uid() is not null);
  end if;
end $$;

-- Policies: admin can manage all
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='admin manage tournaments'
  ) then
    create policy "admin manage tournaments" on public.tournaments for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='admin manage teams'
  ) then
    create policy "admin manage teams" on public.teams for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_teams' and policyname='admin manage tournament_teams'
  ) then
    create policy "admin manage tournament_teams" on public.tournament_teams for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='admin manage matches'
  ) then
    create policy "admin manage matches" on public.matches for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='match_scores' and policyname='admin manage match_scores'
  ) then
    create policy "admin manage match_scores" on public.match_scores for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));
  end if;
end $$;

