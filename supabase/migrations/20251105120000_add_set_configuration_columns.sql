-- Add extended configuration tracking for match states
alter table public.match_states
  add column if not exists service_orders jsonb default '{"teamA":[1,2],"teamB":[1,2]}'::jsonb;

alter table public.match_states
  add column if not exists next_server_index jsonb default '{"teamA":0,"teamB":0}'::jsonb;

alter table public.match_states
  add column if not exists set_configurations jsonb default '[]'::jsonb;
