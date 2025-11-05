-- Add tournament configuration fields directly to tournaments table
-- This replaces the need for localStorage and makes configs visible to all users

-- Add configuration columns to tournaments table
alter table public.tournaments 
  add column if not exists format_id text,
  add column if not exists tie_breaker_order text[] default '{head_to_head,sets_average_inner,points_average_inner,sets_average_global,points_average_global,random_draw}',
  add column if not exists include_third_place boolean default true,
  add column if not exists match_format_groups text default 'melhorDe3',
  add column if not exists match_format_quarterfinals text default 'melhorDe3',
  add column if not exists match_format_semifinals text default 'melhorDe3',
  add column if not exists match_format_final text default 'melhorDe3',
  add column if not exists match_format_third_place text default 'melhorDe3',
  add column if not exists logo_url text,
  add column if not exists sponsor_logos jsonb default '[]'::jsonb,
  add column if not exists has_statistics boolean default true;

-- Add comment to explain the columns
comment on column public.tournaments.format_id is 'Tournament format: groups_and_knockout, double_elimination, global_semis, series_gold_silver, single_elimination, 3_groups_quarterfinals';
comment on column public.tournaments.tie_breaker_order is 'Order of tie-breaking criteria for group stages';
comment on column public.tournaments.match_format_groups is 'Match format for group stage: melhorDe3 or melhorDe1';
comment on column public.tournaments.match_format_quarterfinals is 'Match format for quarterfinals: melhorDe3 or melhorDe1';
comment on column public.tournaments.match_format_semifinals is 'Match format for semifinals: melhorDe3 or melhorDe1';
comment on column public.tournaments.match_format_final is 'Match format for final: melhorDe3 or melhorDe1';
comment on column public.tournaments.match_format_third_place is 'Match format for third place match: melhorDe3 or melhorDe1';


