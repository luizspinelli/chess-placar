# Gráfico de rating

**Arquivos**: `js/indicadores.js` (`sparkline`, `curvaDados`) · `js/grafico.js` (`abrirModal`, `desenharModal`, zoom/pan)

## Objetivo

Ver a curva do rating no período com detalhe suficiente para achar onde subiu, onde caiu e que partidas estavam ali.

## Como usar

O resumo e a aba Rating trazem a sparkline com pico e vale; "⤢ Ampliar" (ou clique no gráfico) abre o modal. Nele: **rolagem = zoom**, **arrastar = mover**, **duplo clique = ver tudo**, **clique num ponto = abrir a partida** no Chess.com. Opções: eixo por partidas ou por tempo, média móvel, pontos. No celular: um dedo move, dois dedos dão zoom. Com mais de uma modalidade, abas no topo do modal.

## Como funciona

- `kpis()` popula `curvaDados[modalidade] = [{ts, rating, adv, advRating, r, delta, url}]` só com ranqueadas.
- `desenharModal` desenha em **SVG** com `viewBox` proporcional ao corpo (um `W` fixo esmagaria os textos no celular). Eixo Y em passos de 10/20/25/50/100/200 para caber em ≤8 linhas; eixo X com rótulos por data (mês/ano acima de 120 dias, dia/mês acima de 2 dias, hora abaixo) e, no eixo por partidas, `#índice · data`.
- **Janela** `vista.t0…t1` (índice de partida ou timestamp): zoom com fator 0,8/1,25 ao redor do cursor, mínimo de 4 partidas ou 600 s; pan preso aos limites. Pontos coloridos por resultado (raio 4 → 3 acima de 60 pontos → 2 acima de 300). Média móvel de 10 partidas em tracejado.
- Tooltip com rating, variação, data, adversário e resultado do ponto mais próximo do cursor; linha vertical de cursor.
- O tema (claro/escuro) redesenha o modal; `cor('--var')` lê as cores do CSS.

## Decisões

- **SVG próprio em vez de biblioteca.** ~150 linhas cobrem tudo que o app precisa e mantêm o zero-dependência para UI; uma lib de gráficos seria a maior dependência do projeto por uma tela.
- **Eixo por partidas como padrão.** Rating muda por partida, não por dia; no eixo de tempo, uma sessão de 20 partidas vira um risco vertical.

## Limites

- Sem partidas ranqueadas não há curva ("Só amistosas no período").
- Zoom por roda do mouse exige `preventDefault` — dentro do modal a página não rola, por desenho.

## Como testar

Abrir o modal com 200+ partidas: zoom até 4 partidas, pan até as bordas, duplo clique, clique num ponto abre a partida. Trocar eixo e tema com o modal aberto. No celular, pinça e arrasto.
