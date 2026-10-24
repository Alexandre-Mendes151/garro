# Garro App

Jogo em forma de app para comercialização.

Jogo de máquina de garra no navegador: mova a garra, aperte PEGAR e leve as pelúcias até o buraco de prêmio.
Cada pelúcia tem tamanho e peso próprios, a garra tem três pontas e pode escorregar ou enroscar.
Na coleção, as pelúcias capturadas aparecem em 3D e reagem ao toque (carinho, coçar, bravo, barriga pra cima).

## Jogar
**Link:** https://alexandre-mendes151.github.io/garro/

Abra `index.html` em qualquer navegador, ou ative o GitHub Pages neste repositório
(Settings → Pages → Branch: `main` / pasta raiz) e use o link gerado.

## Modelos 3D
Sylvorn e Terranox usam modelos 3D gerados a partir das fotos (pasta `models/`). Os outros bichinhos usam modelos montados no próprio jogo.

## Tecnologia
Um único arquivo HTML, sem instalação. Usa Matter.js (física) e Three.js (3D), carregados de CDN.

### Pelúcias derivadas (textura dos modelos de referência)
- `models/deer_base.glb`: corpo do Sylvorn sem chifres nem orelhas. Serve de molde para Flarion, Umbros, Voltik, Lunaris, Lumina e Auren, cada um com a pele pintada em `models/skins/<n>.jpg` e as partes próprias (orelhas, asas, cauda...).
- `models/tex/fur.jpg` e `models/tex/scale.jpg`: pelagem e escamas tiradas do Sylvorn e do Terranox, aplicadas nas outras pelúcias 3D.

### Modelos Tripo novos
- `draksel.glb`, `glacien.glb`, `flarion.glb`, `magmord.glb`, `petrun.glb` (reduzidos de ~1 milhão para ~50 mil triângulos).
- Primos repintados (`models/skins/<n>.jpg`): Aquarim e Zephyra usam o Glacien; Floriss e Toxilys, o Magmord; Umbros e Voltik, o Flarion; Coralith, o Petrun.
- Visualizador 3D: chão conforme o elemento de cada pelúcia, sombra real sob as patas e, ao deslizar o dedo para cima no bichinho, ele corre em círculos.

### Rodada 3
- Todas as 20 pelúcias agora usam modelo 3D de verdade (Tripo): Umbros, Ignovus e Sombril entraram como modelos próprios; Nimbri usa o Sombril, Zephyra usa o Ignovus, e Lunaris/Lumina/Auren usam o Umbros, cada um com pele própria.
- Modelos com mapa de relevo (normal map) para a pelagem e as escamas ficarem com volume.
- Tela inicial com a máquina de garra 3D (`models/machine.glb`); tocar em JOGAR aproxima a câmera e entra no jogo.
- Correções: a janela 3D aparecia por cima do jogo em alguns navegadores; a garra agora afunda um pouco na pilha antes de fechar (menos “fechou no vazio”); a sombra acompanha a cabeça quando o bicho vira.

### Rodada 4 (movimentos e tela da pelúcia)
- Sozinhos, os bichos agora fazem coisas: olham em volta, farejam o chão, pulam, se espreguiçam, sentam, abanam o rabo; Draksel, Ignovus e Zephyra batem as asas.
- Reações mais claras: ao ficar bravo ele recua, agacha e bufa; carinho faz inclinar e balançar; um aviso no topo mostra o humor.
- Correções: agachar não faz mais o bicho flutuar; Ignovus/Zephyra estavam de lado e agora olham pra frente; a corrida em círculos não sai mais da tela; área da cabeça certa no Sombril e no Ignovus.
- Tela da pelúcia: elemento e raridade, setas para passar entre as pelúcias capturadas e “Como brincar” recolhível.

