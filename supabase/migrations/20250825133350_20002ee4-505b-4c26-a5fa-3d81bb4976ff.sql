-- Create RBAC schema for volleyball system

-- Users table (extends auth.users with additional info)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles junction table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Role permissions junction table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- User tokens for refresh tokens
CREATE TABLE public.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid UUID)
RETURNS TEXT[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(r.name)
  FROM public.roles r
  JOIN public.user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = user_uuid;
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TEXT[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(DISTINCT p.name)
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.user_roles ur ON rp.role_id = ur.role_id
  WHERE ur.user_id = user_uuid;
$$;

-- Create function to check user permission
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = user_uuid AND p.name = permission_name
  );
$$;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all users" ON public.users
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can manage all users" ON public.users
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

-- RLS Policies for roles table (admin only)
CREATE POLICY "Admin can manage roles" ON public.roles
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

CREATE POLICY "Users can view roles" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for permissions table (admin only)
CREATE POLICY "Admin can manage permissions" ON public.permissions
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

CREATE POLICY "Users can view permissions" ON public.permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for user_roles table
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage user roles" ON public.user_roles
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

-- RLS Policies for role_permissions table
CREATE POLICY "Users can view role permissions" ON public.role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage role permissions" ON public.role_permissions
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'user.manage')
  );

-- RLS Policies for user_tokens table
CREATE POLICY "Users can manage own tokens" ON public.user_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('admin_sistema', 'Controle total do sistema'),
  ('organizador', 'Gerencia torneios e equipes'),
  ('arbitro', 'Controla mesa de arbitragem'),
  ('atleta', 'Visualiza jogos e estatísticas'),
  ('publico', 'Acesso público apenas');

-- Insert permissions
INSERT INTO public.permissions (name, description) VALUES
  ('user.manage', 'Gerenciar usuários e roles'),
  ('tournament.manage', 'CRUD torneios, formatos, participantes'),
  ('tournament.configure', 'Configuração de sets/formatos por fase'),
  ('team.manage', 'CRUD equipes e vínculo com torneios'),
  ('match.schedule', 'Agendar/editar jogos'),
  ('match.officiate', 'Mesa: iniciar/encerrar, placar, timeouts'),
  ('stats.view', 'Estatísticas detalhadas'),
  ('public.view', 'Páginas públicas, placares');

-- Create role-permission mappings
WITH role_perms AS (
  SELECT 
    r.id as role_id,
    p.id as permission_id
  FROM public.roles r, public.permissions p
  WHERE 
    -- admin_sistema gets all permissions
    (r.name = 'admin_sistema') OR
    -- organizador permissions
    (r.name = 'organizador' AND p.name IN ('tournament.manage', 'tournament.configure', 'team.manage', 'match.schedule', 'stats.view', 'public.view')) OR
    -- arbitro permissions
    (r.name = 'arbitro' AND p.name IN ('match.officiate', 'stats.view', 'public.view')) OR
    -- atleta permissions
    (r.name = 'atleta' AND p.name IN ('stats.view', 'public.view')) OR
    -- publico permissions
    (r.name = 'publico' AND p.name IN ('public.view'))
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM role_perms;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Insert user into public.users
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  
  -- Assign default 'publico' role
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'publico';
  
  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, default_role_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed users with hashed password (Passw0rd!)
DO $$
DECLARE
  admin_user_id UUID;
  org_user_id UUID;
  ref_user_id UUID;
  athlete_user_id UUID;
  public_user_id UUID;
  admin_role_id UUID;
  org_role_id UUID;
  ref_role_id UUID;
  athlete_role_id UUID;
  public_role_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin_sistema';
  SELECT id INTO org_role_id FROM public.roles WHERE name = 'organizador';
  SELECT id INTO ref_role_id FROM public.roles WHERE name = 'arbitro';
  SELECT id INTO athlete_role_id FROM public.roles WHERE name = 'atleta';
  SELECT id INTO public_role_id FROM public.roles WHERE name = 'publico';

  -- Note: In production, users would be created through auth.users table
  -- This is just for reference of the user structure
END $$;