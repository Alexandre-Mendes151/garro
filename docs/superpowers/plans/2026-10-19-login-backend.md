# Login + Backend de Contas (Garro App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar login com Google antes do jogo, e mover moedas/coleção/ranking de `localStorage` pra um backend Supabase isolado (projeto `appgarro`), com escrita protegida por uma Edge Function (o cliente não escreve direto nas tabelas de progresso).

**Architecture:** Supabase Auth (OAuth Google) + Postgres com RLS (leitura só da própria linha; sem policy de escrita pro usuário comum) + 1 Edge Function `sync-estado` que valida e grava `player_state`/`collection` usando a `service_role key`. View pública `ranking` expõe só nome + agregados.

**Tech Stack:** Supabase (Postgres, Auth, Edge Functions em Deno/TypeScript), supabase-js (CDN), HTML/JS vanilla (mesmo arquivo único `index.html`), Supabase CLI.

**Referências:**
- Spec: `docs/superpowers/specs/2026-10-19-login-backend-design.md`
- Mockup aprovado: https://claude.ai/artifact/XPEkWg4GC6U4SYmmKY9eR4
- Projeto Supabase: `appgarro` (ref: `dscxtivmuqavisgxzohr`), URL em `.env.local`

---

## Pré-requisito manual (antes da Task 1)

O João precisa gerar dois valores sensíveis no painel do Supabase e me passar
(ou eu uso o Chrome pra pegar, sem exibir em texto no chat):

1. **Database password** (definida na criação do projeto) — se perdida,
   gerar nova em Settings → Database → Reset database password.
2. **Personal access token** — gerar em https://supabase.com/dashboard/account/tokens
   (nome sugerido: "garro-app-ci").

Esses dois valores vão **direto para os Secrets do repositório GitHub**
(`garro-app` → Settings → Secrets and variables → Actions), nunca para
arquivos versionados:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID` = `dscxtivmuqavisgxzohr`

E habilitar o provider Google no painel: Authentication → Sign In / Providers
→ Google → ativar, usando um OAuth Client ID/Secret do Google Cloud Console
(Task 0 abaixo cobre isso).

---

### Task 0: Configurar OAuth do Google no Supabase

**Files:** nenhum arquivo de código — configuração no painel Supabase e Google Cloud Console.

- [ ] **Passo 1:** No Google Cloud Console (console.cloud.google.com), criar um
  projeto "Garro App" (ou usar um existente só pra isso).
- [ ] **Passo 2:** APIs & Services → Credentials → Create Credentials → OAuth
  client ID → tipo "Web application".
  - Authorized redirect URI: `https://dscxtivmuqavisgxzohr.supabase.co/auth/v1/callback`
  - Authorized JavaScript origin: `https://joaobazanela.github.io`
- [ ] **Passo 3:** Copiar o Client ID e Client Secret gerados.
- [ ] **Passo 4:** No painel Supabase do projeto `appgarro`: Authentication →
  Providers → Google → habilitar, colar Client ID e Client Secret, salvar.
- [ ] **Passo 5:** Authentication → URL Configuration → Site URL =
  `https://joaobazanela.github.io/garro-app/`.

---

### Task 1: Schema do banco (migration inicial)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Passo 1: Escrever a migration**

```sql
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
```

- [ ] **Passo 2: Aplicar a migration no projeto remoto**

```bash
cd "/Users/joaob/Documents/Garro app"
supabase login
supabase link --project-ref dscxtivmuqavisgxzohr
supabase db push
```

Expected: output lista `0001_init.sql` aplicada sem erro.

- [ ] **Passo 3: Verificar no painel**

Abrir Table Editor no painel Supabase e confirmar que `profiles`,
`player_state`, `collection` e a view `ranking` existem.

