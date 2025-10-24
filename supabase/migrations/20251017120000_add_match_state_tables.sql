-- Match state tracking for live scoreboards and referee desk
create table if not exists public.match_states (
  match_id uuid primary key references public.matches(id) on delete cascade,
  current_set int not null default 1,
  sets_won jsonb not null default '{"teamA":0,"teamB":0}',
  scores jsonb not null default '{"teamA":[0,0,0],"teamB":[0,0,0]}',
  current_server_team text not null default 'A',
  current_server_player int not null default 1,
  possession text not null default 'A',
  left_is_team_a boolean not null default true,
  timeouts_used jsonb not null default '{"teamA":[0,0,0],"teamB":[0,0,0]}',
  technical_timeout_used jsonb not null default '[false,false,false]',
  sides_switched jsonb not null default '[0,0,0]',
  active_timer jsonb,
  is_game_ended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number int,
  event_type text not null,
  team text,
  point_category text,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_id_created_at_idx on public.match_events(match_id, created_at desc);

create table if not exists public.match_timeouts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number int,
  team text,
  timeout_type text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists match_timeouts_active_idx on public.match_timeouts(match_id) where ended_at is null;

alter table public.match_states enable row level security;
alter table public.match_events enable row level security;
alter table public.match_timeouts enable row level security;

-- Policies: read for authenticated users
create policy if not exists "authenticated can read match_states" on public.match_states
  for select using (auth.uid() is not null);

create policy if not exists "authenticated can read match_events" on public.match_events
  for select using (auth.uid() is not null);

create policy if not exists "authenticated can read match_timeouts" on public.match_timeouts
  for select using (auth.uid() is not null);

-- Policies: admin manage
create policy if not exists "admin manage match_states" on public.match_states
  for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));

create policy if not exists "admin manage match_events" on public.match_events
  for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));

create policy if not exists "admin manage match_timeouts" on public.match_timeouts
  for all using (public.user_has_permission(auth.uid(), 'tournament.manage'));

-- Keep updated_at in sync
create or replace function public.set_match_states_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_match_states_updated_at
before update on public.match_states
for each row
execute procedure public.set_match_states_updated_at();
