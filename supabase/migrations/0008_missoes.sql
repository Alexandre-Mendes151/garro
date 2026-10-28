-- 0008 — missões: percurso (trilha fixa) e diárias.
-- Só ESTADO no banco: quantas vezes o jogador fez cada coisa (no total e no dia) e quais prêmios já pegou.
-- A lista de missões (texto, meta, prêmio) é conteúdo do jogo e fica em data/missoes.json; a sync-estado lê esse
-- arquivo e passa meta e prêmio para rpc_mission_claim, que confere o progresso antes de pagar.

create table if not exists public.mission_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{2,24}$'),
  total integer not null default 0 check (total >= 0),
  day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  day_count integer not null default 0 check (day_count >= 0),
  primary key (user_id, kind)
);
create table if not exists public.mission_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission text not null check (mission ~ '^[a-z0-9_]{2,40}$'),
  day date not null default '1970-01-01',  -- percurso usa 1970-01-01; diária usa o dia (horário de Brasília)
  reward integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mission, day)
);
alter table public.mission_counters enable row level security;
alter table public.mission_claims enable row level security;
create policy "mission_counters: leitura própria" on public.mission_counters for select using (auth.uid() = user_id);
create policy "mission_claims: leitura própria" on public.mission_claims for select using (auth.uid() = user_id);
grant select on public.mission_counters, public.mission_claims to authenticated;

create or replace function public.g_today() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- soma n ao contador (total e do dia; o do dia zera quando o dia muda)
create or replace function public.g_count(p_user uuid, p_kind text, p_n integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.mission_counters (user_id, kind, total, day, day_count) values (p_user, p_kind, p_n, public.g_today(), p_n)
  on conflict (user_id, kind) do update set
    total = mission_counters.total + p_n,
    day_count = case when mission_counters.day = public.g_today() then mission_counters.day_count + p_n else p_n end,
    day = public.g_today();
end; $$;

-- quanto o jogador já tem para uma meta
-- tipos de contagem: capture, feed, pet, play, battle_win, stone, giant_play, giant_capture, giant_evolve
-- tipos calculados: distinct (pelúcias diferentes na coleção), level_big (maior nível entre os 20 grandes)
create or replace function public.g_progress(p_user uuid, p_kind text, p_daily boolean)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v integer;
begin
  if p_kind = 'distinct' then select count(*) into v from public.collection where user_id = p_user and count > 0; return coalesce(v,0); end if;
  if p_kind = 'level_big' then
    select coalesce(max(least(100, 1 + pc.xp / 4)),0) into v from public.plush_care pc
      join public.collection c on c.user_id = pc.user_id and c.plush_id = pc.plush_id and c.count > 0
      where pc.user_id = p_user and pc.plush_id < 20;
    return coalesce(v,0);
  end if;
  if p_daily then select case when day = public.g_today() then day_count else 0 end into v from public.mission_counters where user_id = p_user and kind = p_kind;
  else select total into v from public.mission_counters where user_id = p_user and kind = p_kind;
    if p_kind = 'capture' then v := greatest(coalesce(v,0), (select coalesce(sum(count),0) from public.collection where user_id = p_user)); end if;
  end if;
  return coalesce(v,0);
end; $$;

-- pegar o prêmio: confere etapa anterior (percurso), progresso e se já pegou; paga uma vez só
create or replace function public.rpc_mission_claim(p_user uuid, p_mission text, p_daily boolean, p_kind text, p_target integer, p_reward integer, p_prev text)
returns table(coins integer, reward integer) language plpgsql security definer set search_path = public as $$
declare d date; c integer;
begin
  if p_target < 1 or p_reward < 1 or p_reward > 100 then raise exception 'missao_invalida'; end if;
  d := case when p_daily then public.g_today() else date '1970-01-01' end;
  if not p_daily and p_prev is not null then
    perform 1 from public.mission_claims where user_id = p_user and mission = p_prev and day = date '1970-01-01';
    if not found then raise exception 'etapa_anterior'; end if;
  end if;
  if public.g_progress(p_user, p_kind, p_daily) < p_target then raise exception 'meta_nao_cumprida'; end if;
  insert into public.mission_claims (user_id, mission, day, reward) values (p_user, p_mission, d, p_reward)
  on conflict do nothing;
  if not found then raise exception 'ja_pegou'; end if;
  update public.player_state set coins = player_state.coins + p_reward where user_id = p_user returning player_state.coins into c;
  return query select c, p_reward;
end; $$;

-- as ações da 0007 passam a somar nos contadores das missões (mesmo corpo, só com a linha do contador)
create or replace function public.rpc_capture(p_user uuid, p_plush_id integer)
returns table(coins integer, wins integer, count integer)
language plpgsql security definer set search_path = public as $$
declare updated_coins integer; updated_wins integer; updated_count integer;
begin
  if p_plush_id < 0 or p_plush_id >= 43 then raise exception 'bad_plush_id'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_round = false, last_action_at = now()
  where user_id = p_user and pending_round = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;
  if not found then raise exception 'capture_rejected'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_plush_id, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1
  returning collection.count into updated_count;
  if updated_count > 1 then perform public.g_xp_add(p_user, p_plush_id, case when p_plush_id < 20 then 20 else 5 end); end if;
  perform public.g_count(p_user,'capture',1);
  return query select updated_coins, updated_wins, updated_count;
end; $$;

create or replace function public.rpc_giant_capture(p_user uuid, p_plush integer)
returns table(coins integer, wins integer, count integer, giants integer, xp integer)
language plpgsql security definer set search_path = public as $$
declare c integer; w integer; n integer; g integer; x integer;
begin
  if p_plush < 0 or p_plush >= 20 then raise exception 'bad_plush_id'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_giant = false, last_action_at = now()
  where user_id = p_user and pending_giant = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'  -- mesma regra anti-abuso da captura normal
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_capture_rejected'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1 returning collection.count into n;
  insert into public.giants (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = giants.count + 1 returning giants.count into g;
  x := public.g_xp_add(p_user, p_plush, 60);
  perform public.g_count(p_user,'capture',1);
  perform public.g_count(p_user,'giant_capture',1);
  return query select c, w, n, g, x;
end; $$;

create or replace function public.rpc_giant_round_start(p_user uuid)
returns table(coins integer, wins integer) language plpgsql security definer set search_path = public as $$
declare c integer; w integer;
begin
  update public.player_state set coins = player_state.coins - 50, pending_giant = true, last_action_at = now()
  where user_id = p_user and player_state.coins >= 50
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_round_rejected'; end if;
  perform public.g_count(p_user,'giant_play',1);
  return query select c, w;
end; $$;

create or replace function public.rpc_giant_evolve(p_user uuid, p_plush integer, p_stone integer)
returns table(stones integer) language plpgsql security definer set search_path = public as $$
declare q integer;
begin
  if p_stone < 0 or p_stone > 7 then raise exception 'pedra_invalida'; end if;
  perform 1 from public.giants where user_id = p_user and plush_id = p_plush and count >= 1 and not evolved;
  if not found then raise exception 'sem_gigante'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -5);
  update public.giants set evolved = true where user_id = p_user and plush_id = p_plush;
  perform public.g_count(p_user,'giant_evolve',1);
  return query select q;
end; $$;

create or replace function public.rpc_buy(p_user uuid, p_item text)
returns table(coins integer, item text, qty integer)
language plpgsql security definer set search_path = public as $$
declare c integer; q integer;
begin
  if p_item = 'food' then c := public.g_spend(p_user, 5);
  elsif p_item ~ '^stone_[0-7]$' then c := public.g_spend(p_user, 400);
  else raise exception 'item_invalido'; end if;
  q := public.g_item_add(p_user, p_item, 1);
  if p_item like 'stone_%' then perform public.g_count(p_user,'stone',1); end if;
  return query select c, p_item, q;
end; $$;

create or replace function public.rpc_use_stone(p_user uuid, p_plush integer, p_stone integer)
returns table(stones integer, xp integer) language plpgsql security definer set search_path = public as $$
declare q integer; x integer;
begin
  if p_plush < 0 or p_plush >= 20 or p_stone < 0 or p_stone > 7 then raise exception 'bad_request'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -1);
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 196)
  on conflict (user_id, plush_id) do update set xp = greatest(plush_care.xp, 196), updated_at = now() returning plush_care.xp into x;
  perform public.g_count(p_user,'stone',1);
  return query select q, x;
