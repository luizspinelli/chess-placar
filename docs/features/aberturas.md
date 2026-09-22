# Aberturas e tabuleiro

**Arquivos**: `js/aberturas.js` (`parsePGN`, `fenDaAbertura`, `abrirAbertura`) · `js/indicadores.js` (seção Aberturas: `linhaPrincipal`, `profundidade`, `comLink`)

## Objetivo

Mostrar o repertório real do jogador — o que joga de brancas, o que enfrenta e como responde de pretas, quais variantes rendem e quais custam — e deixar ver a posição de cada abertura sem sair do painel.

## Como usar

Aba **Aberturas**: de brancas e de pretas (8 mais jogadas cada), melhores e piores variantes (mínimo 3 partidas), distribuição por código ECO, seu 1º lance de brancas, 1º lance do adversário e sua resposta de pretas. Clicar no nome de uma abertura abre um modal com o **tabuleiro** na posição que a define, os lances e o link para a página da abertura no Chess.com. De pretas, o tabuleiro vem invertido.

## Como funciona

- `parsePGN(g)` lê os headers do PGN, os lances em SAN (todos, em `san`) e os relógios (`clks`). Do header `ECOUrl` (`…/openings/Sicilian-Defense-Najdorf-Variation-6.Be3`) extrai a **variante** (o slug até o primeiro trecho com número) e a **família** (até a primeira palavra-chave: Defense, Opening, Game, Attack, Gambit, System, Variation, Counter; sem ela, 3 palavras). Memoizado em `g._pgn`.
- **Linha exibida no modal** = a **linha mais jogada** do grupo (`linhaPrincipal`): a cada lance, o mais frequente entre as partidas que chegaram até ali. Cortada em `profundidade(url)`: o slug do Chess.com termina nos lances que nomeiam a variante (`-3...Qa5` = até o 3º lance das pretas = 6 meias-jogadas); sem número, 5 meias-jogadas; teto de 8.
- **`fenDaAbertura(san)`** aplica os lances numa posição inicial e devolve o FEN. Resolve só o necessário para saber qual peça se moveu: candidatas por tipo e alcance, desambiguação da notação, e — para o caso comum de duas peças alcançando a casa — descarta a que deixaria o próprio rei em xeque (peça **cravada**). Trata roque curto e longo, en passant, promoção e captura de peão. Se ainda sobrar dúvida devolve `''`, e o modal mostra um aviso em vez do tabuleiro.
- O tabuleiro é a imagem `https://www.chess.com/dynboard?fen=…&flip=1` — o **único recurso externo** do app.
- **Distribuição por ECO**: barra em que a largura é volume e a cor é aproveitamento (A irregulares e de flanco, B 1.e4 sem 1…e5, C 1.e4 e5 e Francesa, D 1.d4 d5, E Índias).

## Decisões

- **Linha mais jogada, não prefixo comum.** A mesma abertura chega por ordens de lance diferentes (transposição); o prefixo comum colapsa em 1–2 lances e o tabuleiro fica inútil.
- **Cortar na profundidade do slug.** É até ali que a posição ainda define a abertura; além disso vira meio-jogo de uma partida específica.
- **Motor de lances próprio, parcial, que prefere não mostrar.** Uma posição plausível e errada é pior que nenhuma. Por isso o `''` na dúvida — e por isso o [motor de análise](motor-de-analise.md) usa o chess.js, que precisa de legalidade completa. Ao mexer em `fenDaAbertura`, reconferir os casos de referência (roque curto e longo, en passant, promoção, captura de peão, desambiguação por coluna).
- **De brancas, a abertura nomeada é escolha do adversário.** "Scandinavian Defense" na tabela de brancas significa que o adversário jogou 1…d5; o jogador só controla a resposta. Essa leitura está no `GLOSSARIO` e no prompt da IA.

## Limites

- Partidas sem `ECOUrl` (raras) entram como `?` ou pelo código ECO.
- Se as partidas de uma abertura não têm lances em comum, o modal avisa que não há posição única.
- Piores/melhores variantes exigem 3 partidas; achados de abertura exigem mais (ver [indicadores.md](indicadores.md)).

## Como testar
Automatizado: `tests/pgn.test.js` (parsePGN: abertura, lances, relógios, memoização) e `tests/tabuleiro.test.js` (fenDaAbertura contra o chess.js em partidas legais aleatórias — acerta a posição ou devolve `''`).

Abrir o tabuleiro de uma variante conhecida (ex.: Najdorf) e conferir posição e lances; de pretas, conferir o tabuleiro invertido. Casos de referência do `fenDaAbertura`: `O-O`, `O-O-O`, en passant, `e8=Q`, `exd5`, `Nbd2`, e o `Bb5+ Nd7 … Nf6` (cravada).
