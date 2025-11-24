-- Adicionar campos CPF, telefone e access_expires_at na tabela users
-- Campos são nullable para não impactar usuários existentes

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP WITH TIME ZONE;

-- Comentários
COMMENT ON COLUMN public.users.cpf IS 'CPF do usuário (obrigatório para novos cadastros)';
COMMENT ON COLUMN public.users.phone IS 'Telefone do usuário (obrigatório para novos cadastros)';
COMMENT ON COLUMN public.users.access_expires_at IS 'Data de expiração do acesso. NULL = acesso vitalício. Novos usuários têm 15 dias.';

-- Atualizar trigger handle_new_user para:
-- 1. Definir access_expires_at como NOW() + 15 dias para novos usuários
-- 2. Atribuir role 'atleta' aos novos usuários (que dá acesso a: Informações de torneio, jogos ao vivo, e Jogos Avulsos)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_role_id UUID;
  athlete_role_id UUID;
  cpf_value TEXT;
  phone_value TEXT;
BEGIN
  -- Extrair CPF e telefone dos metadados do usuário
  cpf_value := NEW.raw_user_meta_data->>'cpf';
  phone_value := NEW.raw_user_meta_data->>'phone';
  
  -- Insert user into public.users
  -- Usar ON CONFLICT para lidar com usuários que já existem (criados antes desta migration)
  -- Se o usuário já existe, manter access_expires_at como NULL (acesso vitalício)
  -- Se é um novo usuário, definir access_expires_at como NOW() + 15 dias
  INSERT INTO public.users (id, name, email, cpf, phone, access_expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    cpf_value,
    phone_value,
    -- Para novos usuários, definir 15 dias a partir de agora
    NOW() + INTERVAL '15 days'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    cpf = COALESCE(EXCLUDED.cpf, users.cpf),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    -- Não atualizar access_expires_at se já existir (preserva acesso vitalício dos usuários antigos)
    access_expires_at = COALESCE(users.access_expires_at, EXCLUDED.access_expires_at);
  
  -- Buscar role 'atleta' para novos usuários
  SELECT id INTO athlete_role_id FROM public.roles WHERE name = 'atleta';
  
  -- Atribuir role 'atleta' apenas se o usuário não tiver nenhuma role ainda
  -- Isso garante que usuários existentes não percam suas roles
  IF athlete_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, athlete_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para verificar se o acesso do usuário está expirado
CREATE OR REPLACE FUNCTION public.is_user_access_expired(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Se access_expires_at é NULL, acesso é vitalício (não expirado)
      WHEN access_expires_at IS NULL THEN FALSE
      -- Se access_expires_at é menor que NOW(), acesso expirou
      WHEN access_expires_at < NOW() THEN TRUE
      -- Caso contrário, acesso ainda válido
      ELSE FALSE
    END
  FROM public.users
  WHERE id = user_uuid;
$$;

-- Índice para melhorar performance na verificação de acesso expirado
CREATE INDEX IF NOT EXISTS idx_users_access_expires_at ON public.users(access_expires_at) 
WHERE access_expires_at IS NOT NULL;

