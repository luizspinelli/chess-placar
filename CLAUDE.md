# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

Painel que lê a API pública do Chess.com e mostra placar, indicadores e análise de um jogador. **Todo o app é um único arquivo: `index.html`** (~1800 linhas: CSS + HTML + JS vanilla). Isso é decisão de design, não dívida: sem servidor, sem build, sem dependências, sem framework. Não sugerir split em módulos, bundler ou libs — qualquer mudança deve manter o arquivo autocontido.

Os outros arquivos do repo são acessórios: `og.png` é a imagem de preview de link (Open Graph) e `og-card.html` é o fonte dela — abrir no navegador, capturar 1470×772 e redimensionar para 1200×630.

## Desenvolvimento

- **Rodar**: abrir `index.html` no navegador. Não há build, testes nem lint.
- **Testar**: usar um nick real (ex.: `?nick=hikaru`) ou o botão "Veja um exemplo". Parâmetros de URL estão documentados no README.
- Idioma: UI, identificadores, comentários e commits em **português**. Estilo denso (várias declarações por linha, arrow functions curtas) — seguir o estilo existente.

## Arquitetura (tudo em index.html)

Fluxo principal:

1. **`buscar(atualizacao)`** (~linha 1641) — orquestra tudo: resolve o período, baixa os arquivos mensais da API **um por vez** (a API do Chess.com não aceita chamadas paralelas), calcula `delta` de rating por diferença entre partidas ranqueadas consecutivas (por isso busca também o mês *anterior* ao início, como referência), filtra bots/amistosas e monta o objeto global **`estado`** `{jogos, antes, depois, nick, rotulo, perfil, stats, ...}`. Com **Comparar com período anterior** marcado, a janela de meses baixados começa em `periodoAnterior(...)` e o mesmo passe acumula `estado.comp` — só **agregados por modalidade** (`{n, w, d, l, acc, accN, antes, depois}`), porque o `estado` inteiro vai para o localStorage.
2. **`render()`** (~linha 1606) — filtra `estado.jogos` pela aba de modalidade ativa (`aba`) e chama os renderizadores: `renderLista`, `renderKpis`, `renderResumo`, `renderPerfil`, `renderOverlay`.
3. **`kpis(jogos, nick)`** (~linha 710) — o coração analítico: uma passada pelas partidas gera o HTML de todas as abas (Resultados, Rating, Aberturas, Precisão, Sessões, etc.) num objeto `{nomeAba: html}` guardado em `kpiData`. Também produz os "achados automáticos" (heurísticas com limiares mínimos de amostra). Quando existe `estado.comp`, quatro desses achados comparam o período com o anterior (aproveitamento, rating, precisão, volume) — todos exigem 15+ partidas dos dois lados, porque só os agregados estão disponíveis. Popula `curvaDados` (série de rating por modalidade), usada pelo gráfico ampliado do modal (`desenharModal`, com zoom/pan próprio em SVG).

Peças de apoio:

- **`getJSON`** (~linha 585) — fetch com cache por ETag (Map em memória) e retry com backoff para 429/5xx.
- **`parsePGN(g)`** (~linha 691) — extrai abertura (do header ECOUrl), lances e relógio do PGN; memoizado em `g._pgn`.
- **`PROVEDORES`** (~linha 1066) — análise com IA (Gemini, Groq, Claude, OpenAI), chave do usuário. Para adicionar um provedor basta uma entrada nesse objeto: `nome`, `link`, `padrao`, `reserva`, `filtro`, `listar` e `chamar` — o seletor, o storage da chave e o fallback de modelos são todos genéricos. Duas armadilhas já resolvidas: os modelos atuais da Anthropic rejeitam `temperature` (400) e exigem o header `anthropic-dangerous-direct-browser-access` para CORS; a OpenAI exige `max_completion_tokens` no lugar de `max_tokens` nos modelos de raciocínio. Cada provedor implementa `listar` e `chamar`; `analisarIA` tenta o modelo escolhido e cai para os reservas. O prompt é montado em `analisarIA` e os dados em `resumoParaIA`, que **omite deliberadamente** linhas com poucas partidas e abas sensíveis em amostras curtas — preservar isso ao mexer.
- **localStorage** — todas as chaves com prefixo `placar-chesscom:` (nicks recentes, tema, modo, chaves de IA, última busca sem PGNs). Acessos sempre em try/catch via `lerLS`/`gravarLS`.
- **Período** — o `<select>` virou `<input type="hidden" id="periodo">` alimentado pelos atalhos (`aplicarPeriodo`), justamente para que `periodo()`, `periodoAnterior()`, `chaveBusca()` e `linkAtual()` sigam lendo `$('periodo').value`. Valores: `ano`, `mes`, `mes-1`, `Nd`/`Nw` (rolling, a partir de agora), `Nm` (a partir do dia 1º) e `custom`. Ao adicionar um formato novo, tratar em `periodo()` **e** em `periodoAnterior()`.
- **Parâmetros de URL** — lidos no bloco final do script (~linha 1733) e gerados por `linkAtual()`; todo filtro novo do formulário deve entrar nos dois lugares (e na tabela do README).
- **Modo streamer/OBS** — classe `streamer` no body + `renderOverlay()`; layouts controlados por `data-ov`.

Convenções internas: resultado de partida é sempre `'w' | 'd' | 'l'` (empates definidos pelo Set `DRAWS`); helpers de HTML (`card`, `tabela`, `kv`, `linha`) montam os cartões de KPI; textos de ajuda ficam no objeto `GLOSSARIO`.

## Cuidados

- Dados da API entram no DOM via `innerHTML` em vários pontos; campos de texto livre (nome de perfil, aberturas) devem ser escapados ao adicionar renderização nova.
- A resposta da IA passa por `mdParaHtml`, que escapa HTML — não renderizar markdown da IA por outro caminho.
