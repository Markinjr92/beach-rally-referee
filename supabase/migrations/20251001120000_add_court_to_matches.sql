alter table if exists public.matches
  add column if not exists court text;
