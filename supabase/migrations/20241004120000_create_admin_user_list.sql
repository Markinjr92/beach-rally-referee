create or replace function public.get_admin_user_list()
returns table (
  user_id uuid,
  email text,
  name text,
  roles text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.email,
    coalesce(u.name, u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name') as name,
    coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as roles
  from public.users u
  left join public.user_roles ur on ur.user_id = u.id
  left join public.roles r on r.id = ur.role_id
  group by u.id, u.email, name
  order by lower(u.email);
$$;

grant execute on function public.get_admin_user_list() to authenticated;