- [ ] **Passo 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: schema inicial (profiles, player_state, collection, ranking)"
git push origin main
```

---

### Task 2: Edge Function `sync-estado`

**Files:**
- Create: `supabase/functions/sync-estado/index.ts`

- [ ] **Passo 1: Escrever a função**

```typescript
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

  // Cliente autenticado como o usuário (só pra identificar quem é)
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const userId = userData.user.id;

  // Cliente com service_role, única forma de gravar nessas tabelas
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
```

- [ ] **Passo 2: Deploy manual pra testar**

```bash
cd "/Users/joaob/Documents/Garro app"
supabase functions deploy sync-estado --project-ref dscxtivmuqavisgxzohr
```

Expected: `Deployed Function sync-estado`.

- [ ] **Passo 3: Testar com curl (substitua SEU_JWT por um token de um login de teste)**

```bash
curl -i -X POST "https://dscxtivmuqavisgxzohr.supabase.co/functions/v1/sync-estado" \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"round_start"}'
```

Expected: `200` com `{"coins":14,"wins":0}` (ou o valor atual -1).

- [ ] **Passo 4: Testar rejeição de spam**

Repita o mesmo curl imediatamente em seguida (menos de 1.5s depois).
Expected: `429` com `{"error":"too_fast"}`.

- [ ] **Passo 5: Commit**

```bash
git add supabase/functions/sync-estado/index.ts
git commit -m "feat: Edge Function sync-estado valida e grava moedas/coleção"
git push origin main
```

---

### Task 3: GitHub Actions para deploy automático do schema/função

**Files:**
- Create: `.github/workflows/deploy-supabase.yml`

- [ ] **Passo 1: Escrever o workflow**

```yaml
name: Deploy Supabase (garro-app)

