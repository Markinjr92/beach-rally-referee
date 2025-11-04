-- Add logo fields to tournaments table
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS sponsor_logos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tournaments.logo_url IS 'URL da logo do torneio';
COMMENT ON COLUMN public.tournaments.sponsor_logos IS 'Array de objetos com URLs das logos dos patrocinadores';