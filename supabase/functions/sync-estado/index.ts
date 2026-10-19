// supabase/functions/sync-estado/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RATE_LIMIT_MS = 1500; // intervalo mínimo entre ações
const REFILL_COOLDOWN_MS = 20000; // 20s entre refills
const REFILL_AMOUNT = 15;
const ROUND_COST = 1;

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

  const { data: state, error: stateErr } = await admin
    .from("player_state")
    .select("coins, wins, last_action_at")
    .eq("user_id", userId)
    .single();
  if (stateErr || !state) {
    return new Response(JSON.stringify({ error: "state_not_found" }), { status: 404 });
  }

  const now = Date.now();
  const lastAction = state.last_action_at ? new Date(state.last_action_at).getTime() : 0;
  if (now - lastAction < RATE_LIMIT_MS) {
    return new Response(JSON.stringify({ error: "too_fast" }), { status: 429 });
  }

  if (body.action === "refill") {
    if (now - lastAction < REFILL_COOLDOWN_MS) {
      return new Response(JSON.stringify({ error: "refill_cooldown" }), { status: 429 });
    }
    const newCoins = state.coins + REFILL_AMOUNT;
    await admin
      .from("player_state")
      .update({ coins: newCoins, last_action_at: new Date().toISOString() })
      .eq("user_id", userId);
    return new Response(JSON.stringify({ coins: newCoins, wins: state.wins }));
  }

  if (body.action === "round_start") {
    if (state.coins < ROUND_COST) {
      return new Response(JSON.stringify({ error: "not_enough_coins" }), { status: 400 });
    }
    const newCoins = state.coins - ROUND_COST;
    await admin
      .from("player_state")
      .update({ coins: newCoins, last_action_at: new Date().toISOString() })
      .eq("user_id", userId);
    return new Response(JSON.stringify({ coins: newCoins, wins: state.wins }));
  }

  if (body.action === "capture") {
    const plushId = Number(body.plushId);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 20) {
      return new Response(JSON.stringify({ error: "bad_plush_id" }), { status: 400 });
    }
    const newWins = state.wins + 1;
    await admin
      .from("player_state")
      .update({ wins: newWins, last_action_at: new Date().toISOString() })
      .eq("user_id", userId);
    const { data: existing } = await admin
      .from("collection")
      .select("count")
      .eq("user_id", userId)
      .eq("plush_id", plushId)
      .maybeSingle();
    const newCount = (existing?.count ?? 0) + 1;
    await admin
      .from("collection")
      .upsert({ user_id: userId, plush_id: plushId, count: newCount });
    return new Response(JSON.stringify({ coins: state.coins, wins: newWins, plushId, count: newCount }));
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
});
