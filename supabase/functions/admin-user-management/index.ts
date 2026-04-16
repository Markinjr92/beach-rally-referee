import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ListUsersResponse = {
  ok: boolean;
  users?: unknown[];
  message?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
} as const;

const jsonResponse = (status: number, body: ListUsersResponse, headers: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

const listAdminUsers = async (serviceClient: ReturnType<typeof createClient>) => {
  const { data: users, error: usersError } = await serviceClient
    .from("users")
    .select("id, email, name, is_active, access_expires_at")
    .order("email", { ascending: true });

  if (usersError) throw usersError;

  const { data: userRoles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("user_id, roles(name)");

  if (rolesError) throw rolesError;

  const rolesByUser = new Map<string, string[]>();

  for (const row of userRoles ?? []) {
    const roleData = row.roles as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roleData) ? roleData[0]?.name : roleData?.name;
    if (!roleName) continue;

    const existing = rolesByUser.get(row.user_id) ?? [];
    if (!existing.includes(roleName)) {
      existing.push(roleName);
      rolesByUser.set(row.user_id, existing);
    }
  }

  return (users ?? []).map((user) => ({
    user_id: user.id,
    email: user.email,
    name: user.name,
    is_active: user.is_active ?? true,
    access_expires_at: user.access_expires_at,
    roles: rolesByUser.get(user.id) ?? [],
  }));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse(405, { ok: false, message: "Method not allowed" }, corsHeaders);
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return jsonResponse(401, { ok: false, message: "Unauthorized: Token não fornecido ou inválido" }, corsHeaders);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      console.error("Missing Supabase configuration variables");
      return jsonResponse(500, { ok: false, message: "Server configuration error" }, corsHeaders);
    }

    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("Failed to validate user JWT", {
        error: userError,
        hasToken: !!token,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20)
      });
      return jsonResponse(401, { 
        ok: false, 
        message: userError?.message || "Token inválido ou expirado" 
      }, corsHeaders);
    }

    const userId = userData.user.id;
    const { data: permissionData, error: permissionError } = await serviceClient.rpc(
      "user_has_permission",
      { user_uuid: userId, permission_name: "user.manage" },
    );

    const hasPermission = Boolean(permissionData);

    if (permissionError || !hasPermission) {
      console.error("Permission check failed", permissionError);
      return jsonResponse(403, { ok: false, message: "Forbidden" }, corsHeaders);
    }

    if (req.method === "GET") {
      const users = await listAdminUsers(serviceClient);
      return jsonResponse(200, { ok: true, users }, corsHeaders);
    }

    const body = await req
      .json()
      .catch(() => ({})) as { action?: string };

    if (body.action === "list-users") {
      const users = await listAdminUsers(serviceClient);
      return jsonResponse(200, { ok: true, users }, corsHeaders);
    }

    return jsonResponse(400, { ok: false, message: "Unknown action" }, corsHeaders);
  } catch (error) {
    console.error("admin-user-management unexpected error", error);
    const message = error instanceof Error ? error.message : String(error ?? "Unexpected error");
    return jsonResponse(500, { ok: false, message }, corsHeaders);
  }
});
