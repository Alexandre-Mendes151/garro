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

### Rodada 5 (15 bichinhos novos e cuidados)
- 15 pelúcias redondas da folha nova entraram na máquina e na coleção (ids 20 a 34): Cianim, Tigrel, Folhim, Draquim, Nevim, Trevim, Rosalis, Melzim, Marim, Cinzim, Noctis, Carneli, Brasim, Cobaltin e Zorbi. São montadas em código (sem arquivo .glb), com olhos grandes, orelhas, chifres, marcas e patinhas.
- Cuidados na tela da pelúcia: **Comida**, **Carinho** e **Brincar** (as voltas em círculo). Cada ação enche uma barra e dá XP; as barras caem com o tempo.
- Evolução em 3 fases: Filhote (40 XP) → Jovem (110 XP) → Evoluído, que é a forma da folha de referência. Nos 15 novos mudam tamanho, cor e partes (orelhas, chifres, marcas); nos 20 antigos, o tamanho.
- Pegar uma pelúcia repetida dá +10 XP. O progresso fica salvo no aparelho (`localStorage`, chave `garro-care`).
