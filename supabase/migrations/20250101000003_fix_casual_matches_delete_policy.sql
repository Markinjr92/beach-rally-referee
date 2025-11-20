-- Fix: Ajustar política de exclusão (soft delete) para casual_matches
-- O problema é que a política "users can update own casual matches" exige deleted_at IS NULL no WITH CHECK
-- Mas quando fazemos soft delete, estamos definindo deleted_at, então precisa de políticas separadas

-- Primeiro, ajustar política de update para updates normais (sem soft delete)
DROP POLICY IF EXISTS "users can update own casual matches" ON public.casual_matches;
CREATE POLICY "users can update own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Updates normais não podem definir deleted_at
  );

-- Criar política específica para soft delete que permite definir deleted_at
DROP POLICY IF EXISTS "users can delete own casual matches" ON public.casual_matches;
CREATE POLICY "users can delete own casual matches" ON public.casual_matches
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL  -- Só pode fazer soft delete se ainda não estiver deletado
  )
  WITH CHECK (
    auth.uid() = user_id 
    -- deleted_at pode ser definido (não verificamos aqui para permitir soft delete)
    -- Mas garantimos que o usuário é o dono
  );

