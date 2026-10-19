# Login + backend de contas — design

## Contexto
O jogo (`index.html`) hoje roda 100% no cliente: sem contas, moedas e coleção
só em `localStorage` do navegador. Vamos adicionar login antes de entrar no
jogo e um backend que guarda os dados de cada cliente, com planos de também
empacotar o jogo como app nativo (iOS/Android) no futuro.

## Decisões
- **Plataforma:** continuar web por enquanto, mas escolher stack compatível
  com app nativo depois (Capacitor/React Native), sem refazer o login.
- **Backend:** Supabase (Auth + Postgres + Edge Functions). Mais previsível em
  custo que Firebase para um jogo que salva estado com frequência (Firestore
  cobra por leitura/escritura; Postgres do Supabase tem teto fixo por plano).
  CLI do Supabase já é usada no outro projeto do João (`maycloset-platform`).
- **Método de login:** só login social, só Google por enquanto (Apple exige
  conta de desenvolvedor paga e mais configuração — entra quando/se lançarem
  app iOS de verdade).
- **Dados guardados no backend** (hoje só em `localStorage`):
  - `profiles`: id (= id do Supabase Auth), nome e foto do Google.
  - `player_state`: moedas (`coins`), total de vitórias.
  - `collection`: pelúcia capturada × quantidade, por jogador.
  - **Ranking entre jogadores**: calculado a partir dessas tabelas (sem
    tabela extra), por total de vitórias/coleção.

## Arquitetura
```
Navegador (index.html)
  → Supabase Auth (OAuth Google) — login
  → Supabase Postgres (via supabase-js, com RLS)
      - leitura: cada jogador só vê suas próprias linhas de player_state/collection
      - leitura pública: view de ranking (somente agregados, sem dados sensíveis)
  → Supabase Edge Function `registrar-captura`
      - recebe o resultado de uma captura (pelúcia pega ou não)
      - valida: intervalo mínimo entre jogadas, delta de moedas dentro do
        esperado para o custo da rodada
      - só essa função pode gravar em player_state/collection (RLS bloqueia
        escrita direta do cliente nessas tabelas)
```

Isso resolve o ponto de segurança identificado no scan anterior (moedas
editáveis via DevTools): o cliente deixa de ter permissão de escrita direta
nas tabelas de progresso — só pode *pedir* pra Edge Function gravar, e ela
aplica as checagens.

Escopo explícito fora deste design (YAGNI por agora): não há validação
server-side da física da garra em si (isso exigiria reescrever a simulação
Matter.js inteira no servidor). As checagens da Edge Function são de
plausibilidade (rate limit + limite de delta), não uma reimplementação do
jogo — suficiente para impedir trapaça trivial sem reescrever o motor físico.

## Fluxo de login
1. Jogador abre o site → tela de login (antes do jogo).
2. Toca "Entrar com Google" → `supabase.auth.signInWithOAuth({provider:'google'})`.
3. Redireciona de volta → `profiles` é criado automaticamente (trigger no
   primeiro login) se não existir.
4. Carrega `player_state` e `collection` do jogador → entra no jogo com o
   progresso restaurado.
5. Erros de rede/autenticação mostram o estado de erro (ver mockup) com botão
   "Tentar novamente".

## UI
Mockup aprovado: https://claude.ai/artifact/XPEkWg4GC6U4SYmmKY9eR4 — tela de
login no mesmo visual de máquina de garra neon do jogo (marquise, "tela de
vidro" escura, botão branco padrão Google), com estados padrão / carregando /
erro.

## Dados sensíveis e segurança
- Nenhuma senha é armazenada por nós — autenticação delegada ao Google via
  OAuth do Supabase.
- RLS (Row Level Security) ativo em todas as tabelas: um jogador só lê/escreve
  as próprias linhas; a view de ranking expõe só nome público + agregados.
- Chave pública do Supabase (`anon key`) fica no `index.html`, como é padrão
  nesse modelo — ela só permite o que as políticas de RLS liberarem, nunca
  acesso irrestrito ao banco.

## Testes
- Login: sucesso, cancelamento pelo usuário, falha de rede (os 3 estados do
  mockup).
- RLS: tentar ler/escrever dados de outro `user_id` deve falhar.
- Edge Function: captura com delta de moedas exagerado ou chamadas em
  sequência rápida demais deve ser rejeitada.

## Fora de escopo (decidido, não esquecido)
- Login com Apple.
- Validação server-side da física da garra.
- App nativo (iOS/Android) — a escolha de Supabase + OAuth já é compatível
  quando isso avançar, mas a embalagem nativa em si é um projeto separado.
