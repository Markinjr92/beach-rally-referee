-- Fix FINAL: Ajustar política de exclusão (soft delete) para casual_matches
-- O problema é que o WITH CHECK está bloqueando quando definimos deleted_at
-- Vamos usar uma abordagem diferente: verificar se estamos apenas atualizando deleted_at

-- Remover todas as políticas de UPDATE existentes
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;

-- Política para updates normais (sem alterar deleted_at)
CREATE POLICY "users can update own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Updates normais não podem alterar deleted_at
  );

-- Política específica para soft delete (permite definir deleted_at)
-- IMPORTANTE: Esta política deve permitir que deleted_at seja definido
CREATE POLICY "users can soft delete own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Só pode fazer soft delete se ainda não estiver deletado
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND deleted_at IS NOT NULL  -- Para soft delete, deleted_at DEVE ser definido
  );

