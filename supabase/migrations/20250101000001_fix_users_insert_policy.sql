-- Fix: Permitir que usuários criem seu próprio registro na tabela users
-- Isso resolve o problema quando o trigger handle_new_user não foi executado

-- Adicionar política para permitir INSERT do próprio usuário
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Nota: Esta política permite que um usuário autenticado crie seu próprio registro
-- apenas quando o id corresponde ao auth.uid(), garantindo segurança

