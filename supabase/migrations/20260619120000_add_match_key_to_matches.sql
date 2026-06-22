-- Chave estável do confronto no bracket (ex.: QF1, SF2, REP1)
alter table public.matches
  add column if not exists match_key text;

create unique index if not exists matches_tournament_match_key_unique
  on public.matches (tournament_id, match_key)
  where match_key is not null;

comment on column public.matches.match_key is
  'Identificador estável do slot no bracket (QF1, SF2, etc.) para geração automática de confrontos';
