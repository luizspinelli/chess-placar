# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

Painel que lê a API pública do Chess.com e mostra placar, indicadores e análise de um jogador. App estático em JS vanilla: `index.html` (só a marcação), `css/estilo.css` e onze arquivos em `js/`, um por domínio. **Sem servidor, sem build, sem dependências, sem framework** — decisão de design, não dívida. Não sugerir bundler, ES modules, framework ou libs: os scripts são clássicos (`<script src>`) justamente para o app continuar abrindo via `file://` (o Chrome bloqueia módulos ES nesse esquema).

Acessórios: `og.png` é a imagem de preview de link (Open Graph) e `og-card.html` é o fonte dela — abrir no navegador, capturar 1470×772 e redimensionar para 1200×630.

## Arquivos e ordem de carga

Os scripts compartilham o escopo global: `let`/`const` de topo de um arquivo são visíveis nos seguintes. A ordem só importa para o que **executa durante a carga** (listeners, `renderNicks()`, o bloco de bootstrap); chamadas em tempo de execução alcançam qualquer função de qualquer arquivo. Ao criar um arquivo, incluí-lo no `index.html` na posição certa e manter `app.js` por último.

| Arquivo | Responsabilidade |
|---|---|
| `js/base.js` | Constantes (`API`, `DRAWS`, `TIPO`, `MOTIVO`), helpers de formatação (`fmt*`, `sinal`, `cls`, `seg`, `numerar`, `escHtml`) e de HTML (`card`, `tabela`, `kv`, `linha`, `conta`), `getJSON` com cache por ETag e retry, `lerLS`/`gravarLS` e o estado global (`estado`, `aba`, `kpiData`, `iaTexto`…) |
| `js/periodo.js` | `periodo()`, `aplicarPeriodo`, `periodoAnterior`, `comparaAuto`, `evolucaoDoPeriodo` |
| `js/aberturas.js` | `parsePGN`, `fenDaAbertura` e o modal do tabuleiro (`abrirAbertura`) |
| `js/indicadores.js` | `kpis()`, `GLOSSARIO`, `sparkline`, `renderKpis` e as abas de KPI |
| `js/grafico.js` | Modal do gráfico de rating ampliado (`desenharModal`, zoom/pan em SVG, `vista`) |
| `js/ia.js` | `PROVEDORES`, chaves, `blocoIA`, `resumoParaIA`, `dossiePartidas`, os dois prompts, `executarIA`, `mdParaHtml`, `exportarPDF` |
| `js/partidas.js` | Lista de partidas: `renderLista`, paginação, filtro por adversário, CSV |
| `js/overlay.js` | Modo streamer/OBS: `renderOverlay`, `modoStreamer` |
| `js/placar.js` | `render()`, `renderResumo`, `renderPerfil`, `renderComparativo`, abas de modalidade |
| `js/busca.js` | `buscar()`, `agendar`, nicks recentes, `salvarUltima`/`carregarUltima`, listeners do formulário |
| `js/app.js` | Tema, modo simples/avançado, `linkAtual` e o bootstrap dos parâmetros de URL. **Sempre o último.** |

Onde algo novo entra: helper usado por dois ou mais domínios vai para `base.js`; listener fica junto do que ele aciona; estado que mais de um arquivo lê fica declarado em `base.js`. `indicadores.js` e `ia.js` são os maiores — se um deles crescer mais, o passo seguinte é extrair as seções de `kpis()` em funções, não criar um arquivo genérico.

## Desenvolvimento

- **Rodar**: abrir `index.html` no navegador (funciona via `file://`). Não há build nem lint; `node --check js/arquivo.js` confere sintaxe.
- **Testar**: não há suíte automatizada. Usar um nick real (ex.: `?nick=hikaru`) ou o botão "Veja um exemplo". Depois de mexer em código compartilhado, percorrer: tela inicial → busca → as dez abas de KPI → modal do gráfico → modal da abertura → modo simples → streamer (`?streamer=1&overlay=ticker`) → largura de celular, com o console aberto. Se a API estiver bloqueada no ambiente, dá para interceptar `https://api.chess.com/**` com Playwright e servir partidas sintéticas (com `pgn`, `time_control`, `uuid` nos dois jogadores e `accuracies`) — foi assim que as últimas mudanças foram validadas.
- Idioma: UI, identificadores, comentários e commits em **português**. Estilo denso (várias declarações por linha, arrow functions curtas) — seguir o estilo existente.
- Parâmetros de URL estão documentados na tabela do README; todo filtro novo do formulário entra em `linkAtual()`, no bootstrap de `app.js` e nessa tabela.

