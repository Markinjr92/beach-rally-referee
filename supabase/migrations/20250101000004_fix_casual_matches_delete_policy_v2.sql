-- Fix: Ajustar política de exclusão (soft delete) para casual_matches - Versão 2
-- O problema é que o WITH CHECK está bloqueando quando definimos deleted_at
-- Vamos remover a verificação de deleted_at IS NULL do WITH CHECK da política de update

-- Remover todas as políticas de UPDATE existentes
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;

-- Criar uma única política de UPDATE que permite tanto updates normais quanto soft delete
-- O USING garante que só podemos atualizar registros não deletados
-- O WITH CHECK só verifica se o usuário é o dono (permite definir deleted_at)
CREATE POLICY "users can update own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Só pode atualizar registros não deletados
  )
  WITH CHECK (
    auth.uid() = user_id 
    -- Não verificamos deleted_at aqui para permitir soft delete
    -- O USING já garante que só atualizamos registros não deletados
  );

