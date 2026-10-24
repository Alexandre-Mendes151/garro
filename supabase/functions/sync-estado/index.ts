import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return json({ error: "bad_request" }, 400);
  }

  if (body.action === "refill") {
    const { data, error } = await admin.rpc("rpc_refill", { p_user: userId }).single();
    if (error || !data) {
      return json({ error: "refill_rejected" }, 429);
    }
    return json({ coins: data.coins, wins: data.wins });
  }

  if (body.action === "round_start") {
    const { data, error } = await admin.rpc("rpc_round_start", { p_user: userId }).single();
    if (error || !data) {
      return json({ error: "round_start_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins });
  }

  if (body.action === "capture") {
    const plushId = Number(body.plushId);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 43) {
      return json({ error: "bad_plush_id" }, 400);
    }
    const { data, error } = await admin.rpc("rpc_capture", { p_user: userId, p_plush_id: plushId }).single();
    if (error || !data) {
      return json({ error: "capture_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins, plushId, count: data.count });
  }

  if (body.action === "sell") {
    const plushId = Number(body.plushId);
    const qty = Number(body.qty);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 43 || !Number.isInteger(qty) || qty < 1) {
      return json({ error: "bad_sale" }, 400);
    }
    const { data, error } = await admin.rpc("rpc_sell", { p_user: userId, p_plush_id: plushId, p_qty: qty }).single();
    if (error || !data) {
      return json({ error: "sale_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins, plushId, count: data.count });
  }

  return json({ error: "unknown_action" }, 400);
});
