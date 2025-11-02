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

    const { userId, name, email, roleIds, isActive } = await req.json();

    // Atualizar informações do usuário
    if (name !== undefined) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ name, is_active: isActive })
        .eq('id', userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Erro ao atualizar usuário' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Atualizar email no auth se fornecido
    if (email !== undefined) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email }
      );

      if (emailError) {
        console.error('Erro ao atualizar email:', emailError);
      }
    }

    // Atualizar roles
    if (roleIds !== undefined && Array.isArray(roleIds)) {
      // Remover roles antigas
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Adicionar novas roles
      if (roleIds.length > 0) {
        const userRoles = roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId
        }));

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(userRoles);

        if (rolesError) {
          console.error('Erro ao atualizar roles:', rolesError);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
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
