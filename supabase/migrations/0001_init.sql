-- supabase/migrations/0001_init.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.player_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins integer not null default 15,
  wins integer not null default 0,
  last_action_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.collection (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plush_id integer not null check (plush_id >= 0 and plush_id < 20),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, plush_id)
);

-- Cria profile + player_state automaticamente no primeiro login
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.player_state (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: cada jogador só LÊ a própria linha.
-- Nenhuma policy de INSERT/UPDATE/DELETE é criada para authenticated —
-- só a service_role (usada pela Edge Function) escreve nessas tabelas.
alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.collection enable row level security;

create policy "profiles: leitura própria"
  on public.profiles for select
  using (auth.uid() = id);

create policy "player_state: leitura própria"
  on public.player_state for select
  using (auth.uid() = user_id);

create policy "collection: leitura própria"
  on public.collection for select
  using (auth.uid() = user_id);

-- View pública de ranking: só nome + agregados, sem dados sensíveis.
-- security_invoker=off (default): roda com permissão do dono (postgres),
-- então ignora as RLS acima de propósito — é a única porta pública.
create view public.ranking as
select
  p.display_name,
  ps.wins,
  coalesce(sum(c.count), 0)::int as total_plush
from public.profiles p
join public.player_state ps on ps.user_id = p.id
left join public.collection c on c.user_id = p.id
group by p.id, p.display_name, ps.wins
order by ps.wins desc
limit 50;

grant select on public.ranking to anon, authenticated;
