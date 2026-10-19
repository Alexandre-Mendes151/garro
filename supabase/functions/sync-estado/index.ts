import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400 });
  }

  if (body.action === "refill") {
    const { data, error } = await admin.rpc("rpc_refill", { p_user: userId }).single();
    if (error || !data) {
      return new Response(JSON.stringify({ error: "refill_rejected" }), { status: 429 });
    }
    return new Response(JSON.stringify({ coins: data.coins, wins: data.wins }));
  }

  if (body.action === "round_start") {
    const { data, error } = await admin.rpc("rpc_round_start", { p_user: userId }).single();
    if (error || !data) {
      return new Response(JSON.stringify({ error: "round_start_rejected" }), { status: 400 });
    }
    return new Response(JSON.stringify({ coins: data.coins, wins: data.wins }));
  }

  if (body.action === "capture") {
    const plushId = Number(body.plushId);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 20) {
      return new Response(JSON.stringify({ error: "bad_plush_id" }), { status: 400 });
    }
    const { data, error } = await admin.rpc("rpc_capture", { p_user: userId, p_plush_id: plushId }).single();
    if (error || !data) {
      return new Response(JSON.stringify({ error: "capture_rejected" }), { status: 400 });
    }
    return new Response(JSON.stringify({ coins: data.coins, wins: data.wins, plushId, count: data.count }));
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
});
