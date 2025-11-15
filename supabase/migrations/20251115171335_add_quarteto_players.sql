-- Add player_c and player_d columns to teams table for quarteto modality support
-- These fields are nullable to maintain backward compatibility with existing dupla tournaments

ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS player_c text NULL,
ADD COLUMN IF NOT EXISTS player_d text NULL;

COMMENT ON COLUMN public.teams.player_c IS 'Jogador 3 - usado apenas para modalidade quarteto';
COMMENT ON COLUMN public.teams.player_d IS 'Jogador 4 - usado apenas para modalidade quarteto';

