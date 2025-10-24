import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

type AdminAction = 'list' | 'search' | 'update' | 'reset_password';

type AdminUserManagementRequest = {
  action: AdminAction;
  query?: string;
  userId?: string;
  updates?: {
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  newPassword?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

const respond = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!serviceRoleKey || !supabaseUrl || !anonKey) {
      console.error('Missing Supabase environment variables');
      return respond(500, { error: 'Server configuration error' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return respond(401, { error: 'Authorization required' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      console.error('User verification failed', userError);
      return respond(401, { error: 'Invalid authentication' });
    }

    const adminUser = userData.user;

    const { data: permission, error: permError } = await supabaseUser.rpc('user_has_permission', {
      user_uuid: adminUser.id,
      permission_name: 'user.manage',
    });

    if (permError || !permission) {
      console.error('Permission denied', permError);
      return respond(403, { error: 'Insufficient permissions' });
    }

    const requestData = (await req.json()) as AdminUserManagementRequest;

    if (!requestData?.action) {
      return respond(400, { error: 'Missing action' });
    }

    switch (requestData.action) {
      case 'list':
      case 'search': {
        const { data: usersResponse, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

        if (usersError) {
          console.error('Error listing users', usersError);
          return respond(500, { error: 'Failed to list users' });
        }

        let users = usersResponse?.users ?? [];
        if (requestData.action === 'search' && requestData.query) {
          const query = requestData.query.toLowerCase();
          users = users.filter((user) => {
            const email = user.email?.toLowerCase() ?? '';
            const name =
              (user.user_metadata?.name as string | undefined)?.toLowerCase() ??
              (user.user_metadata?.full_name as string | undefined)?.toLowerCase() ??
              '';
            return email.includes(query) || name.includes(query);
          });
        }

        return respond(200, { users });
      }
      case 'update': {
        if (!requestData.userId || !requestData.updates) {
          return respond(400, { error: 'Missing userId or updates' });
        }

        const updates: Record<string, unknown> = {};
        if (requestData.updates.email) {
          updates.email = requestData.updates.email;
        }
        if (requestData.updates.user_metadata) {
          updates.user_metadata = requestData.updates.user_metadata;
        }

        if (Object.keys(updates).length === 0) {
          return respond(400, { error: 'No valid fields to update' });
        }

        const { data: updateResponse, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          requestData.userId,
          updates,
        );

        if (updateError || !updateResponse?.user) {
          console.error('Error updating user', updateError);
          return respond(500, { error: updateError?.message ?? 'Failed to update user' });
        }

        return respond(200, { user: updateResponse.user });
      }
      case 'reset_password': {
        if (!requestData.userId || !requestData.newPassword) {
          return respond(400, { error: 'Missing userId or newPassword' });
        }

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(requestData.userId, {
          password: requestData.newPassword,
        });

        if (resetError) {
          console.error('Error resetting password', resetError);
          return respond(500, { error: resetError.message });
        }

        await supabaseAdmin.from('password_resets').insert({
          user_id: requestData.userId,
          reset_by: adminUser.id,
          reason: 'Admin password reset',
        });

        return respond(200, { success: true });
      }
      default:
        return respond(400, { error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Unexpected error in admin-user-management function', error);
    return respond(500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
});