### Rodada 5 (bichinhos redondos e evolução)
- 23 pelúcias redondas (ids 20 a 42) entraram na máquina e na coleção: Cianim, Tigrel, Folhim, Draquim, Nevim, Trevim, Rosalis, Melzim, Marim, Cinzim, Noctis, Carneli, Brasim, Cobaltin, Zorbi, e os 8 da folha “ovo → pelúcia”: Terranox Mini, Draksel Mini, Petrun Mini, Nimbri Mini, Ignovus Mini, Flarion Mini, Umbrio e Auren Mini. São montadas em código (sem .glb).
- **Os redondos não evoluem.** São só prêmios da garra, em uma forma só, e aparecem em maior quantidade (cerca de 70% da pilha, até 3 iguais). Pegar repetido só soma na coleção.
- **Quem evolui são as 20 pelúcias grandes.** Comida, Carinho e Brincar (as voltas em círculo) enchem barras e dão XP; com 60 XP ela vira a forma da folha de evolução (Terranox Prime, Aquarim Leviatã, Flarion Inferno... Auren Divino): maior, com brilho, faíscas e anel na cor do elemento. Repetida dá +20 XP.
- **Redondos guardados e vendáveis:** os redondos pegos ficam na coleção e repetidos somam (×2, ×3...). Na tela de cada redondo há **Vender repetidas**: a cada 2 repetidas vendidas, 1 moeda (sempre fica 1 de cada). Eles também podem ser alimentados (Comida, Carinho, Brincar), só que sem evoluir.
- **Servidor:** a migração `0003_redondos_e_venda.sql` e a função `sync-estado` (ações `capture` até o id 42 e `sell`) precisam ser publicadas no Supabase. Enquanto isso não for feito, o jogo guarda os redondos e as moedas da venda no próprio aparelho (junta com o servidor pelo maior valor).
- **Formas evoluídas (Nível 50):** cada um dos 20 grandes ganha peças da folha de evolução: asas (Zephyra, Umbros, Draksel, Ignovus, Lumina, Auren, Flarion), cristais (Glacien, Toxilys), espinhos (Terranox, Magmord), flores, coral, musgo, auréola etc. Ficam em `EVOX` no código. A folha de referência está em `docs/referencia-evolucao.png`. São peças sobre o corpo atual, não modelos 3D novos.
- **Nível, Ataque, Defesa e Vida** nos 43 bichinhos (tabela `STAT` no código). Os redondos têm bem menos poder e nível máximo 30; os 20 grandes chegam ao nível 100 e **evoluem no nível 50** (poder ×1,35). O nível sobe com XP de Comida, Carinho, Brincar e batalhas.
- **Batalha:** botão "Batalhar" na tela do bichinho. Sorteia um adversário (75% da mesma categoria), a luta é automática por rodadas. Vencer dá +10 XP e 1 moeda (no máximo 5 moedas por hora); perder dá +4 XP.
- **Flarion e Nimbri** foram remontados (raposa de fogo e carneirinho de nuvem, código `buildFox` e `buildCloud`); o Flarion é uma raposa de fogo igual à referência (código em `buildFox`): cabeça grande, orelhas, gola creme, juba e cauda de folhas de fogo. Tem as mesmas brincadeiras e evolução dos outros.
- O progresso fica salvo no aparelho (`localStorage`, chave `garro-care`).

## Modelos Tripo próprios (9 bichos)
Aquarim, Zephyra, Floriss, Voltik, Lunaris, Coralith, Lumina, Toxilys e Auren agora usam o corpo e a textura do próprio modelo Tripo (antes eram "primos" repintados de outros corpos). Arquivos em `models/` (versão completa; a versão leve vai embutida na demo/artefato). Lumina, Toxilys e Auren vieram juntos num único GLB e foram separados por componente. Na forma evoluída recebem coroa/halo e aura (as peças antigas foram tiradas para não duplicar asas/flores).

## Ataques por elemento na batalha
Cada golpe usa o elemento do bicho: raio (choque em zigue-zague), pedra/terra (arremesso), água/mar (jato), fogo/lava (bola de fogo), gelo, vento, sombra, flores/folhas/luz (chuva de pétalas), lua, veneno e sagrado. O dano só aparece quando o golpe acerta.

## Movimento na luta
Os dois lutadores ficam de frente (o da direita é espelhado). Respiram parados, investem para frente ao atacar (mais forte no crítico) e balançam ao levar o golpe. Quem perde deita acinzentado; quem ganha comemora com uma das três: três pulinhos, deitar e rolar ou correr em círculos, com estrelas e corações.

## Loja e pedras raras
Botão 🛒 Loja no topo. Comida custa 5 moedas e Pedra de evolução 400. A comida agora é item: cada vez que o bichinho come gasta 1 (começa com 3). As 6 pedras (Fogo, Ar, Terra, Planta, Fantasma, Psíquico) também aparecem raramente na máquina (cerca de 1% por pelúcia sorteada, no máximo uma por vez). Uso único: no bicho grande do mesmo elemento ela leva direto ao Nv 50 e evolui; depois a pedra some. Inventário e gastos ficam no aparelho (localStorage `garro-inv` e `garro-bonus`), sem servidor por enquanto.

