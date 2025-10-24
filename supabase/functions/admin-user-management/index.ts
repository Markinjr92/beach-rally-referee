import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ListUsersResponse = {
  ok: boolean;
  users?: unknown[];
  message?: string;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "https://beach-rally-referee.vercel.app",
];

const ALLOWED_ORIGINS = (() => {
  const configuredOrigins = Deno.env.get("ADMIN_FN_ALLOWED_ORIGINS")
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins && configuredOrigins.length > 0
    ? configuredOrigins
    : DEFAULT_ALLOWED_ORIGINS;
})();

const corsHeadersBase = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
} as const;

const getCorsHeaders = (
  origin: string | null,
  accessControlRequestHeaders: string | null,
) => {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : null;

  const allowHeaders = accessControlRequestHeaders?.trim()
    ? accessControlRequestHeaders
    : corsHeadersBase["Access-Control-Allow-Headers"];

  const headers = {
    ...corsHeadersBase,
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Origin",
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
  } satisfies HeadersInit;

  return {
    headers,
    isAllowed: allowOrigin !== null || origin === null,
  };
};

const jsonResponse = (status: number, body: ListUsersResponse, headers: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const accessControlRequestHeaders = req.headers.get("access-control-request-headers");
  const { headers: corsHeaders, isAllowed } = getCorsHeaders(origin, accessControlRequestHeaders);

  if (!isAllowed) {
    return jsonResponse(403, { ok: false, message: "Origin not allowed" }, corsHeaders);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse(405, { ok: false, message: "Method not allowed" }, corsHeaders);
    }

    const authHeader = req.headers.get("authorization") ?? "";
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
    const message = error instanceof Error ? error.message : String(error ?? "Unexpected error");
    return jsonResponse(500, { ok: false, message }, corsHeaders);
  }
});
