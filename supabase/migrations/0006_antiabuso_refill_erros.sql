-- 1) rpc_capture: exige um tempo mínimo de jogo entre começar a rodada e capturar
-- (fecha o caminho mais óbvio de abuso: chamar round_start e capture em sequência
-- direto pela API, sem realmente jogar). Não substitui validar a física em si,
-- mas elimina a farmagem instantânea de pelúcias raras.
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
    and last_action_at is not null
    and now() - last_action_at > interval '1.5 seconds'
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

-- 2) rpc_refill: era +15 moedas a cada 20s (praticamente infinito). Agora +1 moeda
-- a cada 10 minutos.
create or replace function public.rpc_refill(p_user uuid)
returns table(coins integer, wins integer)
language plpgsql
security definer set search_path = public
as $$
declare
  updated_coins integer;
  updated_wins integer;
begin
  update public.player_state
  set coins = coins + 1,
      last_action_at = now()
  where user_id = p_user
    and (last_action_at is null or now() - last_action_at > interval '10 minutes')
  returning coins, wins into updated_coins, updated_wins;

  if not found then
    raise exception 'refill_rejected';
  end if;

  return query select updated_coins, updated_wins;
end;
$$;

-- 3) Relatório de erros do cliente: a Edge Function e o JS do jogo gravam aqui
-- quando algo quebra, pra dar pra conferir depois sem precisar que o jogador avise.
-- Só é possível INSERIR (nunca ler, alterar ou apagar pelo cliente) — leitura é só
-- pelo painel do Supabase (dono do projeto) ou service_role.
create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  context text,
  message text not null,
  stack text,
  url text
);

alter table public.client_errors enable row level security;

create policy "client_errors: qualquer um pode registrar"
  on public.client_errors for insert
  to anon, authenticated
  with check (true);
