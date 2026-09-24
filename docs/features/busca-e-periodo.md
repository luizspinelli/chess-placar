# Busca na API e período analisado

**Arquivos**: `js/busca.js` (`buscar`, `agendar`, nicks recentes) · `js/periodo.js` (`periodo`, `aplicarPeriodo`) · `js/base.js` (`getJSON`, `ehBot`)

## Objetivo

Trazer as partidas de um jogador do Chess.com para um recorte de tempo escolhido, com a variação de rating certa, e manter o placar atualizado enquanto ele joga.

## Como usar

Informe o nick e escolha o período. **Relativo**: atalhos de dias (1, 3, 7, 14, 30), meses (3, 6, 12), calendário (hoje, mês em curso, mês anterior, ano) ou uma duração livre (número + dias/semanas/meses). **Absoluto**: data e hora de início, fim opcional. Marque as modalidades (bullet, blitz, rápida, diária). **Buscar partidas** faz a busca; a caixa "Atualizar a cada" mantém o placar em dia (30 s a 5 min).

Nicks já usados ficam como chips abaixo do campo (até 10; × remove). O formulário é um painel atrás da barra de contexto e se fecha sozinho ao buscar — ver [layout](layout.md). O botão "Veja um exemplo" da tela inicial busca `hikaru`.

A **tela inicial** (`#inicio`) mostra em vez de só descrever: abaixo do campo do nick há uma miniatura do relatório de uma página desenhada em CSS (cabeçalho com blocos de números, diagnóstico e as três colunas coloridas — `.amostra`, sem imagem nem dado real, seguindo o tema), três argumentos em uma linha cada (motor Stockfish no navegador, relatório com plano exportável em PDF, sem servidor próprio) e um rodapé com o código e as licenças. Decisão: reforçar essa tela em vez de criar uma landing page à parte — quem chega com o próprio nick quer digitar e ver em cinco segundos, e uma página extra seria mais uma coisa a manter; uma captura de tela do perfil de exemplo foi descartada porque envelhece a cada mudança de layout, enquanto a miniatura em CSS acompanha a interface. No celular as colunas da miniatura empilham. Como a seção passou a ser mais alta que a viewport em telas baixas (notebook de 768 px), a página rola em vez de cortar o conteúdo. O argumento da privacidade diz `Sem servidor próprio` e não "nada sai da sua máquina": com a análise de IA ligada, o prompt vai do navegador para o provedor escolhido. A mensagem de erro da busca entra depois do link do exemplo (`.exemplo`), não no fim da seção, senão nasceria abaixo da miniatura e do rodapé.

## Como funciona

- `periodo()` devolve `[início, fim]` a partir do valor do input escondido `#periodo`: `ano` (1º de janeiro), `hoje` (meia-noite de hoje), `mes` (dia 1º), `mes-1` (mês anterior inteiro), `Nd`/`Nw` (**rolling**: N dias ou semanas contados a partir de agora, com hora), `Nm` (dia 1º de N−1 meses atrás), `custom` (campos de data/hora). Os atalhos só escrevem nesse input via `aplicarPeriodo`, para que `periodo()`, `periodoAnterior()`, `chaveBusca()` e `linkAtual()` continuem lendo um lugar só.
- `buscar` é uma orquestração em cinco funções: `lerFormulario` (lê e valida; sem dados válidos, a mensagem vai para o status e nada é buscado), `mesesDaJanela` (quais arquivos mensais cobrem a janela), `baixarMeses`, `montarPartidas` (a parte pura: filtra, calcula variação de rating, agrega — sem rede nem DOM) e `renderAbasModalidade`. Lê `/games/archives` e baixa os arquivos mensais do período **um por vez** — a API do Chess.com rejeita chamadas paralelas. Baixa também o **mês anterior ao início**: a variação de rating de uma partida é a diferença para a partida ranqueada anterior da mesma modalidade (`g.delta`), e a primeira partida do período precisa de referência.
- `getJSON` guarda cada resposta num `Map` em memória com o ETag e manda `If-None-Match`; 304 reaproveita. Em 429 ou 5xx tenta de novo até 3 vezes com espera crescente (1,5 s, 3 s, 6 s). Na atualização automática só o último mês é rebaixado; os anteriores vêm do cache.
- Por padrão ficam fora: partidas **não ranqueadas** e partidas contra **bots** (`ehBot`: adversário sem `uuid` ou nick que casa com `BOT`). O número de ignoradas aparece ao lado do aproveitamento. A caixa "Ignorar bots e amistosas" desliga o filtro.
- O resultado vira o objeto global `estado` (`{jogos, antes, depois, nick, rotulo, perfil, stats, comp, evolucao, …}`), e `render()` desenha tudo a partir dele. Perfil e stats do jogador vêm em duas chamadas à parte, que falham em silêncio.
- **Atualização automática** (`agendar`): um `setTimeout` para a próxima busca e uma barra com contagem regressiva. Com a aba escondida o timer para; ao voltar, busca na hora.
- Se não há partidas no período e o monitoramento está ligado, não é erro: o placar fica zerado esperando a primeira.

## Decisões

- **Rolling com hora, não a partir da meia-noite.** "Últimos 7 dias" às 19h inclui a sessão de sete dias atrás à noite; snapping para meia-noite cortaria justamente as partidas que o jogador quer ver. Já `Nm` começa no dia 1º porque "3 meses" em xadrez casual é lido como calendário.
- **Um input escondido em vez do `<select>`.** Os atalhos (grade de botões + duração livre) não cabem num select; trocar a UI sem trocar a fonte de verdade manteve as outras funções intactas.
- **`montarPartidas` separada e pura.** A função que decide o que entra no período, o que é comparação e qual é o `delta` de cada partida é a regra de negócio mais importante do app; isolada de rede e DOM, dá para testá-la com uma lista de partidas em memória. A quebra foi validada comparando o `estado` gerado antes e depois com as mesmas partidas, em cinco cenários (busca com comparação, sem partidas, sem comparação, restauração do cache, atualização automática).
- **404 ambíguo.** A API responde 404 tanto para nick inexistente quanto quando bloqueia por excesso de requisições. Se o nick já funcionou antes (está em `estado` ou nos recentes), a mensagem é de bloqueio, não de nick errado.

## Limites

- A API atualiza o arquivo mensal com alguns instantes de atraso após o fim da partida.
- Períodos longos com comparação ligada podem chegar a 25 requisições sequenciais; a barra de status mostra o progresso, mas não há cancelamento.
- Chess960 e outras variantes entram na contagem (campo `rules`), mas o motor de análise as pula.

## Como testar
Automatizado: `tests/periodo.test.js` (atalhos, absoluto, `periodoAnterior`) e `tests/busca.test.js` (`mesesDaJanela`, `montarPartidas` — delta pela ranqueada anterior, bots fora —, `ehBot`).

Buscar um nick real com `7d`, `3m`, `ano` e um período absoluto; conferir que a variação de rating da primeira partida do período não é `null` (o mês anterior foi lido). Ligar a atualização automática e verificar a contagem regressiva e a pausa com a aba escondida. Sem rede para a API, interceptar `https://api.chess.com/**` com Playwright e servir partidas sintéticas (ver AGENTS.md).
