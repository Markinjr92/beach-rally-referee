-- Add optional player slots for casual quartet matches.
-- Existing dupla/trio rows remain valid because the extra fields are nullable.

ALTER TABLE public.casual_matches
  ADD COLUMN IF NOT EXISTS team_a_player_3 TEXT,
  ADD COLUMN IF NOT EXISTS team_a_player_4 TEXT,
  ADD COLUMN IF NOT EXISTS team_b_player_3 TEXT,
  ADD COLUMN IF NOT EXISTS team_b_player_4 TEXT;

COMMENT ON COLUMN public.casual_matches.team_a_player_3 IS 'Jogador 3 da equipe A em jogos avulsos trio/quarteto';
COMMENT ON COLUMN public.casual_matches.team_a_player_4 IS 'Jogador 4 da equipe A em jogos avulsos quarteto';
COMMENT ON COLUMN public.casual_matches.team_b_player_3 IS 'Jogador 3 da equipe B em jogos avulsos trio/quarteto';
COMMENT ON COLUMN public.casual_matches.team_b_player_4 IS 'Jogador 4 da equipe B em jogos avulsos quarteto';
