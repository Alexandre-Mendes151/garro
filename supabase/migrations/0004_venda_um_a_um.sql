-- Venda dos redondos (20 a 42) um a um: cada um vale 1 moeda e pode vender até o último.
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
  if p_plush_id < 20 or p_plush_id >= 43 or p_qty < 1 then
    raise exception 'bad_sale';
  end if;

  update public.collection
  set count = collection.count - p_qty
  where user_id = p_user and plush_id = p_plush_id and collection.count - p_qty >= 0
  returning collection.count into updated_count;

  if not found then
    raise exception 'sale_rejected';
  end if;

  update public.player_state
  set coins = player_state.coins + p_qty
  where user_id = p_user
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;

  return query select updated_coins, updated_wins, updated_count;
end;
$$;

revoke execute on function public.rpc_sell(uuid, integer, integer) from public;
grant execute on function public.rpc_sell(uuid, integer, integer) to service_role;
