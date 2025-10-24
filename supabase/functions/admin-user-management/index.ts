import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ListUsersResponse = {
  ok: boolean;
  users?: unknown[];
  message?: string;
};

const cors = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  } satisfies HeadersInit;
};

const jsonResponse = (status: number, body: ListUsersResponse, headers: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const corsHeaders = cors(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { ok: false, message: "Unauthorized" }, corsHeaders);
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

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("Failed to validate user JWT", userError);
    return jsonResponse(401, { ok: false, message: "Unauthorized" }, corsHeaders);
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

  try {
    if (req.method === "GET") {
      const { data, error } = await serviceClient.rpc("get_admin_user_list");
      if (error) throw error;

      return jsonResponse(200, { ok: true, users: data ?? [] }, corsHeaders);
    }

    const body = await req
      .json()
      .catch(() => ({})) as { action?: string };

    if (body.action === "list-users") {
      const { data, error } = await serviceClient.rpc("get_admin_user_list");
      if (error) throw error;

      return jsonResponse(200, { ok: true, users: data ?? [] }, corsHeaders);
    }

    return jsonResponse(400, { ok: false, message: "Unknown action" }, corsHeaders);
  } catch (error) {
    console.error("admin-user-management unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { ok: false, message }, corsHeaders);
  }
});
