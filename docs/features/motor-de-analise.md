# Motor de análise (Stockfish)

**Arquivos**: `js/motor.js` (`motorIniciar`, `motorAvaliar`, `avaliarPartida`, `motorAnalisar`, cache, `motorControles`/`motorStatus`/`motorResumo`) · `js/erros.js` (`errosDaPartida`, `resumoErros`, `cardsErros`, `achadosErros`) · `vendor/stockfish/` · `vendor/chess.js/`

## Objetivo

Dizer com fundamento **onde** as partidas escapam: quais lances foram erros, em que fase, com quanto relógio, em que aberturas — a única forma de o painel (e a IA) falar de lances específicos sem chutar.

## Como usar

Dois caminhos. O botão **Analisar** do Diagnóstico roda o motor nas partidas pendentes e em seguida chama a IA com tudo (`analisarTudo`). Dentro de **configurar**, a linha **Motor** dá o controle fino: profundidade (10 rápida, 12 padrão, 14 profunda) e **Só o motor** — roda sem chave e sem custo, gera os cards da aba Erros e precisão da Evidência — nas mesmas últimas 100 (ou 200/300, pelo seletor **Dossiê** logo acima) da modalidade que o dossiê usa. Os cards da aba Erros e precisão e o bloco do motor no dossiê agregam **todas** as partidas do período já avaliadas, não só essas: partidas que saem da janela continuam contando enquanto estiverem no cache. A barra de ação resume o estado ("motor 65/100 em profundidade 12"); enquanto roda, a barra de progresso e o link **parar** aparecem logo abaixo dela.

Só funciona com a página servida por http(s) — na versão publicada ou num servidor local. Aberta como arquivo, o cartão explica.

## Como funciona

- **Motor**: Stockfish 19 *lite single-thread* (WASM, 1,8 MB) carregado como Web Worker (`new Worker(MOTOR_URL)`), falando UCI por `postMessage`. `motorIniciar` espera `uciok`; `motorComando` manda um comando e recolhe linhas até a que casa com um padrão (comandos sequenciais, um Worker).
- **Lances**: o Stockfish não lê SAN. O chess.js (0.12.1, em **modo estrito** — o `sloppy` interpreta `bxa3` como lance de bispo e falha) replica a partida e converte cada lance para UCI (`e2e4`); `position startpos moves …` + `go depth N`. Foi validado comparando `ch.fen()` com a linha `Fen:` do comando `d` do Stockfish.
- **Avaliação**: `e[i]` = avaliação **depois** do i-ésimo lance, em centipawns do ponto de vista das **brancas** (o Stockfish responde do lado que move; `motorAvaliar` inverte). `m[i]` = **melhor lance** na posição *antes* do i-ésimo lance, já em SAN (`uciParaSan` joga e desfaz no chess.js antes de aplicar o lance real) — é o que deveria ter sido jogado no lugar. Mate codificado como `±(MATE_BASE + n)`, `MATE_BASE = 20000`; posições terminais (mate, afogamento) não vão ao motor. A posição inicial é avaliada uma vez por profundidade.
- **Ordem e progresso**: derrotas → empates → vitórias; barra por posições (não por partidas); estimativa depois de 20 posições; a tela é atualizada a cada 500 ms — `renderMotor` troca só `#motorStatus`, `#motorControles` e o resumo da barra, nunca o cartão inteiro, para não apagar a chave que o usuário está digitando — e, na aba Erros e precisão, os cards são refeitos a cada partida concluída.
- **Cache** (coleção `evals` do [armazém](persistencia.md), IndexedDB com espelho em memória): `{url: {p: profundidade, t, e: [cp…] | null, m: [san…]}}`, poda para as 3000 partidas mais recentes. `e: null` marca partida que o motor não conseguiu ler (não tenta de novo). Profundidade maior refaz só o que está abaixo dela. Partidas de Chess960 e outras variantes são puladas.
- **Classificação** (`erros.js`): critério do Lichess, pela **queda da chance de vitória** do lado que moveu — `chanceVitoria(cp) = 50 + 50·(2/(1+e^(−0,00368208·cp)) − 1)`; mate = 100/0. Queda ≥10 pp imprecisão, ≥20 erro, ≥30 **grave**. **Decisivo**: primeiro erro que deixa a chance abaixo de 30% sem ela voltar a passar de 45% até o fim. **Virada**: a chance cruza de <20% para >50% (a favor) ou de >80% para <50% (contra). O relógio de cada erro é `clks[i]` do PGN (tempo que sobrava ao concluir o lance); faixas: <30 s, 30 s–2 min, >2 min.
- **Achados** (≥10 partidas avaliadas): erros sob pressão de tempo (taxa com <30 s ≥ 2× a do resto e ≥5 erros na faixa), erros concentrados numa fase (≥50% de ≥8), derrotas decididas no apuro (≥50% dos decisivos com <30 s, ≥4 derrotas), derrotas decididas na abertura (≥50% até o 15º lance).
- **IA**: `dossiePartidas` acrescenta por partida `erros (motor, profundidade P): lance 23 Qxd2 (grave, chance 71% → 18%, melhor: Nf3, 0:45 no relógio); … · decisivo: lance 23 · viradas: …` e um bloco de agregados no resumo; o prompt libera a IA para citar esses lances (e só esses) e para citar o "melhor:" como fato — sem inventar a razão tática, que ela não vê.

