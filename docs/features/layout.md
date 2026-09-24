# Layout: painel de altura fixa, barra de contexto e três colunas

**Arquivos**: `index.html` (`#contexto`, `#f`, `.faixa`, `#colDiag`) · `css/estilo.css` (`main`, `#contexto`, `form`, media queries) · `js/busca.js` (`renderContexto`, `filtros`) · `js/periodo.js` (`rotuloPeriodo`)

## Objetivo

Mostrar o período inteiro numa tela só: a janela do navegador é o quadro, e nada dele fica fora. A página **nunca rola** — quem rola são as colunas, cada uma por dentro.

## Como usar

O topo mostra uma barra com **nick · modalidade · período** (`hikaru · rápida · últimos 7 dias`). Clicar nela abre o painel de filtros por cima do conteúdo; buscar, clicar fora ou Esc fecham. Ao lado ficam **Copiar link** e o seletor de tema.

Abaixo, o **cabeçalho** numa faixa horizontal: perfil, abas de modalidade, placar (vitórias, empates, derrotas, variação de rating), aproveitamento, comparativo e o gráfico de rating. E então três colunas lado a lado: **Diagnóstico** (resumo em números + achados + bloco da IA), **Evidência** (abas de indicadores) e **Partidas**.

## Como funciona

- `html,body{height:100%;overflow:hidden}` e `main` com `height:100%;width:100%` — a casca ocupa a viewport exata.
- A grade tem quatro linhas (`auto auto auto minmax(0,1fr)`) e três colunas: `"ctx ctx ctx" "st st st" "cab cab cab" "diag evid part"`. Só a última linha é elástica; o `minmax(0,1fr)` combinado com `min-height:0` nos filhos é o que faz as colunas recortarem em vez de esticar a página.
- Cada coluna rola sozinha: `#colDiag` (`overflow-y:auto`), `#kpiGrid` e `#lista`.
- `.faixa` é o cabeçalho horizontal: `.tally` de largura fixa, `.placarInfo` elástica no meio e `#resumoGrafico` de largura fixa à direita. As células do tally são flex centradas — sem isso os números ficam no topo e sobra um vazio embaixo, porque a faixa é mais alta que eles.
- O `<form>` é `position:absolute` ancorado sob a barra e só aparece com `filtrosAbertos` no `body`. Sobrepor em vez de empurrar mantém a posição de leitura.
- `renderContexto()` monta o rótulo da barra a partir de `estado.nick`, `TIPO[aba]` e `rotuloPeriodo()`; roda no início de `render()`. Sem `estado`, o botão diz "Filtros e opções".
- `rotuloPeriodo(v)` traduz o valor de `#periodo` em nome curto com o gênero certo (`últimas 2 semanas`, `último dia`, `este mês`, `hoje`). O rótulo com datas é `estado.rotulo`.
- `filtros(abrir)` alterna a classe e o `aria-expanded`. Um listener no `document` fecha no clique fora (`e.target.closest('#f, #filtrosToggle')`) e no Esc.
- `#status` tem `role="status"`: com o painel fechado é o único sinal de que a busca anda, e leitor de tela o anuncia.
- O gráfico de rating vive na faixa do cabeçalho, **fora** do `#resumo`. Por isso o listener que abre o modal está em `#placar`, não em `#resumo`, e `renderResumo` limpa `#resumoGrafico` quando não há partidas.

## Decisões

- **Painel, não documento.** A janela é o quadro: tudo que importa cabe nela, e a leitura acontece dentro das colunas. Uma página que rola esconde metade do diagnóstico atrás de um gesto.
- **Cabeçalho enxuto é orçamento, não estética.** Cada pixel dele sai das três colunas. Barra (38 px) + cabeçalho (≈205 px) + gaps = ~279 px fixos; num notebook de 768 px sobram ~489 px para as colunas. Foi por isso que o tally caiu para `1.55rem`, o perfil para `7px` de padding e o sparkline para `88px`.
- **Filtros atrás de um clique.** O formulário é "configura uma vez, lê muito"; 300 px permanentes de controles cobravam aluguel caro numa tela que não rola.
- **A barra é rótulo, não só botão.** Com os filtros escondidos, alguma coisa precisa responder "de quem e de quando são estes números".
- **O botão de ampliar o gráfico é só o ícone no cabeçalho.** Na faixa estreita ele competia com os números; o rótulo "Ampliar" continua no DOM (`.rotAmpliar`, escondido por `clip-path`) para leitor de tela.
- **O celular é a exceção declarada.** Abaixo de 1100 px a premissa de altura fixa não cabe: a grade vira coluna única, a página rola e a lista de partidas volta a ser recolhível (`#listaToggle`). Três colunas com 390 px de largura não é layout, é maquete.

## Limites

- A premissa de "sem scroll de página" vale a partir de 1101 px. Abaixo disso a página rola.
- Em telas muito baixas (< 600 px de altura) as três colunas ficam com pouca área útil; o conteúdo continua acessível, mas com muita rolagem interna.
- O painel de filtros rola por dentro quando não cabe (`max-height:calc(100vh - 80px)`).
- A barra não mostra as modalidades marcadas nem os filtros de bot/comparação — só nick, modalidade em foco e período.

## Como testar

`tests/periodo.test.js` cobre `rotuloPeriodo`. O resto é roteiro manual, e a API pode estar bloqueada no ambiente (403) — nesse caso, servir uma cópia do `index.html` com um stub de `fetch` devolvendo partidas sintéticas (ver `AGENTS.md`).

Conferir, com o console aberto: a página não rola em nenhum eixo (`document.documentElement.scrollHeight === clientHeight`); as três colunas rolam por dentro; o rótulo da barra acompanha a troca de aba de modalidade; o painel abre e fecha pelos três caminhos; o "⤢" do cabeçalho abre o modal do gráfico; trocar de aba de evidência **não** apaga o que estiver digitado no campo da chave da IA. Em 390 px de largura, coluna única com a lista recolhida.
