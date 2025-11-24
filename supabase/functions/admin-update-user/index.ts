import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const updateUserSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
  email: z.string().email('Email inválido').max(255, 'Email muito longo').optional(),
  roleIds: z.array(z.string().uuid('ID de role inválido')).optional().default([]),
  isActive: z.boolean().optional(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, message: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Validate input
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Body inválido. Esperado JSON.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Recebido body:', JSON.stringify(body, null, 2));
    
    const validation = updateUserSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Erro de validação:', validation.error.errors);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          message: 'Dados inválidos', 
          errors: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, name, email, roleIds, isActive } = validation.data;
    
    // Filtrar roleIds vazios ou inválidos
    const validRoleIds = Array.isArray(roleIds) 
      ? roleIds.filter(id => id && typeof id === 'string' && id.length > 0)
      : [];
    
    console.log('Dados validados:', { userId, name, email, validRoleIds, isActive });

    // Atualizar informações do usuário (name e/ou isActive)
    if (name !== undefined || isActive !== undefined) {
      const updateData: { name?: string; is_active?: boolean } = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.is_active = isActive;

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
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
    if (roleIds !== undefined) {
      // Remover roles antigas
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Erro ao remover roles antigas:', deleteError);
        return new Response(
          JSON.stringify({ ok: false, message: 'Erro ao remover roles antigas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Adicionar novas roles
      if (validRoleIds.length > 0) {
        const userRoles = validRoleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId
        }));

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(userRoles);

        if (rolesError) {
          console.error('Erro ao inserir novas roles:', rolesError);
          return new Response(
            JSON.stringify({ ok: false, message: `Erro ao atualizar roles: ${rolesError.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      console.log('Roles atualizadas com sucesso');
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : String(error ?? 'Erro inesperado');
    return new Response(
      JSON.stringify({ ok: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
