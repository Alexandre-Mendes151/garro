-- Venda de qualquer pelúcia, uma a uma, até a última:
--   redondos (20 a 42) = 1 moeda cada; bichos especiais que evoluem (0 a 19) = 30 moedas cada.
-- (A pelúcia gigante vale 40, mas por enquanto fica guardada só no aparelho.)
create or replace function public.rpc_sell(p_user uuid, p_plush_id integer, p_qty integer)
returns table(coins integer, wins integer, count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
  updated_count integer;
  price integer;
begin
  if p_plush_id < 0 or p_plush_id >= 43 or p_qty < 1 then
    raise exception 'bad_sale';
  end if;
  price := case when p_plush_id < 20 then 30 else 1 end;

  update public.collection
  set count = collection.count - p_qty
  where user_id = p_user and plush_id = p_plush_id and collection.count - p_qty >= 0
  returning collection.count into updated_count;

  if not found then
    raise exception 'sale_rejected';
  end if;

  update public.player_state
  set coins = player_state.coins + p_qty * price
  where user_id = p_user
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;

  return query select updated_coins, updated_wins, updated_count;
end;
$$;

revoke execute on function public.rpc_sell(uuid, integer, integer) from public;
grant execute on function public.rpc_sell(uuid, integer, integer) to service_role;
