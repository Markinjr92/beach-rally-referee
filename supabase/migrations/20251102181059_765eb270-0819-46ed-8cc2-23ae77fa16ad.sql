-- Adicionar colunas faltantes na tabela match_states se não existirem

DO $$ 
BEGIN
  -- Adicionar coluna service_orders se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_states' 
    AND column_name = 'service_orders'
  ) THEN
    ALTER TABLE public.match_states 
    ADD COLUMN service_orders JSONB DEFAULT '{"teamA": [1, 2], "teamB": [1, 2]}'::jsonb;
  END IF;

  -- Adicionar coluna next_server_index se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_states' 
    AND column_name = 'next_server_index'
  ) THEN
    ALTER TABLE public.match_states 
    ADD COLUMN next_server_index JSONB DEFAULT '{"teamA": 0, "teamB": 0}'::jsonb;
  END IF;

  -- Adicionar coluna set_configurations se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_states' 
    AND column_name = 'set_configurations'
  ) THEN
    ALTER TABLE public.match_states 
    ADD COLUMN set_configurations JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Adicionar coluna referee_id em matches se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'referee_id'
  ) THEN
    ALTER TABLE public.matches 
    ADD COLUMN referee_id UUID REFERENCES auth.users(id);
  END IF;
END $$;