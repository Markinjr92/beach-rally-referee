-- Permite modalidade trio em jogos avulsos
ALTER TABLE public.casual_matches
  DROP CONSTRAINT IF EXISTS casual_matches_modality_check;

ALTER TABLE public.casual_matches
  ADD CONSTRAINT casual_matches_modality_check
  CHECK (modality IN ('dupla', 'trio', 'quarteto'));
