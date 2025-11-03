-- Fix SECURITY DEFINER functions by adding SET search_path = 'public'
-- This prevents search path injection attacks

-- 1. Update get_user_roles function
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT ARRAY_AGG(r.name)
  FROM public.roles r
  JOIN public.user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = user_uuid;
$function$;

-- 2. Update get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT ARRAY_AGG(DISTINCT p.name)
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.user_roles ur ON rp.role_id = ur.role_id
  WHERE ur.user_id = user_uuid;
$function$;

-- 3. Update user_has_permission function
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid uuid, permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = user_uuid AND p.name = permission_name
  );
$function$;

-- 4. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- 5. Update get_admin_user_list function
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS TABLE(id uuid, email text, name text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, roles text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- 6. Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(role_name text, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = coalesce(uid, auth.uid())
      and r.name = role_name
  );
$function$;