-- Migration: Create casual matches tables and support structures
-- Jogos Avulsos - Sistema isolado de torneios
--
-- IMPORTANTE: Esta migração é segura e não quebra funcionalidades existentes
-- - Cria nova tabela casual_matches (isolada)
-- - Adiciona coluna id em match_states (nova PRIMARY KEY)
-- - Mantém compatibilidade com matches existentes
-- - Adiciona suporte para casual_match_id com índices únicos
--
-- APÓS EXECUTAR: Regenerar tipos do Supabase com:
-- npx supabase gen types typescript --project-id <seu-project-id> > src/integrations/supabase/types.ts

-- ============================================
-- 1. Tabela principal: casual_matches
-- ============================================
CREATE TABLE IF NOT EXISTS public.casual_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_a_name TEXT NOT NULL,
  team_a_player_1 TEXT NOT NULL,
  team_a_player_2 TEXT NOT NULL,
  team_b_name TEXT NOT NULL,
  team_b_player_1 TEXT NOT NULL,
  team_b_player_2 TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('M', 'F', 'Misto')),
  modality TEXT NOT NULL DEFAULT 'dupla' CHECK (modality IN ('dupla', 'quarteto')),
  format_preset TEXT NOT NULL, -- chave do MATCH_FORMAT_PRESETS (best3_21_15, best3_15_15, etc)
  best_of INT NOT NULL CHECK (best_of IN (1, 3)),
  points_per_set INT[] NOT NULL,
  side_switch_sum INT[] NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
  share_token UUID UNIQUE DEFAULT gen_random_uuid(),
  deleted_at TIMESTAMPTZ, -- soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para casual_matches