## Decisões

- **Vendorizar, não CDN.** A privacidade da chave de IA depende de não haver script de terceiros. O preço é não funcionar em `file://` — só para esta feature.
- **Lite single-thread.** A multi-thread precisa de `SharedArrayBuffer`, que exige COOP/COEP no servidor; o COEP `require-corp` bloquearia a imagem do tabuleiro do Chess.com. A lite é mais que suficiente para amador; a full tem 60+ MB.
- **chess.js, não o `fenDaAbertura`.** O motor próprio resolve só o necessário para mostrar um tabuleiro e devolve `''` na dúvida — certo para uma imagem, inaceitável para alimentar um motor (FEN errado = avaliação de outra partida). 50 KB de biblioteca de referência não é onde vale arriscar.
- **Chance de vitória, não centipawns.** 300 cp perdidos numa posição já ganha não custam nada; 100 cp numa igual decidem. O critério do Lichess é conhecido e comparável.
- **Processo em segundo plano com cache.** 100 partidas × ~80 posições em profundidade 12 são 5–8 min num desktop; a segunda vez só as partidas novas custam.
- **Sem avaliação da posição inicial por partida.** É constante por profundidade; economiza 100 chamadas.
- **Guardar o melhor lance, em SAN, só como fato.** Custa 4–6 caracteres por posição e permite ao card e à IA dizer "melhor era Nf3"; explicar *por quê* continua fora do alcance da IA sem tabuleiro, e o prompt diz isso.

## Limites

- Números medidos num servidor headless: profundidade 10 ≈ 10 ms por posição, 12 ≈ 50 ms, 14 ≈ 200 ms. Celular é mais lento e gasta bateria; o cartão avisa.
- Profundidade 12 é suficiente para erros de amador; num jogador forte, um "erro" de 20 pp em posição fechada pode ser ruído do motor.
- Não roda em `file://` nem em navegador sem WebAssembly.
- O relógio do erro é o que sobrava **depois** do lance — para "com quanto tempo pensou" seria preciso o lance anterior; a faixa de 30 s absorve a diferença.

## Como testar
Automatizado: `tests/erros.test.js` cobre `chanceVitoria`, `errosDaPartida` (grau pela queda de chance, decisivo, relógio) e `resumoErros`; o pipeline do Worker não roda em Node.

Servir a pasta por http (`python3 -m http.server`) e usar partidas legais — aleatórias geradas com o chess.js servem, o pipeline não se importa com a qualidade. Conferir: motor sobe (`uciok`), FEN do chess.js = `Fen:` do `d`, cache preenchido, zero "não conseguiu ler", botão desabilitado ao recarregar, profundidade maior reabre pendentes, Parar interrompe, `file://` mostra a explicação. Com partidas reais: abrir 2–3 lances de "Onde as derrotas escaparam" no Chess.com e ver se batem com a análise do site.