on:
  push:
    branches: [main]
    paths:
      - "supabase/migrations/**"
      - "supabase/functions/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Link project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - name: Push migrations
        run: supabase db push --linked -p ${{ secrets.SUPABASE_DB_PASSWORD }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - name: Deploy functions
        run: supabase functions deploy sync-estado --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

- [ ] **Passo 2: Configurar os secrets (uma vez, manual)**

```bash
gh secret set SUPABASE_PROJECT_ID --repo joaobazanela/garro-app --body "dscxtivmuqavisgxzohr"
gh secret set SUPABASE_ACCESS_TOKEN --repo joaobazanela/garro-app
gh secret set SUPABASE_DB_PASSWORD --repo joaobazanela/garro-app
```

(os dois últimos comandos sem `--body` pedem o valor interativamente, sem
ecoar na tela nem ficar salvo no histórico do chat)

- [ ] **Passo 3: Commit e verificar o workflow rodando**

```bash
git add .github/workflows/deploy-supabase.yml
git commit -m "ci: deploy automático de migrations e Edge Functions no push"
git push origin main
```

Expected: aba Actions do repo mostra o job rodando e terminando verde.

---

### Task 4: Tela de login no `index.html`

**Files:**
- Modify: `index.html` (adiciona markup/CSS do mockup antes do `<div class="cab">` do jogo)

- [ ] **Passo 1: Adicionar o CSS da tela de login**

Inserir, logo depois do bloco `<style>` principal existente (perto da
linha 13), o CSS do mockup aprovado — reaproveitar as mesmas variáveis
`:root` já existentes no jogo (`--night`, `--cab`, `--neon`, etc. — **não**
duplicar a definição de `:root`, só adicionar as classes novas):

```css
.loginScreen{border-radius:16px;background:#0b0710;padding:26px 20px 24px;
  box-shadow:inset 0 0 0 3px #000, inset 0 0 26px rgba(0,0,0,.8), 0 0 0 10px #241320, 0 0 0 11px #000;
  display:flex;flex-direction:column;align-items:center;gap:18px;min-height:360px;position:relative;overflow:hidden}
.loginScreen .logoMark{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 35% 30%,#ff8fb8,var(--neon) 55%,#9c2458 100%);
  box-shadow:0 0 0 4px #000,0 0 0 7px rgba(255,79,139,.5),0 10px 24px rgba(255,79,139,.35);
  font-family:var(--display);font-size:34px;color:#1a0712}
.btnGoogle{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:10px;
  width:100%;max-width:280px;padding:13px 18px;border-radius:999px;cursor:pointer;
  background:#fff;color:#2b2b2b;font-weight:800;font-size:14.5px;font-family:var(--body)}
.btnGoogle .gicon{width:19px;height:19px;flex:none}
.spinnerRow{display:flex;align-items:center;gap:10px;color:var(--dim);font-size:13px}
.spinner{width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(255,255,255,.15);border-top-color:var(--neon);animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.errBox{display:flex;flex-direction:column;align-items:center;gap:10px;background:rgba(255,107,107,.1);
  border:1px solid rgba(255,107,107,.35);border-radius:12px;padding:14px 16px;width:100%;max-width:300px}
.errBox b{color:var(--err,#ff6b6b);font-size:13px}
.errBox span{color:var(--dim);font-size:12px;text-align:center;line-height:1.4}
```

- [ ] **Passo 2: Adicionar o markup, envolvendo o `.cab` existente do jogo**

Logo após `<body>` (procurar a primeira ocorrência de `<div class="cab">`
no arquivo atual), adicionar **antes** dela:

```html
<div id="authGate">
  <h1 class="marquee">GARRO</h1>
  <p class="tagline">entre pra continuar sua coleção</p>
  <div class="cab">
    <div class="loginScreen">
      <div id="authDefault">
        <div class="logoMark">G</div>
        <h2>Bem-vindo de volta</h2>
        <p class="sub">Entre com sua conta Google pra salvar suas moedas e sua coleção de pelúcias na nuvem.</p>
        <button class="btnGoogle" id="btnGoogleLogin" type="button">Entrar com Google</button>
      </div>
      <div id="authLoading" hidden>
        <div class="spinnerRow"><span class="spinner"></span> confirmando com o Google</div>
      </div>
      <div id="authError" hidden>
        <div class="errBox">
          <b>Conexão recusada</b>
          <span>O Google não confirmou o login. Verifique sua internet e tente de novo.</span>
        </div>
        <button class="retry" id="btnRetryLogin" type="button">Tentar novamente</button>
      </div>
    </div>
  </div>
</div>
```

Envolver o `<div class="cab">` original do jogo (o que já existe) com
`<div id="gameRoot" hidden>...</div>`.

- [ ] **Passo 3: Commit**

```bash
git add index.html
git commit -m "feat: markup e CSS da tela de login (Google)"
git push origin main
```

---

### Task 5: Lógica de autenticação e sincronização de estado

**Files:**
- Modify: `index.html` (dentro do `<script>` principal, antes do bloco `/* ---------- game state ---------- */`)

- [ ] **Passo 1: Adicionar o script do supabase-js (CDN com SRI) e a lógica de auth**

No `<head>`, junto dos outros scripts CDN (com hash de integridade real —
gerar com `openssl dgst -sha384 -binary arquivo.js | openssl base64 -A`
depois de baixar a versão fixada):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" integrity="sha384-SUBSTITUIR_PELO_HASH_REAL" crossorigin="anonymous"></script>
```

No topo do `<script>` principal, antes de `/* ---------- game state ---------- */`:

```javascript
/* ---------- autenticação e sincronização ---------- */
const SUPABASE_URL='https://dscxtivmuqavisgxzohr.supabase.co';
const SUPABASE_ANON_KEY='COLAR_A_CHAVE_DE_.env.local_AQUI';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let session=null;

function showAuthState(name){
  ['Default','Loading','Error'].forEach(n=>{$('auth'+n).hidden=n!==name});
}

async function syncEstado(action,extra){
  const {data:{session:s}}=await sb.auth.getSession();
  if(!s)return null;
  const res=await fetch(SUPABASE_URL+'/functions/v1/sync-estado',{
    method:'POST',
    headers:{'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json'},
    body:JSON.stringify(Object.assign({action},extra||{}))
  });
  if(!res.ok)return null;
  return res.json();
}

async function carregarEstado(){
  const {data:ps}=await sb.from('player_state').select('coins,wins').single();
  const {data:colRows}=await sb.from('collection').select('plush_id,count');
  coins=ps?ps.coins:15;
  coll={};
  (colRows||[]).forEach(r=>{coll[r.plush_id]=r.count});
}

async function entrarComGoogle(){
  showAuthState('Loading');
  const {error}=await sb.auth.signInWithOAuth({provider:'google'});
  if(error)showAuthState('Error');
}

async function iniciarAposLogin(){
  await carregarEstado();
  $('authGate').hidden=true;
  $('gameRoot').hidden=false;
  hud();renderShelf();
  start();
}

sb.auth.onAuthStateChange((event,s)=>{
  session=s;
  if(s)iniciarAposLogin();
});

$('btnGoogleLogin').addEventListener('click',entrarComGoogle);
$('btnRetryLogin').addEventListener('click',()=>showAuthState('Default'));

(async()=>{
  const {data:{session:s}}=await sb.auth.getSession();
  if(s)await iniciarAposLogin();
})();
```

- [ ] **Passo 2: Trocar os pontos onde o jogo mexe em moedas/coleção pra
  chamar o backend em vez de só a variável local**

Modificar `drop()` (linha ~343, hoje `coins--;claw.state='move';...`):

```javascript
function drop(){
  if(claw.state!=='move')return;
  syncEstado('round_start').then(r=>{if(r)coins=r.coins});
  coins--;claw.state='move';dir=0;hum(true);$('bar').style.width='0';hud()
}
```

Modificar `won(b)` (linha ~372, hoje só grava em `localStorage`):

```javascript
function won(b){
  const p=b.plush;coll[p.i]=(coll[p.i]||0)+1;
  syncEstado('capture',{plushId:p.i});
  ...
}
```

(manter o resto do corpo de `won` igual; só adicionar a chamada de
`syncEstado`, e pode remover a linha de `localStorage.setItem` já que o
estado agora vive no backend).

Modificar o listener do botão `#refill` (linha ~472):

```javascript
$('refill').addEventListener('click',()=>{
  syncEstado('refill').then(r=>{if(r){coins=r.coins;hud()}});
  $('hint').textContent='Toque nas setas para jogar'
});
```

- [ ] **Passo 3: Commit**

```bash
git add index.html
git commit -m "feat: login com Google e sincronização de moedas/coleção via Supabase"
git push origin main
```

---

### Task 6: Tela de ranking

**Files:**
- Modify: `index.html`

- [ ] **Passo 1: Adicionar markup do ranking (perto da estante de coleção existente)**

```html
<div id="rankingPanel" hidden>
  <h3>Ranking</h3>
  <ol id="rankingList"></ol>
</div>
```

- [ ] **Passo 2: Adicionar função de carregar e um botão que abre o painel**

```javascript
async function abrirRanking(){
  const {data,error}=await sb.from('ranking').select('*').limit(50);
  if(error)return;
  const ol=$('rankingList');
  ol.innerHTML='';
  (data||[]).forEach(r=>{
    const li=document.createElement('li');
    li.textContent=(r.display_name||'Jogador')+' — '+r.wins+' vitórias · '+r.total_plush+' pelúcias';
    ol.appendChild(li);
  });
  $('rankingPanel').hidden=false;
}
```

Ligar essa função a um botão novo no HUD (ex.: `<button id="btnRanking">Ranking</button>`
adicionado perto de `#coins`/`#wins`), com
`$('btnRanking').addEventListener('click',abrirRanking)`.

- [ ] **Passo 3: Commit**

```bash
git add index.html
git commit -m "feat: painel de ranking público"
git push origin main
```

---

### Task 7: Teste manual ponta a ponta

**Files:** nenhum (só verificação)

- [ ] **Passo 1:** Abrir `https://joaobazanela.github.io/garro-app/` (depois
  do deploy), confirmar que a tela de login aparece antes do jogo.
- [ ] **Passo 2:** Clicar "Entrar com Google", logar com uma conta de teste,
  confirmar que volta pro jogo com 15 moedas.
- [ ] **Passo 3:** Jogar uma rodada, confirmar no painel Supabase (Table
  Editor → `player_state`) que `coins` diminuiu 1.
- [ ] **Passo 4:** Capturar uma pelúcia, confirmar que `collection` ganhou
  uma linha/contagem e `wins` subiu.
- [ ] **Passo 5:** Abrir o DevTools e tentar (via `fetch` manual) escrever
  direto em `player_state` usando a `anon key` — esperado: rejeitado pela
  RLS (nenhuma policy de insert/update pra `authenticated`).
- [ ] **Passo 6:** Abrir o ranking, confirmar que aparece pelo menos o
  próprio jogador.
- [ ] **Passo 7:** Deslogar (ou limpar sessão) e recarregar — confirmar que
  a tela de login aparece de novo, e logando de novo o progresso continua
  o mesmo (prova que não depende mais só do `localStorage`).

---

## Fora de escopo (herdado da spec)
- Login com Apple.
- Validação server-side da física da garra (Edge Function só confere
  plausibilidade: 1 coin por rodada, rate limit entre ações).
- Empacotamento como app nativo.
