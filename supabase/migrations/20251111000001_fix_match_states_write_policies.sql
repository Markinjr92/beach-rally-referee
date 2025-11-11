-- Allow authenticated users and admins to write to match_states
-- This fixes the issue where spectator view tries to create default states

-- Allow authenticated users to insert/update match_states
drop policy if exists "authenticated can insert match_states" on public.match_states;
create policy "authenticated can insert match_states" on public.match_states
  for insert with check (auth.uid() is not null);

drop policy if exists "authenticated can update match_states" on public.match_states;
create policy "authenticated can update match_states" on public.match_states
  for update using (auth.uid() is not null);

-- Allow authenticated users to insert/update match_events
drop policy if exists "authenticated can insert match_events" on public.match_events;
create policy "authenticated can insert match_events" on public.match_events
  for insert with check (auth.uid() is not null);

drop policy if exists "authenticated can update match_events" on public.match_events;
create policy "authenticated can update match_events" on public.match_events
  for update using (auth.uid() is not null);

-- Allow authenticated users to insert/update match_timeouts
drop policy if exists "authenticated can insert match_timeouts" on public.match_timeouts;
create policy "authenticated can insert match_timeouts" on public.match_timeouts
  for insert with check (auth.uid() is not null);

drop policy if exists "authenticated can update match_timeouts" on public.match_timeouts;
create policy "authenticated can update match_timeouts" on public.match_timeouts
  for update using (auth.uid() is not null);