## Fluxo principal

1. **`buscar(atualizacao)`** (`js/busca.js`) — orquestra tudo: resolve o período, baixa os arquivos mensais da API **um por vez** (a API do Chess.com não aceita chamadas paralelas), calcula `delta` de rating por diferença entre partidas ranqueadas consecutivas (por isso busca também o mês *anterior* ao início, como referência), filtra bots/amistosas e monta o objeto global **`estado`** `{jogos, antes, depois, nick, rotulo, perfil, stats, comp, evolucao, ...}`. Com **Comparar com período anterior** marcado, a janela de meses baixados começa em `periodoAnterior(...)` e o mesmo passe acumula `estado.comp` — só **agregados por modalidade** (`{n, w, d, l, acc, accN, antes, depois}`), porque o `estado` inteiro vai para o localStorage.
2. **`render()`** (`js/placar.js`) — filtra `estado.jogos` pela aba de modalidade ativa (`aba`) e chama os renderizadores: `renderLista`, `renderKpis`, `renderResumo`, `renderPerfil`, `renderOverlay`.
3. **`kpis(jogos, nick)`** (`js/indicadores.js`) — o coração analítico: uma passada pelas partidas gera o HTML de todas as abas (Resultados, Rating, Aberturas, Precisão, Sessões, etc.) num objeto `{nomeAba: html}` guardado em `kpiData`. Também produz os "achados automáticos" (heurísticas com limiares mínimos de amostra). Quando existe `estado.comp`, quatro desses achados comparam o período com o anterior (aproveitamento, rating, precisão, volume) — todos exigem 15+ partidas dos dois lados, porque só os agregados estão disponíveis. Popula `curvaDados` (série de rating por modalidade), usada pelo gráfico ampliado (`desenharModal`, em `js/grafico.js`).

## Por domínio

### Período (`js/periodo.js`)

- O `<select>` virou `<input type="hidden" id="periodo">` alimentado pelos atalhos (`aplicarPeriodo`), justamente para que `periodo()`, `periodoAnterior()`, `chaveBusca()` e `linkAtual()` sigam lendo `$('periodo').value`. Valores: `ano`, `mes`, `mes-1`, `Nd`/`Nw` (rolling, a partir de agora), `Nm` (a partir do dia 1º) e `custom`. Ao adicionar um formato novo, tratar em `periodo()`, em `periodoAnterior()` **e** em `evolucaoDoPeriodo()`.
- **Período anterior**: nos recortes de calendário é o bloco completo anterior (mês em curso × mês anterior inteiro); nos rolling e no personalizado, a mesma duração imediatamente antes.
- **Comparação automática**: `aplicarPeriodo` marca o checkbox `comparar` sozinho quando `comparaAuto(v)` (recorte relativo de até ~190 dias; o ano inteiro fica de fora porque seriam 12 arquivos mensais só para o comparativo). A flag `comparManual` guarda o momento em que o usuário mexe na caixa e desliga o automático dali em diante; por isso `linkAtual()` grava `comparar=0` quando o automático valeria e a caixa está desmarcada.
- **Evolução dentro do período** (`evolucaoDoPeriodo`): quebra o recorte nos blocos da própria unidade do atalho (`4w` → 4 semanas, `3m` → 3 meses de calendário, `5d` → 5 janelas de 24 h) e guarda `{titulo, blocos:[{ini, fim, rotulo}]}` em `estado.evolucao`, calculado sobre a janela realmente buscada — nunca sobre o valor atual do formulário, que pode ter mudado depois. Acima de 12 blocos agrupa (`passo = ceil(n/12)`). `kpis()` acumula os blocos na mesma passada dos Resultados e monta o primeiro card da aba; o último bloco fica aberto à direita porque a atualização automática traz partidas depois do fim calculado na busca.

### PGN e aberturas (`js/aberturas.js`)

