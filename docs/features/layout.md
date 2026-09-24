# Layout: barra de contexto, painel de filtros e o documento

**Arquivos**: `index.html` (`#contexto`, `#f`, ordem das seções) · `css/estilo.css` (`main`, `#contexto`, `form`, media queries) · `js/busca.js` (`renderContexto`, `filtros`) · `js/periodo.js` (`rotuloPeriodo`)

## Objetivo

O app é uma ferramenta de evolução: você joga, depois abre para saber o que fazer diferente. Isso é leitura, não monitoramento — então a tela é um documento que rola, não um painel de altura fixa com colunas fixas.

## Como usar

Depois da busca, o topo mostra uma barra com **nick · modalidade · período** (`hikaru · rápida · últimos 3 meses`). Clicar nela abre o painel de filtros por cima do conteúdo; buscar, clicar fora ou Esc fecham. Ao lado ficam **Copiar link** e o seletor de tema — ajustes da vista, não filtros da busca.

Abaixo da barra, em coluna única: placar, resumo ou indicadores, e a lista de partidas por último, recolhida atrás de "Ver as N partidas ▾".

## Como funciona

- `main` é uma grade de coluna única com `position:relative`; o `<form>` é `position:absolute` ancorado sob a barra e só aparece com a classe `filtrosAbertos` no `body`. Sobrepor em vez de empurrar mantém a posição de leitura quando o painel abre e fecha.
- `renderContexto()` monta o rótulo da barra a partir de `estado.nick`, `TIPO[aba]` e `rotuloPeriodo()`; roda no início de `render()`, então acompanha troca de aba de modalidade e nova busca. Sem `estado`, o botão diz "Filtros e opções".
- `rotuloPeriodo(v)` traduz o valor de `#periodo` em nome curto com o gênero certo da unidade (`últimas 2 semanas`, `último dia`, `este mês`). É o rótulo sem datas; o com datas é `estado.rotulo`, que aparece no resumo.
- `filtros(abrir)` alterna a classe e o `aria-expanded` do botão. Um listener no `document` fecha o painel no clique fora (`e.target.closest('#f, #filtrosToggle')`) e no Esc.
- `#status` e `#prox` vivem **fora** do formulário, logo abaixo da barra: com o painel fechado eles são o único sinal de que a busca anda. `#status` tem `role="status"`, então leitor de tela anuncia "Buscando…" e os erros.
- A lista de partidas recolhe em qualquer largura (`body.listaAberta`), não só no celular.

## Decisões

- **Documento, não painel.** A grade antiga era `300px 1fr 440px`: numa tela de 1600 px, 804 px fixos para configuração e histórico bruto, e o relatório — a promessa da tela inicial — dividia o resto. Em coluna única o conteúdo ganha a largura toda.
- **Filtros atrás de um clique em toda largura.** O formulário é "configura uma vez, lê muito"; 300 px permanentes de controles cobravam aluguel caro. O padrão já existia em telas até 1100 px (`#filtrosToggle`) — subiu para o desktop em vez de inventar outro.
- **A barra é rótulo, não só botão.** "☰ Filtros e opções" não dizia o que estava na tela. Com os filtros escondidos, alguma coisa precisa responder "de quem e de quando são estes números".
- **A página rola.** `html,body{overflow:hidden}` com cada seção rolando por dentro era o que um painel de transmissão precisa. Sem ele, some junto a família de `min-height:0` / `max-height:100%` que existia só para sustentar a casca.

## Limites

- O painel de filtros cobre o conteúdo: em telas muito baixas ele rola por dentro (`max-height:calc(100vh - 80px)`).
- A barra não mostra as modalidades marcadas nem os filtros de bot/comparação — só nick, modalidade em foco e período. Para o resto, abrir o painel.

## Como testar

`tests/periodo.test.js` cobre `rotuloPeriodo`. O resto é roteiro manual: buscar, conferir o rótulo da barra, trocar de aba de modalidade (o rótulo acompanha), abrir e fechar o painel pelos três caminhos (botão, clique fora, Esc), e conferir que buscar fecha o painel sozinho. Em 375 px de largura, o painel ocupa a tela toda e a lista continua recolhida.
