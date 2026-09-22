# Busca na API e período analisado

**Arquivos**: `js/busca.js` (`buscar`, `agendar`, nicks recentes) · `js/periodo.js` (`periodo`, `aplicarPeriodo`) · `js/base.js` (`getJSON`, `ehBot`)

## Objetivo

Trazer as partidas de um jogador do Chess.com para um recorte de tempo escolhido, com a variação de rating certa, e manter o placar atualizado enquanto ele joga.

## Como usar

Informe o nick e escolha o período. **Relativo**: atalhos de dias (1, 3, 7, 14, 30), meses (3, 6, 12), calendário (mês em curso, mês anterior, ano) ou uma duração livre (número + dias/semanas/meses). **Absoluto**: data e hora de início, fim opcional. Marque as modalidades (bullet, blitz, rápida, diária). **Buscar partidas** faz a busca; **Monitorar a partir de agora** fixa o início no momento atual e liga a atualização automática (30 s a 5 min).

Nicks já usados ficam como chips abaixo do campo (até 10; × remove). O botão "Veja um exemplo" da tela inicial busca `hikaru`.

## Como funciona

- `periodo()` devolve `[início, fim]` a partir do valor do input escondido `#periodo`: `ano` (1º de janeiro), `mes` (dia 1º), `mes-1` (mês anterior inteiro), `Nd`/`Nw` (**rolling**: N dias ou semanas contados a partir de agora, com hora), `Nm` (dia 1º de N−1 meses atrás), `custom` (campos de data/hora). Os atalhos só escrevem nesse input via `aplicarPeriodo`, para que `periodo()`, `periodoAnterior()`, `chaveBusca()` e `linkAtual()` continuem lendo um lugar só.
- `buscar` lê `/games/archives` e baixa os arquivos mensais do período **um por vez** — a API do Chess.com rejeita chamadas paralelas. Baixa também o **mês anterior ao início**: a variação de rating de uma partida é a diferença para a partida ranqueada anterior da mesma modalidade (`g.delta`), e a primeira partida do período precisa de referência.
- `getJSON` guarda cada resposta num `Map` em memória com o ETag e manda `If-None-Match`; 304 reaproveita. Em 429 ou 5xx tenta de novo até 3 vezes com espera crescente (1,5 s, 3 s, 6 s). Na atualização automática só o último mês é rebaixado; os anteriores vêm do cache.
- Por padrão ficam fora: partidas **não ranqueadas** e partidas contra **bots** (`ehBot`: adversário sem `uuid` ou nick que casa com `BOT`). O número de ignoradas aparece ao lado do aproveitamento. A caixa "Ignorar bots e amistosas" desliga o filtro.
- O resultado vira o objeto global `estado` (`{jogos, antes, depois, nick, rotulo, perfil, stats, comp, evolucao, …}`), e `render()` desenha tudo a partir dele. Perfil e stats do jogador vêm em duas chamadas à parte, que falham em silêncio.
- **Atualização automática** (`agendar`): um `setTimeout` para a próxima busca e uma barra com contagem regressiva. Com a aba escondida o timer para; ao voltar, busca na hora.
- Se não há partidas no período e o monitoramento está ligado, não é erro: o placar fica zerado esperando a primeira.

## Decisões

- **Rolling com hora, não a partir da meia-noite.** "Últimos 7 dias" às 19h inclui a sessão de sete dias atrás à noite; snapping para meia-noite cortaria justamente as partidas que o jogador quer ver. Já `Nm` começa no dia 1º porque "3 meses" em xadrez casual é lido como calendário.
- **Um input escondido em vez do `<select>`.** Os atalhos (grade de botões + duração livre) não cabem num select; trocar a UI sem trocar a fonte de verdade manteve as outras funções intactas.
- **404 ambíguo.** A API responde 404 tanto para nick inexistente quanto quando bloqueia por excesso de requisições. Se o nick já funcionou antes (está em `estado` ou nos recentes), a mensagem é de bloqueio, não de nick errado.

## Limites

- A API atualiza o arquivo mensal com alguns instantes de atraso após o fim da partida.
- Períodos longos com comparação ligada podem chegar a 25 requisições sequenciais; a barra de status mostra o progresso, mas não há cancelamento.
- Chess960 e outras variantes entram na contagem (campo `rules`), mas o motor de análise as pula.

## Como testar

Buscar um nick real com `7d`, `3m`, `ano` e um período absoluto; conferir que a variação de rating da primeira partida do período não é `null` (o mês anterior foi lido). Ligar a atualização automática e verificar a contagem regressiva e a pausa com a aba escondida. Sem rede para a API, interceptar `https://api.chess.com/**` com Playwright e servir partidas sintéticas (ver CLAUDE.md).
