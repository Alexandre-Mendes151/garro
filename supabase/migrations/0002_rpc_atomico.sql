alter table public.player_state add column pending_round boolean not null default false;

create function public.rpc_round_start(p_user uuid)
returns table(coins integer, wins integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
begin
  update public.player_state
  set coins = coins - 1,
      pending_round = true,
      last_action_at = now()
  where user_id = p_user
    and coins >= 1
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning coins, wins into updated_coins, updated_wins;

  if not found then
    raise exception 'round_start_rejected';
  end if;

  return query select updated_coins, updated_wins;
end;
$$;

create function public.rpc_capture(p_user uuid, p_plush_id integer)
returns table(coins integer, wins integer, count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
  updated_count integer;
begin
  if p_plush_id < 0 or p_plush_id >= 20 then
    raise exception 'bad_plush_id';
  end if;

  update public.player_state
  set wins = wins + 1,
      pending_round = false,
      last_action_at = now()
  where user_id = p_user
    and pending_round = true
  returning coins, wins into updated_coins, updated_wins;

  if not found then
    raise exception 'capture_rejected';
  end if;

  insert into public.collection (user_id, plush_id, count)
  values (p_user, p_plush_id, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1
  returning count into updated_count;

  return query select updated_coins, updated_wins, updated_count;
end;
$$;

create function public.rpc_refill(p_user uuid)
returns table(coins integer, wins integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
begin
  update public.player_state
  set coins = coins + 15,
      last_action_at = now()
  where user_id = p_user
    and (last_action_at is null or now() - last_action_at > interval '20 seconds')
  returning coins, wins into updated_coins, updated_wins;

  if not found then
    raise exception 'refill_rejected';
  end if;

  return query select updated_coins, updated_wins;
end;
$$;

revoke execute on function public.rpc_round_start(uuid) from public;
revoke execute on function public.rpc_capture(uuid, integer) from public;
revoke execute on function public.rpc_refill(uuid) from public;
grant execute on function public.rpc_round_start(uuid) to service_role;
grant execute on function public.rpc_capture(uuid, integer) to service_role;
grant execute on function public.rpc_refill(uuid) to service_role;
