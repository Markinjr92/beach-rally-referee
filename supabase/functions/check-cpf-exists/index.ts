import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const checkCpfSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
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
    
    const validation = checkCpfSchema.safeParse(body);
    
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

    const { cpf } = validation.data;

    // Buscar usuário por CPF
    const { data: userData, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('cpf', cpf)
      .single();

    if (queryError) {
      // Se não encontrou (PGRST116 = not found), CPF não existe
      if (queryError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            ok: true, 
            exists: false,
            message: 'CPF não cadastrado' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Outro erro
      console.error('Erro ao buscar CPF:', queryError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Erro ao verificar CPF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CPF encontrado
    return new Response(
      JSON.stringify({ 
        ok: true, 
        exists: true,
        email: userData.email,
        name: userData.name 
      }),
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

