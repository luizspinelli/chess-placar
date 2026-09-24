# Layout: painel de altura fixa, barra de contexto e duas colunas

**Arquivos**: `index.html` (`#contexto`, `#f`, `.faixa`, `#modalAnalise`) · `css/estilo.css` (`main`, `#contexto`, `form`, media queries) · `js/busca.js` (`renderContexto`, `filtros`) · `js/periodo.js` (`rotuloPeriodo`)

## Objetivo

Mostrar o período inteiro numa tela só: a janela do navegador é o quadro, e nada dele fica fora. A página **nunca rola** — quem rola são as colunas, cada uma por dentro.

## Como usar

O topo mostra uma barra com **nick · modalidade · período** (`hikaru · rápida · últimos 7 dias`). Clicar nela abre o painel de filtros por cima do conteúdo; buscar, clicar fora ou Esc fecham. Ao lado ficam **Copiar link** e o seletor de tema.

Ao lado do rótulo, o botão **Diagnóstico** — que leva o sinal do achado mais grave (▲ vermelho, ● âmbar, ✔ verde) e a contagem — abre o relatório em tela cheia.

Abaixo, o **cabeçalho** numa faixa horizontal: perfil, abas de modalidade, placar, aproveitamento, comparativo, os quatro mini-cards (forma recente, brancas × pretas, sequência, ritmo) e o gráfico de rating. E então duas colunas: **Evidência** (abas de indicadores) e **Partidas**.

## Como funciona

- `html,body{height:100%;overflow:hidden}` e `main` com `height:100%;width:100%` — a casca ocupa a viewport exata.
- A grade tem quatro linhas (`auto auto auto minmax(0,1fr)`) e duas colunas: `"ctx ctx" "st st" "cab cab" "evid part"`. Só a última linha é elástica; o `minmax(0,1fr)` combinado com `min-height:0` nos filhos é o que faz as colunas recortarem em vez de esticar a página.
- Cada coluna rola sozinha: `#kpiGrid` e `#lista`.
- A coluna de **Partidas recolhe** (`body.listaAberta`): fechada, ela sai da faixa e vira uma linha no rodapé, e a grade passa a duas colunas — numa tela de 1920 px a Evidência vai de 1349 px para 1884 px. O bootstrap liga `listaAberta` acima de 1100 px de largura; no celular ela começa recolhida, como sempre.
- O **Diagnóstico vive dentro de `#modalAnalise`** o tempo todo: `analiseFullscreen(abrir)` só alterna a classe `aberto`, põe o foco no ✕ ao abrir e o devolve ao botão ao fechar. Fecha no ✕, no clique no fundo e no Esc.
- `renderAnalise()` **refaz `#analiseCorpo` por `innerHTML`**, e `render()` a chama a cada ciclo da atualização automática — o campo da chave da IA está dentro desse bloco. Por isso a função grava a chave digitada (`gravarChave`) **antes** de refazer: é a mesma proteção que os outros pontos de re-render já usavam. Não confundir com "a chave não corre risco": ela corre, e é esse `gravarChave` que a salva.
- Os controles do Diagnóstico (`iaAnalisar`, `iaPdf`, `motorBtn`…) são delegados a partir de `#analiseCorpo`, não de `#kpiGrid`. `tests/delegacao.test.js` trava isso: quando o bloco mudou de nó e os listeners ficaram para trás, a feature inteira virou enfeite com os testes verdes.
- `renderBotaoDiag()` monta o botão da barra a partir de `kpiData['Análise']`: parseia os `.achado`, pega o mais grave na ordem alerta → atenção → bom (`SINAIS`) e usa a classe dele para colorir a borda e o sinal.
- `.faixa` é o cabeçalho horizontal: `.tally` de largura fixa, `.placarInfo` elástica, `#resumo` (os quatro mini-cards) elástico e `#resumoGrafico` de largura fixa à direita. As células do tally são flex centradas — sem isso os números ficam no topo e sobra um vazio embaixo, porque a faixa é mais alta que eles.
- O `<form>` é `position:absolute` ancorado sob a barra e só aparece com `filtrosAbertos` no `body`. Sobrepor em vez de empurrar mantém a posição de leitura.
- `renderContexto()` monta o rótulo da barra a partir de `estado.nick`, `TIPO[aba]` e `rotuloPeriodo()`; roda no início de `render()`. Sem `estado`, o botão diz "Filtros e opções".
- `rotuloPeriodo(v)` traduz o valor de `#periodo` em nome curto com o gênero certo (`últimas 2 semanas`, `último dia`, `este mês`, `hoje`). O rótulo com datas é `estado.rotulo`.
- `filtros(abrir)` alterna a classe e o `aria-expanded`. Um listener no `document` fecha no clique fora (`e.target.closest('#f, #filtrosToggle')`) e no Esc.
- `#status` tem `role="status"`: com o painel fechado é o único sinal de que a busca anda, e leitor de tela o anuncia.
- O gráfico de rating vive na faixa do cabeçalho, **fora** do `#resumo`. Por isso o listener que abre o modal está em `#placar`, não em `#resumo`, e `renderResumo` limpa `#resumoGrafico` quando não há partidas.

