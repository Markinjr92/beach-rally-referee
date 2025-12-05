-- Add direct_win_format column to casual_matches table
-- This column controls whether the match uses "vai a 3 direto" format
-- When true: if both teams reach the second-to-last point tied (20x20, 14x14, 9x9, 11x11),
--            the set goes to +3 points (23, 17, 12, 14) without requiring 2-point difference
-- When false: traditional format requiring 2-point difference (default)

ALTER TABLE public.casual_matches
ADD COLUMN IF NOT EXISTS direct_win_format BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.casual_matches.direct_win_format IS 'Formato de pontuação: true = vai a 3 direto, false = vai a 2 tradicional (padrão)';