end; $$;

create or replace function public.rpc_care(p_user uuid, p_plush integer, p_kind text, p_f real, p_l real, p_p real)
returns table(xp integer, food integer) language plpgsql security definer set search_path = public as $$
declare x integer; fd integer; gain integer;
begin
  if p_plush < 0 or p_plush >= 43 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  update public.player_state set care_at = now() where user_id = p_user and (care_at is null or now() - care_at > interval '0.8 seconds');
  if not found then raise exception 'rapido_demais'; end if;
  gain := case p_kind when 'f' then 6 when 'l' then 2 when 'p' then 5 else null end;
  if gain is null then raise exception 'acao_invalida'; end if;
  if p_kind = 'f' then fd := public.g_item_add(p_user, 'food', -1);
  else select qty into fd from public.inventory where user_id = p_user and item = 'food'; end if;
  x := public.g_xp_add(p_user, p_plush, gain);
  update public.plush_care set f = least(greatest(p_f,0),100), l = least(greatest(p_l,0),100), p = least(greatest(p_p,0),100), updated_at = now()
  where user_id = p_user and plush_id = p_plush;
  perform public.g_count(p_user, case p_kind when 'f' then 'feed' when 'l' then 'pet' else 'play' end, 1);
  return query select x, coalesce(fd, 0);
end; $$;

create or replace function public.rpc_battle(p_user uuid, p_plush integer, p_win boolean)
returns table(coins integer, xp integer, paid boolean) language plpgsql security definer set search_path = public as $$
declare c integer; x integer; pay boolean := false; st public.player_state;
begin
  if p_plush < 0 or p_plush >= 43 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  select * into st from public.player_state where user_id = p_user for update;
  if st.battle_at is not null and now() - st.battle_at < interval '3 seconds' then raise exception 'rapido_demais'; end if;
  if st.battle_hour_start is null or now() - st.battle_hour_start > interval '1 hour' then st.battle_hour_start := now(); st.battle_coins := 0; end if;
  if p_win and st.battle_coins < 5 then pay := true; st.battle_coins := st.battle_coins + 1; end if;
  update public.player_state set battle_at = now(), battle_hour_start = st.battle_hour_start, battle_coins = st.battle_coins,
    coins = player_state.coins + (case when pay then 1 else 0 end)
  where user_id = p_user returning player_state.coins into c;
  x := public.g_xp_add(p_user, p_plush, case when p_win then 10 else 4 end);
  if p_win then perform public.g_count(p_user,'battle_win',1); end if;
  return query select c, x, pay;
end; $$;

do $$ declare f text; begin
  foreach f in array array['g_count(uuid,text,integer)','g_progress(uuid,text,boolean)','rpc_mission_claim(uuid,text,boolean,text,integer,integer,text)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
