-- Criar função para listar usuários com suas roles para o painel administrativo
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  roles TEXT[]
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.email,
    u.name,
    u.is_active,
    u.created_at,
    u.updated_at,
    COALESCE(
      ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL),
      ARRAY[]::TEXT[]
    ) as roles
  FROM public.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  LEFT JOIN public.roles r ON ur.role_id = r.id
  GROUP BY u.id, u.email, u.name, u.is_active, u.created_at, u.updated_at
  ORDER BY u.created_at DESC;
$$;