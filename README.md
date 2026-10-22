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
- **Nível, Ataque, Defesa e Vida** nos 43 bichinhos (tabela `STAT` no código). Os redondos têm bem menos poder e nível máximo 30; os 20 grandes chegam ao nível 100 e **evoluem no nível 50** (poder ×1,35). O nível sobe com XP de Comida, Carinho, Brincar e batalhas.
- **Batalha:** botão "Batalhar" na tela do bichinho. Sorteia um adversário (75% da mesma categoria), a luta é automática por rodadas. Vencer dá +10 XP e 1 moeda (no máximo 5 moedas por hora); perder dá +4 XP.
- **Flarion e Nimbri** foram remontados (raposa de fogo e carneirinho de nuvem, código `buildFox` e `buildCloud`); o Flarion é uma raposa de fogo igual à referência (código em `buildFox`): cabeça grande, orelhas, gola creme, juba e cauda de folhas de fogo. Tem as mesmas brincadeiras e evolução dos outros.
- O progresso fica salvo no aparelho (`localStorage`, chave `garro-care`).