### Cores conferidas com a referência
- Magmord (preto com lava), Glacien (cristais azuis), Draksel (vermelho) e Petrun (pedra cinza com musgo) foram repintados em `models/skins/` a partir dos modelos Tripo já enviados. Os .glb não mudaram.
- Ainda pedem modelo novo do Tripo para ficarem iguais na forma: Flarion e Nimbri (hoje feitos em código) e Petrun (o modelo atual é um golem de lava).
- Fim do "quadriculado": Aquarim, Coralith, Lunaris, Voltik, Floriss, Zephyra, Lumina, Toxilys e Auren foram reduzidos de novo mantendo a textura original do Tripo (sem mosaico). Terranox ficou mais verde.
- Arquivos de modelo e pele agora levam `?v=` no endereço, para o celular não mostrar a versão antiga guardada.
- **Flarion** agora usa o corpo de raposa do Voltik pintado de fogo (`models/skins/2.jpg`), no lugar da raposa feita em código. Quando chegar um modelo próprio do Tripo, é só trocar o arquivo em `MODELS[2]`.

### Luta cara a cara (correção definitiva) e Terranox novo
- O bote e o empurrão da luta usavam a mesma direção para os dois lados; com a imagem espelhada, o bicho dava o bote para trás e parecia olhar para o rabo do outro. Agora os movimentos são escritos "para a frente" e o lado direito espelha o movimento inteiro (`bA`). Testado nas 1806 duplas possíveis (43 × 42): cabeça virada para o adversário, parado e no ataque.
- **Terranox** usa o modelo Tripo do dinossauro (espinhos repintados de marrom, corpo verde), sem as peças extras de antes.
- Dos arquivos enviados, 9 eram iguais aos que já estavam no jogo e o `baby_dragon` saiu do Tripo como um quadro plano (a folha inteira), então não foi usado.

### Os 20 com modelo Tripo próprio
- Chegaram os que faltavam: **Glacien** (dragão de gelo), **Flarion** (raposa de fogo), **Petrun** (tartaruga de pedra com musgo) e **Nimbri** (nuvem fofa; veio no mesmo arquivo do Petrun e foi separado). Todos reduzidos mantendo a textura original.
- Flarion e Nimbri não são mais montados em código (`PROC` vazio). As peles repintadas antigas `skins/0, 2, 6, 13` saíram.
- Evolução desses quatro: brilho, anel e auréola na cor do elemento (`EVCROWN`).

### Economia e máquina
- **Moedas infinitas só para desenvolvedores:** as contas Google `alexandre.et@gmail.com` e `joaobazanela@gmail.com` (lista `DEV_EMAILS`) veem ∞ e jogam, compram e trocam sem gastar. Para todos os outros nada muda. A cópia de teste dos devs (artefato do Claude) já abre com ∞. No demo público sem login começa normal; nos dois, 7 toques no contador de moedas ligam/desligam o modo dev, só naquele aparelho.
- **Reposição mais lenta:** a máquina não enche mais de volta a cada jogada. Cai 1 bichinho novo a cada 4 jogadas quando a pilha está baixa; só repõe 3 de uma vez se ficar quase vazia (menos de 6).
- **Trocar bichinhos da máquina:** botão abaixo dos controles, custa 10 moedas (`SWAP_COST`). Tira todos e sorteia uma pilha nova.
- **Venda de um em um:** cada redondo vendido vale 1 moeda e dá para vender até o último. **Servidor:** publicar a migração `0004_venda_um_a_um.sql` e a função `sync-estado` atualizada (aceita `qty` a partir de 1). Até lá, a venda é guardada no aparelho.

### Itens e pedras novas
- Botão **Itens 🎒** no topo: mostra quanta comida e quantas pedras você tem (as que você tem aparecem primeiro). Tocando numa pedra, lista os seus bichinhos que podem evoluir com ela; escolher um abre a tela dele e evolui na hora.
- Duas pedras novas: **Pedra de Luz** (Lunaris, Lumina, Auren) e **Pedra Sombria** (Umbros, Sombril). A Pedra Fantasma ficou para o Toxilys; a Psíquica, sem bicho por enquanto. Aparecem raras na máquina e custam 400 na loja, como as outras.
