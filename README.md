# Placar Chess.com

**No ar em [chess-placar.vercel.app](https://chess-placar.vercel.app/)** — experimente com um perfil público: [chess-placar.vercel.app?nick=hikaru](https://chess-placar.vercel.app/?nick=hikaru)

Painel em um único arquivo HTML que lê a API pública do Chess.com e mostra placar, evolução de rating, indicadores e análise das partidas de um jogador. Sem servidor, sem build, sem cadastro: tudo roda no navegador.

## O que faz

- **Modo simples**: placar, resumo em três frases, gráfico de rating, forma recente, brancas × pretas, sequência e ritmo.
- **Modo avançado**: dez abas de indicadores (Análise, Resultados, Rating, Aberturas, Lances e relógio, Precisão, Adversários, Sessões, Horários, Volume), com achados automáticos — tilt, diferença entre cores, aberturas problemáticas, derrotas por tempo, rendimento em sessões longas.
- **Gráfico interativo**: rating por partida ou por tempo, com zoom, média móvel e link para cada partida.
- **Mapa de calor** dia × hora: onde você joga mais e onde rende melhor, numa grade só.
- **Filtro por adversário**: digite o nick na lista de partidas e veja o retrospecto direto (`12 partidas · 10V 0E 2D`); o CSV respeita o filtro.
- **Análise com IA**: opcional, com a sua própria chave — Gemini e Groq (tier gratuito) ou Claude e OpenAI (uso cobrado pelo provedor). Gera diagnóstico e plano de treino adaptados ao seu rating.
- **Exportar**: PDF da análise e CSV das partidas.
- **Modo streamer**: só o placar em tela cheia, com fundo transparente ou chroma key, para usar como fonte de navegador no OBS — com meta de rating, ticker e cartão da última partida.

## Uso

Abra [chess-placar.vercel.app](https://chess-placar.vercel.app/) (ou o `index.html` local) e informe o nick. Tudo que está no formulário pode ir na URL — o botão **Copiar link** gera o endereço completo, útil para favoritos e para o OBS.

## Parâmetros de URL

| Parâmetro | Valores | Descrição |
|---|---|---|
| `nick` | texto | nick no Chess.com (obrigatório para abrir já buscando) |
| `periodo` | `ano` (padrão), `mes`, `mes-1`, `3m`, `6m`, `12m`, `custom` | período analisado |
| `data`, `hora`, `dataFim`, `horaFim` | `YYYY-MM-DD`, `HH:MM` | intervalo do período `custom` (fim opcional) |
| `tc` | `bullet,blitz,rapid,daily` | modalidades consideradas |
| `bots` | `1` | inclui partidas contra bots e amistosas (por padrão ficam fora) |
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
- Aberturas, lances e relógio vêm do PGN de cada partida, interpretado no navegador.
- A última busca fica salva no navegador (sem os PGNs) e reaparece na hora na próxima abertura, enquanto a API é consultada de novo.
- Partidas contra bots, treinador ou não ranqueadas são ignoradas por padrão.

## Privacidade

Não há servidor próprio: o navegador fala direto com a API pública do Chess.com. A análise com IA envia um **resumo agregado dos indicadores**, nunca as partidas — e omite adversários e linhas com poucas partidas.

A chave de IA nunca passa por servidor deste projeto: vai direto do seu navegador para o provedor. Por padrão ela fica salva no `localStorage`; desmarque **lembrar chave** para que valha só na aba aberta. Como o app não carrega nenhum script de terceiros, o risco principal seria um XSS na própria página — por isso tudo que vem da API é escapado antes de ir para a tela. Ainda assim, para provedores pagos vale usar uma chave dedicada com limite de gasto.

## Publicar

É um site estático. No Vercel:

```
npx vercel --prod
```

No Amplify, Netlify, GitHub Pages ou qualquer hospedagem de arquivos estáticos, basta enviar o `index.html`.

## Limites conhecidos

- A API do Chess.com atualiza o arquivo mensal com alguns instantes de atraso após o fim da partida.
- O "melhor rating" do perfil pode ser o rating provisório do cadastro; quando for, o painel mostra o melhor do período no lugar.
- Os modelos gratuitos do Gemini e do Groq mudam com frequência; o botão ↻ ao lado do modelo lista os disponíveis na sua chave.