## Decisões

- **Painel, não documento.** A janela é o quadro: tudo que importa cabe nela, e a leitura acontece dentro das colunas.
- **O diagnóstico é modal, não coluna.** Numa coluna ele tinha ~485 px e roubava largura da Evidência o tempo todo, para um conteúdo que se lê de vez em quando. Em tela cheia tem ~1870 px e os achados ficam em três colunas. O preço é um clique — pago pelo botão da barra, que já diz que há algo a ver.
- **O botão do diagnóstico carrega o sinal.** Um botão neutro escrito "Diagnóstico" não convida, e o relatório é a promessa da tela inicial. Com "▲ Diagnóstico 7" em vermelho, a tela diz que achou sete coisas e que uma delas é grave.
- **O resumo em frase saiu.** "72 partidas de blitz, 36 vitórias… 56% de aproveitamento, rating de 1186 para 1270" repetia em prosa exatamente o que o tally e a `.placarInfo` já mostram em números, a 30 cm de distância. Só os quatro mini-cards subiram para a faixa.
- **Cabeçalho enxuto é orçamento, não estética.** Cada pixel dele sai das duas colunas. Barra (38 px) + cabeçalho (≈205 px) + gaps = ~279 px fixos; num notebook de 768 px sobram ~489 px para as colunas. Foi por isso que o tally caiu para `1.55rem`, o perfil para `7px` de padding e o sparkline para `88px`.
- **Filtros atrás de um clique.** O formulário é "configura uma vez, lê muito"; 300 px permanentes de controles cobravam aluguel caro numa tela que não rola.
- **A barra é rótulo, não só botão.** Com os filtros escondidos, alguma coisa precisa responder "de quem e de quando são estes números".
- **O botão de ampliar o gráfico é só o ícone no cabeçalho.** Na faixa estreita ele competia com os números; o rótulo "Ampliar" continua no DOM (`.rotAmpliar`, escondido por `clip-path`) para leitor de tela.
- **O celular é a exceção declarada.** Abaixo de 1100 px a premissa de altura fixa não cabe: a grade vira coluna única, a página rola, a faixa do cabeçalho empilha e a barra de contexto quebra em duas linhas (com três botões ela não cabe em 390 px). Duas colunas com 390 px de largura não é layout, é maquete.

## Limites

- A premissa de "sem scroll de página" vale a partir de 1101 px. Abaixo disso a página rola.
- **A tela inicial é a outra exceção, em qualquer largura.** `html:has(body.inicio),body.inicio{height:auto;overflow:visible}` devolve o scroll enquanto não houve busca, porque a miniatura do relatório passa da viewport num notebook de 768 px de altura (o porquê está em [busca-e-periodo.md](busca-e-periodo.md)). A regra é frágil: ela já saiu uma vez junto com um bloco `@media` removido e a tela inicial voltou a ser cortada — ao mexer no `overflow` global, conferir a tela inicial **antes** do painel.
- Em telas muito baixas (< 600 px de altura) as colunas ficam com pouca área útil; o conteúdo continua acessível, mas com muita rolagem interna.
- O painel de filtros rola por dentro quando não cabe (`max-height:calc(100vh - 80px)`).
- O estado da coluna de Partidas não vai na URL nem fica salvo: é decisão da sessão.
- A barra não mostra as modalidades marcadas nem os filtros de bot/comparação — só nick, modalidade em foco e período.

## Como testar

`tests/periodo.test.js` cobre `rotuloPeriodo`. O resto é roteiro manual, e a API pode estar bloqueada no ambiente (403) — nesse caso, servir uma cópia do `index.html` com um stub de `fetch` devolvendo partidas sintéticas (ver `AGENTS.md`).

Conferir, com o console aberto: a página não rola em nenhum eixo (`document.documentElement.scrollHeight === clientHeight`); as duas colunas rolam por dentro; o botão da barra mostra o sinal do achado mais grave e abre o modal; o rótulo da barra acompanha a troca de aba de modalidade; o painel abre e fecha pelos três caminhos; o "⤢" do cabeçalho abre o modal do gráfico; trocar de aba de evidência **não** apaga o que estiver digitado no campo da chave da IA. Em 390 px de largura, coluna única com a lista recolhida.
