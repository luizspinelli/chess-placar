# Placar Chess.com

**No ar em [chess-placar.vercel.app](https://chess-placar.vercel.app/)** — experimente com um perfil público: [chess-placar.vercel.app?nick=hikaru](https://chess-placar.vercel.app/?nick=hikaru)

Painel que lê a API pública do Chess.com e mostra placar, evolução de rating, indicadores e análise das partidas de um jogador. Site estático em HTML, CSS e JS vanilla: sem servidor, sem build, sem cadastro — tudo roda no navegador.

## O que faz

- **Modo simples**: placar, resumo em três frases, gráfico de rating, forma recente, brancas × pretas, sequência e ritmo.
- **Modo avançado**: dez abas de indicadores (Análise, Resultados, Rating, Aberturas, Lances e relógio, Erros e precisão, Adversários, Sessões, Horários, Volume), com achados automáticos — tilt, diferença entre cores, aberturas problemáticas, derrotas por tempo, rendimento em sessões longas.
- **Evolução dentro do período**: pedindo 4 semanas, 3 meses ou 5 dias, a aba *Resultados* abre com a quebra nos mesmos blocos — semana a semana, mês a mês, dia a dia — com aproveitamento e variação de rating de cada um. Acima de 12 blocos eles são agrupados (30 dias viram 10 blocos de 3 dias).
- **Comparação de períodos**: faixa no placar com partidas, aproveitamento, rating e precisão contra o período anterior — mês em curso × mês anterior inteiro, ano × ano anterior; nos períodos rolling e no personalizado, a mesma duração imediatamente antes. Vem ligada nos períodos relativos de até ~6 meses (desmarcar vale para as buscas seguintes) e entra também nos achados automáticos e na análise com IA.
- **Gráfico interativo**: rating por partida ou por tempo, com zoom, média móvel e link para cada partida.
- **Distribuição por código ECO**: quanto do seu volume cai em cada família da classificação de aberturas (A a E), com o aproveitamento de cada uma.
- **Mapa de calor** dia × hora: onde você joga mais e onde rende melhor, numa grade só.
- **Tabuleiro da abertura**: clique no nome de uma abertura e veja a posição depois dos lances, do seu ponto de vista (invertida quando você joga de pretas).
- **Filtro por adversário**: digite o nick na lista de partidas e veja o retrospecto direto (`12 partidas · 10V 0E 2D`); o CSV respeita o filtro.
- **Motor de análise**: Stockfish 19 rodando no seu navegador (WebAssembly), sem servidor. Avalia lance a lance as últimas 100 partidas da modalidade e classifica os erros pela queda de chance de vitória (critério do Lichess: imprecisão, erro, erro grave). A aba *Erros e precisão* ganha erros por partida, por fase e **por tempo no relógio** — a taxa de erros com menos de 30 s comparada ao resto —, erros graves por abertura, viradas, e o lance em que cada derrota escapou, com link para a partida. Roda em segundo plano (uns 5 s por partida no computador, profundidade ajustável), pode ser interrompido e guarda o resultado no navegador; só as partidas novas custam da próxima vez.
- **Análise com IA**: opcional, com a sua própria chave — Gemini e Groq (tier gratuito) ou Claude e OpenAI (uso cobrado pelo provedor). Um botão: roda o motor nas partidas ainda não avaliadas e envia à IA, numa chamada, o resumo agregado dos indicadores e o dossiê das últimas 100 partidas — 15 primeiros lances, relógio, marcos (roque, primeira captura, dama cedo, xeques) e os erros apontados pelo Stockfish, com o lance que ele preferia. Devolve diagnóstico, o que manter, o que parar de fazer, o que estudar, plano de duas semanas e regras de rotina, adaptados ao seu rating. Sem motor (página aberta como arquivo), o prompt proíbe a IA de apontar erro em lance específico — sem tabuleiro seria chute — e ela fala de repertório, ritmo e relógio.
- **Exportar**: PDF da análise e CSV das partidas.
- **Modo streamer**: só o placar em tela cheia, com fundo transparente ou chroma key, para usar como fonte de navegador no OBS — com meta de rating, ticker e cartão da última partida.

## Uso

Abra [chess-placar.vercel.app](https://chess-placar.vercel.app/) (ou o `index.html` local) e informe o nick. O período tem duas formas: **Relativo**, com atalhos de dias, meses e calendário (ou uma duração livre), e **Absoluto**, com data e hora de início e fim. Tudo que está no formulário pode ir na URL — o botão **Copiar link** gera o endereço completo, útil para favoritos e para o OBS.

## Parâmetros de URL

| Parâmetro | Valores | Descrição |
|---|---|---|
| `nick` | texto | nick no Chess.com (obrigatório para abrir já buscando) |
| `periodo` | `ano` (padrão), `mes`, `mes-1`, `Nd`, `Nw`, `Nm`, `custom` | período analisado: `7d` = últimos 7 dias, `2w` = 2 semanas, `3m` = 3 meses (a partir do dia 1º) |
| `data`, `hora`, `dataFim`, `horaFim` | `YYYY-MM-DD`, `HH:MM` | intervalo do período `custom` (fim opcional) |
| `tc` | `bullet,blitz,rapid,daily` | modalidades consideradas |
| `bots` | `1` | inclui partidas contra bots e amistosas (por padrão ficam fora) |
| `comparar` | `1`, `0` | compara com o período anterior equivalente (dobra as requisições à API); já vem ligado nos períodos relativos de até ~6 meses, e `0` desliga |
| `auto` | `1` | atualização automática |
| `intervalo` | `30`, `60`, `120`, `300` | segundos entre atualizações |
| `modo` | `avancado` | abre no modo avançado |
| `tema` | `claro` | tema claro |
| `streamer` | `1` | modo streamer |
| `overlay` | `placar` (padrão), `compacto`, `ticker` | layout do overlay |
| `meta` | `700` ou `+50` | meta de rating com barra de progresso |
| `fundo` | `00ff00` | cor de fundo do overlay (chroma); vazio = transparente |
| `escala` | `0.8` a `2` | tamanho do overlay |
| `ultima`, `seq` | `0` | esconde o cartão da última partida / a sequência |

Exemplo para o OBS (ticker no rodapé, contando a partir das 20h de hoje, meta de +30 pontos):

```
https://chess-placar.vercel.app/?nick=SEUNICK&periodo=custom&data=2026-09-08&hora=20:00&tc=rapid&streamer=1&overlay=ticker&meta=%2B30
```

## Como funciona

- Lê `https://api.chess.com/pub/player/{nick}/games/archives` e os arquivos mensais do período, um por vez (a API não aceita chamadas paralelas), com cache por ETag.
- A variação de rating é calculada pela diferença entre partidas ranqueadas consecutivas da mesma modalidade; o mês anterior ao início é lido para dar referência à primeira partida.
- Aberturas, lances e relógio vêm do PGN de cada partida, interpretado no navegador. A posição do tabuleiro é calculada localmente a partir dos lances; só a imagem é buscada no Chess.com.
- O motor é o Stockfish 19 (versão lite, 1,8 MB) compilado para WebAssembly, num Web Worker; o chess.js converte os lances para o formato do motor. Tudo roda na sua máquina — nenhuma partida sai do navegador. Precisa que a página venha de um servidor (a versão publicada, ou um servidor estático local): aberta como arquivo, o navegador bloqueia Worker e WASM, e o resto do app segue funcionando.
- A última busca fica salva no navegador **sem os PGNs** (a cota do `localStorage` não comporta) e reaparece na hora na próxima abertura, enquanto a API é consultada de novo. Por isso *Analisar lances* só funciona depois de uma busca real — restaurando do cache, ele pede para buscar de novo.
- Partidas contra bots, treinador ou não ranqueadas são ignoradas por padrão.

## Privacidade

Não há servidor próprio: o navegador fala direto com a API pública do Chess.com. A chave de IA vai direto do seu navegador para o provedor; por padrão fica salva no `localStorage`, e desmarcando **lembrar chave** ela vale só na aba aberta.

O que a análise com IA envia ao provedor:

- o resumo agregado das abas — sem partidas individuais, sem nicks de adversários, e omitindo linhas com poucas partidas;
- para cada uma das últimas 100 partidas, data, cor, resultado, ratings dos dois lados, abertura, os 15 primeiros lances, marcos, tempos de relógio e os erros marcados pelo motor. **Não envia o nick dos adversários** nem os lances além do 15º.

O motor de análise roda inteiro no navegador: as partidas não vão a nenhum servidor para serem avaliadas, e as avaliações ficam no `localStorage`. O único recurso externo do app é a imagem do tabuleiro, buscada no Chess.com apenas quando você abre uma abertura. Stockfish e chess.js são servidos da própria origem do site, não de CDN. Como não há nenhum script de terceiros, o risco principal seria um XSS na própria página — por isso tudo que vem da API é escapado antes de ir para a tela. Ainda assim, para provedores pagos vale usar uma chave dedicada com limite de gasto.

## Estrutura do projeto

```
index.html         marcação
css/estilo.css     estilos (temas claro/escuro, celular, streamer)
js/base.js         constantes, helpers, acesso à API, estado global
js/periodo.js      período, comparação automática, blocos de evolução
js/aberturas.js    PGN, posição a partir dos lances, modal do tabuleiro
js/motor.js        Stockfish no Worker, fila UCI, cache de avaliações
js/erros.js        classificação de erros, cruzamentos com relógio/fase/abertura
js/indicadores.js  kpis(): as dez abas e os achados automáticos
js/grafico.js      gráfico de rating ampliado (zoom, pan)
js/ia.js           provedores, prompts, análise com IA, PDF
js/partidas.js     lista de partidas, filtro, CSV
js/overlay.js      modo streamer/OBS
js/placar.js       renderização do placar, resumo, perfil, comparativo
js/busca.js        busca na API, atualização automática, cache
js/app.js          tema, modo, link e parâmetros de URL (carrega por último)
vendor/stockfish/  Stockfish 19 lite single-thread (GPLv3, licença incluída)
vendor/chess.js/   chess.js 0.12.1 (BSD-2)
og-card.html       fonte da imagem de preview (og.png)
tests/             testes das funções puras (node --test tests/*.test.js)
```

Sem build: os scripts são clássicos, carregados nessa ordem, e compartilham o escopo global. As duas dependências ficam em `vendor/`, servidas da mesma origem.

Cada feature tem um documento em [`docs/features/`](docs/README.md) — comportamento, regras, limiares e o porquê das decisões. Convenções de código e arquitetura estão em `CLAUDE.md`. Para rodar localmente basta abrir `index.html` no navegador; `node --test tests/*.test.js` roda os testes das funções puras (período, PGN, tabuleiro, montagem das partidas, classificação de erros), sem instalar nada.

## Publicar

É um site estático. No Vercel:

```
npx vercel --prod
```

No Amplify, Netlify, GitHub Pages ou qualquer hospedagem de arquivos estáticos, basta enviar `index.html`, `css/`, `js/` e `vendor/` (e `og.png`, se quiser o preview de link). O servidor precisa entregar `.wasm` como `application/wasm` — os principais já fazem isso.

## Licenças

O código deste projeto é livre para uso. O Stockfish (`vendor/stockfish/`) é distribuído sob a **GPLv3** (texto em `vendor/stockfish/Copying.txt`) e o chess.js (`vendor/chess.js/`) sob a licença **BSD-2** (`vendor/chess.js/LICENSE`); ambos são redistribuídos sem modificação.

## Limites conhecidos

- A API do Chess.com atualiza o arquivo mensal com alguns instantes de atraso após o fim da partida.
- O "melhor rating" do perfil pode ser o rating provisório do cadastro; quando for, o painel mostra o melhor do período no lugar.
- Os modelos gratuitos do Gemini e do Groq mudam com frequência; o botão ↻ ao lado do modelo lista os disponíveis na sua chave.
- A análise de lances da IA só fala de lances específicos nas partidas que o motor já avaliou; nas demais ela trata de repertório, ritmo e relógio.
- O motor single-thread é o compromisso para não exigir headers especiais do servidor (a versão multi-thread precisa de COOP/COEP, que quebraria a imagem do tabuleiro). No celular ele roda, mas é lento e gasta bateria.
