-- Add tournament format configuration fields to tournaments table
ALTER TABLE public.tournaments
ADD COLUMN format_id TEXT,
ADD COLUMN tie_breaker_order JSONB DEFAULT '[]'::jsonb,
ADD COLUMN include_third_place BOOLEAN DEFAULT false,
ADD COLUMN match_format_groups TEXT,
ADD COLUMN match_format_quarterfinals TEXT,
ADD COLUMN match_format_semifinals TEXT,
ADD COLUMN match_format_final TEXT,
ADD COLUMN match_format_third_place TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN public.tournaments.format_id IS 'ID do formato do torneio (ex: groups_and_knockout, single_elimination)';
COMMENT ON COLUMN public.tournaments.tie_breaker_order IS 'Array com ordem dos critérios de desempate';
COMMENT ON COLUMN public.tournaments.include_third_place IS 'Flag para incluir disputa de 3º lugar';
COMMENT ON COLUMN public.tournaments.match_format_groups IS 'Formato dos jogos de grupos (ex: best_of_1, best_of_3)';
COMMENT ON COLUMN public.tournaments.match_format_quarterfinals IS 'Formato dos jogos das quartas de final';
COMMENT ON COLUMN public.tournaments.match_format_semifinals IS 'Formato dos jogos das semifinais';
COMMENT ON COLUMN public.tournaments.match_format_final IS 'Formato do jogo da final';
COMMENT ON COLUMN public.tournaments.match_format_third_place IS 'Formato do jogo da disputa de 3º lugar';