- **`parsePGN(g)`** extrai abertura (do header ECOUrl), todos os lances (`san`) e relógios (`clks`) do PGN; memoizado em `g._pgn`. `linhaPrincipal` só olha os 12 primeiros lances; o dossiê da IA usa o resto.
- **`fenDaAbertura(san)`** aplica lances SAN sobre a posição inicial e devolve o FEN, usado só para montar a imagem do tabuleiro (`chess.com/dynboard?fen=`, o **único** recurso de terceiros do app). Resolve só o necessário para saber quem se moveu: com duas peças alcançando a casa, descarta a que deixaria o próprio rei em xeque (cravada — comum em `Bb5+ Nd7` seguido de `Nf6`); se ainda sobrar dúvida devolve `''` e o modal mostra o aviso em vez de uma posição errada. Foi validado contra FENs de referência (roque curto e longo, en passant, promoção, captura de peão, desambiguação por coluna); ao mexer nele, conferir esses casos de novo — um erro aqui mostra uma posição plausível e errada, que é pior que não mostrar.
- A sequência exibida no modal é a **linha mais jogada** do grupo (`linhaPrincipal`, em `indicadores.js`), não o prefixo comum: a mesma abertura chega por ordens de lance diferentes e o prefixo colapsa em 1-2 lances. Ela é cortada em `profundidade(url)`: o slug do Chess.com termina nos lances que nomeiam a variante (`-3...Qa5` = até o 3º lance das pretas), e é até aí que a posição ainda define a abertura — sem esses números, 5 meias-jogadas, com teto de 8.

### Análise com IA (`js/ia.js`)

- **`PROVEDORES`** (Gemini, Groq, Claude, OpenAI), chave do usuário. Para adicionar um provedor basta uma entrada nesse objeto: `nome`, `link`, `padrao`, `reserva`, `filtro`, `listar` e `chamar` — o seletor, o storage da chave e o fallback de modelos são genéricos. Armadilhas já resolvidas: os modelos atuais da Anthropic rejeitam `temperature` (400) e exigem o header `anthropic-dangerous-direct-browser-access` para CORS; a OpenAI exige `max_completion_tokens` no lugar de `max_tokens` nos modelos de raciocínio.
- **`executarIA(montarPrompt)`** valida a chave, monta o prompt, tenta o modelo escolhido e cai para os reservas. Há dois prompts:
  - `promptIndicadores` — dados de `resumoParaIA`, que **omite deliberadamente** linhas com poucas partidas e abas sensíveis em amostras curtas; preservar isso ao mexer.
  - `promptPartidas` — dados de `dossiePartidas`: as últimas `N_DOSSIE` = 100 partidas da modalidade, uma linha cada com os 15 primeiros lances, marcos lidos do texto do SAN (roque, primeira captura, dama cedo, xeques) e uso do relógio (~15k tokens). O dossiê **não simula o tabuleiro** e o prompt **proíbe a IA de afirmar erro em lance específico** — sem motor isso seria alucinação com cara de análise. Ao mexer no prompt, manter essa proibição.
- Como `salvarUltima` descarta o `pgn`, o dossiê só existe após uma busca real: numa restauração do cache `dossiePartidas` lança erro pedindo para buscar de novo.
- A resposta da IA passa por `mdParaHtml`, que escapa HTML — não renderizar markdown da IA por outro caminho.

### Persistência

- **localStorage** — todas as chaves com prefixo `placar-chesscom:` (nicks recentes, tema, modo, chaves de IA, última busca). Acessos sempre em try/catch via `lerLS`/`gravarLS`.
- **`salvarUltima`** grava o `estado` inteiro menos `pgn`, `tcn`, `fen` e `initial_setup` de cada partida (a cota estouraria). Por isso tudo que entra em `estado` deve ser pequeno — agregados, não listas de partidas — e nada que dependa dos lances pode contar com a restauração do cache.

### Streamer/OBS (`js/overlay.js`)

Classe `streamer` no body + `renderOverlay()`; layouts controlados por `data-ov`. Sai com Esc ou pelo botão.

## Convenções

- Resultado de partida é sempre `'w' | 'd' | 'l'`; empates definidos pelo Set `DRAWS`.
- Helpers de HTML (`card`, `tabela`, `kv`, `linha`) montam os cartões de KPI; `card` acrescenta o "?" de ajuda quando o título começa com uma chave de `GLOSSARIO` — todo card novo com conceito não óbvio ganha um verbete lá.
- `resumoParaIA` lê os cards genericamente (primeiras duas células de cada `<tr>`); uma linha de cabeçalho de coluna deve ter a primeira célula vazia para ser ignorada.

## Cuidados

- Dados da API entram no DOM via `innerHTML` em vários pontos; campos de texto livre (nome de perfil, aberturas, nick do adversário) devem ser escapados com `escHtml` ao adicionar renderização nova.
- O único recurso externo é a imagem do tabuleiro; não adicionar scripts nem fontes de terceiros — a privacidade da chave de IA depende disso.
- A API do Chess.com responde 404 também quando bloqueia por excesso de requisições; `buscar` distingue pelo nick já ter funcionado antes. Não paralelizar chamadas.
