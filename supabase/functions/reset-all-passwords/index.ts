import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordsRequest {
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the service role key for admin operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get current user to verify admin permissions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create regular client to verify user permissions
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user has admin permissions
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has permission to manage users
    const { data: hasPermission, error: permError } = await supabaseUser.rpc('user_has_permission', {
      user_uuid: user.id,
      permission_name: 'user.manage'
    });

    if (permError || !hasPermission) {
      console.error('Permission check failed:', permError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { newPassword = 'admin' }: ResetPasswordsRequest = await req.json();

    // Get all users from auth.users
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    const errors = [];

    // Reset password for each user
    for (const authUser of users.users) {
      try {
        console.log(`Resetting password for user: ${authUser.email}`);
        
        // Update user password using admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id, 
          { password: newPassword }
        );

        if (updateError) {
          console.error(`Failed to reset password for ${authUser.email}:`, updateError);
          errors.push({ email: authUser.email, error: updateError.message });
        } else {
          // Log the password reset
          const { error: logError } = await supabaseAdmin.from('password_resets').insert({
            user_id: authUser.id,
            reset_by: user.id,
            reason: 'Bulk admin password reset'
          });

          if (logError) {
            console.error(`Failed to log password reset for ${authUser.email}:`, logError);
          }

          results.push({ email: authUser.email, success: true });
          console.log(`Successfully reset password for: ${authUser.email}`);
        }
      } catch (error) {
        console.error(`Unexpected error resetting password for ${authUser.email}:`, error);
        errors.push({ email: authUser.email, error: error.message });
      }
    }

    console.log(`Password reset completed. Success: ${results.length}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      message: `Password reset completed for ${results.length} users`,
      successful: results,
      failed: errors,
      totalProcessed: users.users.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in reset-all-passwords function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);