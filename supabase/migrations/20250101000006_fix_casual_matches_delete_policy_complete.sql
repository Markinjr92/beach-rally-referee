-- Fix COMPLETO: Ajustar política de exclusão (soft delete) para casual_matches
-- O problema é que temos duas políticas de UPDATE e ambas estão sendo avaliadas
-- Quando fazemos soft delete, a política "users can update own casual matches" falha no WITH CHECK
-- porque exige deleted_at IS NULL, mas estamos definindo deleted_at
-- 
-- SOLUÇÃO: Remover a verificação de deleted_at IS NULL do WITH CHECK
-- O USING já garante que só atualizamos registros não deletados

-- Remover TODAS as políticas de UPDATE existentes
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;
DROP POLICY IF EXISTS "users can soft delete own casual matches" ON public.casual_matches;

-- Criar UMA ÚNICA política de UPDATE que permite tanto updates normais quanto soft delete
-- IMPORTANTE: Não verificamos deleted_at no WITH CHECK para permitir soft delete
CREATE POLICY "users can update own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Só pode atualizar registros não deletados (USING)
  )
  WITH CHECK (
    auth.uid() = user_id 
    -- NÃO verificamos deleted_at aqui para permitir soft delete
    -- O USING já garante que só atualizamos registros não deletados
  );

