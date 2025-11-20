-- Fix: Tornar match_id nullable em match_events e match_timeouts
-- Isso permite que casual matches usem casual_match_id em vez de match_id

-- ============================================
-- 1. Tornar match_id nullable em match_events
-- ============================================
DO $$ 
BEGIN
  -- Verificar se match_id já é nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_events' 
    AND column_name = 'match_id' 
    AND is_nullable = 'NO'
  ) THEN
    -- Remover foreign key temporariamente
    ALTER TABLE public.match_events 
      DROP CONSTRAINT IF EXISTS match_events_match_id_fkey;
    
    -- Tornar nullable
    ALTER TABLE public.match_events 
      ALTER COLUMN match_id DROP NOT NULL;
    
    -- Recriar foreign key (agora nullable)
    ALTER TABLE public.match_events
      ADD CONSTRAINT match_events_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 2. Tornar match_id nullable em match_timeouts
-- ============================================
DO $$ 
BEGIN
  -- Verificar se match_id já é nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_timeouts' 
    AND column_name = 'match_id' 
    AND is_nullable = 'NO'
  ) THEN
    -- Remover foreign key temporariamente
    ALTER TABLE public.match_timeouts 
      DROP CONSTRAINT IF EXISTS match_timeouts_match_id_fkey;
    
    -- Tornar nullable
    ALTER TABLE public.match_timeouts 
      ALTER COLUMN match_id DROP NOT NULL;
    
    -- Recriar foreign key (agora nullable)
    ALTER TABLE public.match_timeouts
      ADD CONSTRAINT match_timeouts_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;
  END IF;
END $$;

