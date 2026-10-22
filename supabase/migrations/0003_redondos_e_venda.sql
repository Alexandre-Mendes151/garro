-- Pelúcias redondas (ids 20 a 42) passam a poder ser guardadas, e as repetidas podem ser vendidas por moedas.
alter table public.collection drop constraint if exists collection_plush_id_check;
alter table public.collection add constraint collection_plush_id_check check (plush_id >= 0 and plush_id < 43);

create or replace function public.rpc_capture(p_user uuid, p_plush_id integer)
returns table(coins integer, wins integer, count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
  updated_count integer;
begin
  if p_plush_id < 0 or p_plush_id >= 43 then
    raise exception 'bad_plush_id';
  end if;

  update public.player_state
  set wins = wins + 1,
      pending_round = false,
      last_action_at = now()
  where user_id = p_user
    and pending_round = true
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;

  if not found then
    raise exception 'capture_rejected';
  end if;

  insert into public.collection (user_id, plush_id, count)
  values (p_user, p_plush_id, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1
  returning collection.count into updated_count;

  return query select updated_coins, updated_wins, updated_count;
end;
$$;

-- Venda: só os redondos (20 a 42), sempre ficando com 1 de cada. A cada 2 vendidas, 1 moeda.
create or replace function public.rpc_sell(p_user uuid, p_plush_id integer, p_qty integer)
returns table(coins integer, wins integer, count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
  updated_count integer;
begin
  if p_plush_id < 20 or p_plush_id >= 43 or p_qty < 2 or p_qty % 2 <> 0 then
    raise exception 'bad_sale';
  end if;

  update public.collection
  set count = collection.count - p_qty
  where user_id = p_user and plush_id = p_plush_id and collection.count - p_qty >= 1
  returning collection.count into updated_count;

  if not found then
    raise exception 'sale_rejected';
  end if;

  update public.player_state
  set coins = player_state.coins + p_qty / 2
  where user_id = p_user
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;

  return query select updated_coins, updated_wins, updated_count;
end;
$$;

revoke execute on function public.rpc_sell(uuid, integer, integer) from public;
grant execute on function public.rpc_sell(uuid, integer, integer) to service_role;
