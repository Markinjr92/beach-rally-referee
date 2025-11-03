import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resetPasswordSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  newPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72, 'Senha muito longa'),
});

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

    // Validate input
    const body = await req.json();
    const validation = resetPasswordSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          message: 'Dados inválidos', 
          errors: validation.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newPassword } = validation.data;

    // Resetar senha
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword, email_confirm: true }
    );

    if (resetError) {
      console.error('Erro ao resetar senha (auth):', resetError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Erro ao resetar senha', details: resetError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar reset
    const { error: logError } = await supabaseAdmin
      .from('password_resets')
      .insert({
        user_id: userId,
        reset_by: user.id,
        reason: 'Reset administrativo'
      });

    if (logError) {
      console.error('Erro ao registrar reset:', logError);
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
