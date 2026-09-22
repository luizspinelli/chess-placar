# Modo streamer / OBS

**Arquivos**: `js/overlay.js` (`renderOverlay`, `modoStreamer`) · `css/estilo.css` (`body.streamer`, `[data-ov]`)

## Objetivo

Colocar o placar da sessão ao vivo na transmissão, como fonte de navegador no OBS, com fundo transparente ou chroma key e atualizando sozinho.

## Como usar

**Modo streamer** no formulário (ou `streamer=1` na URL). Opções em "Opções de overlay": layout **Completo**, **Compacto** ou **Ticker** (barra no rodapé); **meta** de rating (`700` absoluto ou `+50` relativo ao início do período) com barra de progresso; **fundo** (vazio = transparente; `00ff00` para chroma); **escala** (0,8 a 2); cartão da **última partida** e **sequência** (🔥 vitórias / 🧊 derrotas seguidas, a partir de 2). Esc ou o botão "sair" volta ao normal. O fluxo típico: **Monitorar a partir de agora** + modo streamer, e **Copiar link** para colar no OBS.

## Como funciona

- Classe `streamer` no `body` esconde formulário, indicadores e lista; `data-ov` no body escolhe o layout; `--ovEscala` e `zoom` aplicam a escala; o fundo vai direto em `body.style.background`.
- `renderOverlay` roda a cada `render()` e a cada busca (inclusive falha: `body.desatualizado` marca quando a última atualização não veio). Sequência atual calculada sobre a lista da modalidade; meta usa `estado.antes`/`depois` da modalidade ativa; o cartão da última partida pisca (`nova`) quando a URL da partida muda.
- Ligar o modo liga a atualização automática se estava desligada e grava a URL atual com `history.replaceState`, para o link do OBS sair completo.

## Decisões

- **Fonte de navegador, não captura de janela.** Transparência real e atualização sem intervenção; o OBS aceita URL direto.
- **Meta relativa ao início do período.** "+30 hoje" é a meta natural de uma sessão; o absoluto continua disponível.

## Limites

- A imagem de fundo do OBS e a escala são responsabilidade do usuário; o app só desenha o placar.
- A atualização depende da API (atraso de instantes após a partida) e do intervalo escolhido.

## Como testar

`?nick=x&periodo=custom&data=HOJE&hora=20:00&tc=rapid&streamer=1&overlay=ticker&meta=%2B30`: ticker no rodapé, meta com barra, sequência quando houver, Esc sai. Testar os três layouts, fundo `00ff00`, escala 1,5.