CREATE INDEX IF NOT EXISTS casual_matches_user_id_idx ON public.casual_matches(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS casual_matches_status_idx ON public.casual_matches(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS casual_matches_share_token_idx ON public.casual_matches(share_token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS casual_matches_created_at_idx ON public.casual_matches(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================
-- 2. Adaptar match_states para suportar casual_matches
-- ============================================
-- ESTRATÉGIA: Criar coluna id separada como PRIMARY KEY
-- Isso permite que match_id seja nullable para casual matches
-- Mantemos índices únicos para ambos para suportar onConflict

-- Adicionar coluna id como nova PRIMARY KEY (se não existir)
DO $$
BEGIN
  -- Verificar se já existe coluna id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_states' 
    AND column_name = 'id'
  ) THEN
    -- Adicionar coluna id
    ALTER TABLE public.match_states
      ADD COLUMN id UUID DEFAULT gen_random_uuid();
    
    -- Preencher id com match_id para registros existentes
    UPDATE public.match_states
      SET id = match_id
      WHERE id IS NULL;
    
    -- Tornar id NOT NULL
    ALTER TABLE public.match_states
      ALTER COLUMN id SET NOT NULL;
    
    -- Remover PRIMARY KEY antiga de match_id
    ALTER TABLE public.match_states
      DROP CONSTRAINT IF EXISTS match_states_pkey;
    
    -- Criar nova PRIMARY KEY em id
    ALTER TABLE public.match_states
      ADD CONSTRAINT match_states_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Adicionar coluna casual_match_id (nullable)
ALTER TABLE public.match_states
  ADD COLUMN IF NOT EXISTS casual_match_id UUID REFERENCES public.casual_matches(id) ON DELETE CASCADE;

-- Tornar match_id nullable (agora que temos id como PK)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'match_states' 
    AND column_name = 'match_id' 
    AND is_nullable = 'NO'
  ) THEN
    -- Remover foreign key temporariamente
    ALTER TABLE public.match_states 
      DROP CONSTRAINT IF EXISTS match_states_match_id_fkey;
    
    -- Tornar nullable
    ALTER TABLE public.match_states 
      ALTER COLUMN match_id DROP NOT NULL;
    
    -- Recriar foreign key (agora nullable)
    ALTER TABLE public.match_states
      ADD CONSTRAINT match_states_match_id_fkey 
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Criar índices únicos para suportar onConflict nos upserts
CREATE UNIQUE INDEX IF NOT EXISTS match_states_match_id_unique 
ON public.match_states (match_id) WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS match_states_casual_match_id_unique 
ON public.match_states (casual_match_id) WHERE casual_match_id IS NOT NULL;

-- Adicionar constraint: deve ter match_id OU casual_match_id, mas não ambos
ALTER TABLE public.match_states
  DROP CONSTRAINT IF EXISTS match_states_match_check;
  
ALTER TABLE public.match_states
  ADD CONSTRAINT match_states_match_check 
  CHECK (
    (match_id IS NOT NULL AND casual_match_id IS NULL) OR 
    (match_id IS NULL AND casual_match_id IS NOT NULL)
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS match_states_casual_match_id_idx 
ON public.match_states(casual_match_id) WHERE casual_match_id IS NOT NULL;

-- Nota: Agora temos:
-- - id como PRIMARY KEY (sempre presente)
-- - match_id como UNIQUE quando não null (para matches normais) - suporta onConflict: "match_id"
-- - casual_match_id como UNIQUE quando não null (para casual matches) - suporta onConflict: "casual_match_id"

-- ============================================
-- 3. Adaptar match_events para suportar casual_matches
-- ============================================
ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS casual_match_id UUID REFERENCES public.casual_matches(id) ON DELETE CASCADE;

-- Modificar constraint para permitir match_id null
ALTER TABLE public.match_events
  DROP CONSTRAINT IF EXISTS match_events_match_id_fkey;

-- Recriar foreign key como nullable
ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_match_id_fkey 
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Adicionar constraint: deve ter match_id OU casual_match_id
ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_match_check 
  CHECK (
    (match_id IS NOT NULL AND casual_match_id IS NULL) OR 
    (match_id IS NULL AND casual_match_id IS NOT NULL)
  );

-- Índices para match_events com casual_match_id
CREATE INDEX IF NOT EXISTS match_events_casual_match_id_idx ON public.match_events(casual_match_id, created_at DESC) WHERE casual_match_id IS NOT NULL;

-- ============================================
-- 4. Adaptar match_timeouts para suportar casual_matches
-- ============================================
ALTER TABLE public.match_timeouts
  ADD COLUMN IF NOT EXISTS casual_match_id UUID REFERENCES public.casual_matches(id) ON DELETE CASCADE;

-- Modificar constraint para permitir match_id null
ALTER TABLE public.match_timeouts
  DROP CONSTRAINT IF EXISTS match_timeouts_match_id_fkey;

-- Recriar foreign key como nullable
ALTER TABLE public.match_timeouts
  ADD CONSTRAINT match_timeouts_match_id_fkey 
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Adicionar constraint: deve ter match_id OU casual_match_id
ALTER TABLE public.match_timeouts
  ADD CONSTRAINT match_timeouts_match_check 
  CHECK (
    (match_id IS NOT NULL AND casual_match_id IS NULL) OR 
    (match_id IS NULL AND casual_match_id IS NOT NULL)
  );

-- Índices para match_timeouts com casual_match_id
CREATE INDEX IF NOT EXISTS match_timeouts_casual_match_id_idx ON public.match_timeouts(casual_match_id) WHERE casual_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS match_timeouts_casual_active_idx ON public.match_timeouts(casual_match_id) WHERE ended_at IS NULL AND casual_match_id IS NOT NULL;

-- ============================================
-- 5. Trigger para updated_at em casual_matches
-- ============================================
CREATE OR REPLACE FUNCTION public.set_casual_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_casual_matches_updated_at ON public.casual_matches;

CREATE TRIGGER set_casual_matches_updated_at
BEFORE UPDATE ON public.casual_matches
FOR EACH ROW
EXECUTE PROCEDURE public.set_casual_matches_updated_at();

-- ============================================
-- 6. RLS Policies para casual_matches
-- ============================================
ALTER TABLE public.casual_matches ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios jogos (não deletados)
DROP POLICY IF EXISTS "users can view own casual matches" ON public.casual_matches;
CREATE POLICY "users can view own casual matches" ON public.casual_matches
  FOR SELECT 
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Usuários podem criar seus próprios jogos
DROP POLICY IF EXISTS "users can create own casual matches" ON public.casual_matches;
CREATE POLICY "users can create own casual matches" ON public.casual_matches
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios jogos (não deletados)
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;
CREATE POLICY "users can update own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL);

-- Soft delete: usuários podem "deletar" seus próprios jogos
-- (atualizando deleted_at)
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;
CREATE POLICY "users can delete own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Visualização pública via share_token (read-only)
DROP POLICY IF EXISTS "public can view shared casual matches" ON public.casual_matches;
CREATE POLICY "public can view shared casual matches" ON public.casual_matches
  FOR SELECT 
  USING (
    share_token IS NOT NULL 
    AND deleted_at IS NULL
    -- Token será validado na aplicação, não aqui
  );

-- ============================================
-- 7. RLS Policies para match_states (casual)
-- ============================================
-- Usuários podem ver match_states de seus casual_matches
DROP POLICY IF EXISTS "users can view own casual match states" ON public.match_states;
CREATE POLICY "users can view own casual match states" ON public.match_states
  FOR SELECT 
  USING (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Usuários podem gerenciar match_states de seus casual_matches
DROP POLICY IF EXISTS "users can manage own casual match states" ON public.match_states;
CREATE POLICY "users can manage own casual match states" ON public.match_states
  FOR ALL 
  USING (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================
-- 8. RLS Policies para match_events (casual)
-- ============================================
-- Usuários podem ver match_events de seus casual_matches
DROP POLICY IF EXISTS "users can view own casual match events" ON public.match_events;
CREATE POLICY "users can view own casual match events" ON public.match_events
  FOR SELECT 
  USING (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Usuários podem criar match_events de seus casual_matches
DROP POLICY IF EXISTS "users can create own casual match events" ON public.match_events;
CREATE POLICY "users can create own casual match events" ON public.match_events
  FOR INSERT 
  WITH CHECK (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================
-- 9. RLS Policies para match_timeouts (casual)
-- ============================================
-- Usuários podem ver match_timeouts de seus casual_matches
DROP POLICY IF EXISTS "users can view own casual match timeouts" ON public.match_timeouts;
CREATE POLICY "users can view own casual match timeouts" ON public.match_timeouts
  FOR SELECT 
  USING (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Usuários podem gerenciar match_timeouts de seus casual_matches
DROP POLICY IF EXISTS "users can manage own casual match timeouts" ON public.match_timeouts;
CREATE POLICY "users can manage own casual match timeouts" ON public.match_timeouts
  FOR ALL 
  USING (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    casual_match_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.casual_matches 
      WHERE id = casual_match_id 
      AND user_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================
-- 10. Comentários para documentação
-- ============================================
COMMENT ON TABLE public.casual_matches IS 'Jogos avulsos criados por usuários, isolados de torneios';
COMMENT ON COLUMN public.casual_matches.deleted_at IS 'Soft delete: quando preenchido, o jogo está deletado';
COMMENT ON COLUMN public.casual_matches.share_token IS 'Token único para compartilhamento de resultados';
COMMENT ON COLUMN public.match_states.id IS 'Nova PRIMARY KEY (substitui match_id como PK para suportar casual matches)';
COMMENT ON COLUMN public.match_states.casual_match_id IS 'Referência opcional para jogos avulsos (mutuamente exclusivo com match_id)';
COMMENT ON COLUMN public.match_events.casual_match_id IS 'Referência opcional para jogos avulsos (mutuamente exclusivo com match_id)';
COMMENT ON COLUMN public.match_timeouts.casual_match_id IS 'Referência opcional para jogos avulsos (mutuamente exclusivo com match_id)';

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Esta migração é SEGURA e não quebra funcionalidades existentes
-- 2. A coluna id em match_states é criada e preenchida automaticamente
-- 3. Os índices únicos permitem usar onConflict tanto para match_id quanto casual_match_id
-- 4. Matches existentes continuam funcionando normalmente
-- 5. APÓS EXECUTAR: Regenerar tipos TypeScript do Supabase:
--    npx supabase gen types typescript --project-id <seu-project-id> > src/integrations/supabase/types.ts

