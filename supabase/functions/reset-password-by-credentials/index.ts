import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
  phone: z.string().min(10, 'Telefone deve conter pelo menos 10 dígitos'),
  newPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72, 'Senha muito longa'),
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    
    const validation = resetPasswordSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          message: 'Dados inválidos', 
          errors: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, cpf, phone, newPassword } = validation.data;

    // Buscar usuário por email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, cpf, phone')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Email não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar CPF
    if (userData.cpf !== cpf) {
      return new Response(
        JSON.stringify({ ok: false, message: 'CPF não confere com o cadastro' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar telefone (remover formatação para comparação)
    const userPhoneNumbers = (userData.phone || '').replace(/\D/g, '');
    const providedPhoneNumbers = phone.replace(/\D/g, '');
    
    if (userPhoneNumbers !== providedPhoneNumbers) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Telefone não confere com o cadastro' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Todas as validações passaram, resetar senha
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.id,
      { password: newPassword }
    );

    if (resetError) {
      console.error('Erro ao resetar senha:', resetError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Erro ao resetar senha', details: resetError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Senha resetada com sucesso' }),
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

