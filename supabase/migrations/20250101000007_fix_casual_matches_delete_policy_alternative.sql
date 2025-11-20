-- Fix ALTERNATIVO: Usar DELETE real ao invés de soft delete
-- OU ajustar política para usar função PostgreSQL

-- Opção 1: Criar política que permite DELETE real
-- Primeiro, vamos verificar se há foreign keys que impedem DELETE
-- Se houver, precisamos usar CASCADE ou ajustar

-- Remover política de UPDATE atual
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;

-- Criar política para DELETE real (mais simples que soft delete)
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;
CREATE POLICY "users can delete own casual matches" ON public.casual_matches
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Só pode deletar se ainda não estiver deletado
  );

-- Manter política de UPDATE para updates normais (sem soft delete)
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

