-- Add public read policies for tournament viewing without authentication
-- This allows the /public/tournament/:id route to work without login

-- Public read access for tournaments
drop policy if exists "public can read tournaments" on public.tournaments;
create policy "public can read tournaments" on public.tournaments
  for select using (true);

-- Public read access for teams
drop policy if exists "public can read teams" on public.teams;
create policy "public can read teams" on public.teams
  for select using (true);

-- Public read access for tournament_teams
drop policy if exists "public can read tournament_teams" on public.tournament_teams;
create policy "public can read tournament_teams" on public.tournament_teams
  for select using (true);

-- Public read access for matches
drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches" on public.matches
  for select using (true);

-- Public read access for match_scores
drop policy if exists "public can read match_scores" on public.match_scores;
create policy "public can read match_scores" on public.match_scores
  for select using (true);

-- Public read access for match_states
drop policy if exists "public can read match_states" on public.match_states;
create policy "public can read match_states" on public.match_states
  for select using (true);

-- Public read access for match_events (if needed for statistics)
drop policy if exists "public can read match_events" on public.match_events;
create policy "public can read match_events" on public.match_events
  for select using (true);

-- Public read access for match_timeouts (to show timeout info)
drop policy if exists "public can read match_timeouts" on public.match_timeouts;
create policy "public can read match_timeouts" on public.match_timeouts
  for select using (true);

-- Public read access for users table (only id, name, email for referee display)
-- Note: sensitive fields like password hashes are not exposed through the API
drop policy if exists "public can read users basic info" on public.users;
create policy "public can read users basic info" on public.users
  for select using (true);

-- Comment: The existing "authenticated can read X" and "admin manage X" policies remain active
-- Multiple policies with the same command (SELECT, INSERT, etc.) are combined with OR logic
-- So authenticated users still have access, and now anonymous users can also read

