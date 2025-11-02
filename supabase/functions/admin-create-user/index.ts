import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar permissão
    const { data: hasPermission } = await supabaseClient.rpc('user_has_permission', {
      user_uuid: user.id,
      permission_name: 'user.manage'
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Sem permissão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, name, roleIds } = await req.json();

    // Criar usuário no auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ ok: false, message: createError?.message || 'Erro ao criar usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar nome na tabela users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', newUser.user.id);

    if (updateError) {
      console.error('Erro ao atualizar nome:', updateError);
    }

    // Atribuir roles
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      const userRoles = roleIds.map(roleId => ({
        user_id: newUser.user.id,
        role_id: roleId
      }));

      const { error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .insert(userRoles);

      if (rolesError) {
        console.error('Erro ao atribuir roles:', rolesError);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, userId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ ok: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
