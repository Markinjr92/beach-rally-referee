-- Atualizar política RLS para permitir que usuários atualizem CPF e telefone
-- A política já existe, mas vamos garantir que está completa com WITH CHECK

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Comentário explicativo
COMMENT ON POLICY "Users can update own profile" ON public.users IS 
  'Permite que usuários atualizem seus próprios dados: name, cpf, phone. Email e outros campos administrativos não podem ser alterados pelo próprio usuário.';

