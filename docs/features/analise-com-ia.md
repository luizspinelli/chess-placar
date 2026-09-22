# Análise com IA e exportação em PDF

**Arquivos**: `js/ia.js` (`PROVEDORES`, `blocoIA`, `executarIA`, `promptIndicadores`, `resumoParaIA`, `promptPartidas`, `dossiePartidas`, `mdParaHtml`, `exportarPDF`)

## Objetivo

Fazer um treinador ler os números e dizer, em português, o que fazer: diagnóstico e plano (indicadores) ou o que manter, parar e estudar (lances das últimas 100 partidas). Com a chave do próprio usuário e sem servidor no meio.

## Como usar

Aba **Análise**, cartão "Análise com IA": provedor (Gemini, Groq — tier gratuito; Claude, OpenAI — cobrados), chave, modelo (↻ lista os disponíveis na chave), **lembrar chave** (desmarcado, a chave vive só na aba). Dois botões:

- **Analisar indicadores** — envia um resumo agregado das abas; devolve Diagnóstico, Pontos fortes, O que está custando mais rating, Plano para 2 semanas (ou ajustes imediatos em período curto), Regras de rotina.
- **Dossiê das últimas 100** — primeiro roda o [motor](motor-de-analise.md) nas partidas ainda não avaliadas (quando a página vem de um servidor), depois envia uma linha por partida com os 15 primeiros lances, marcos, relógio e os erros apontados pelo Stockfish (com o melhor lance); devolve Leitura geral, O que manter, O que parar de fazer, O que estudar, Como acompanhar. Se o motor for interrompido, a IA não é chamada; em `file://`, vai direto à IA sem os erros.

**Exportar PDF** abre a janela de impressão com placar, análise da IA (se houver), achados e os indicadores das abas.

## Como funciona

- **Provedores**: cada entrada de `PROVEDORES` tem `nome`, `link`, `padrao`, `reserva` (modelos de fallback), `filtro`, `listar(chave)` e `chamar(chave, modelo, prompt)`. O seletor, o storage da chave e o fallback são genéricos — adicionar um provedor é uma entrada nova. Armadilhas resolvidas: Anthropic rejeita `temperature` e exige o header `anthropic-dangerous-direct-browser-access` para CORS; OpenAI exige `max_completion_tokens` nos modelos de raciocínio.
- **`executarIA(montarPrompt)`**: valida a chave, monta o prompt, tenta o modelo escolhido; em 429/5xx espera e repete (3×); em 404/modelo inválido tira o modelo da lista e passa ao próximo (até 6). Se respondeu outro modelo, avisa e o torna padrão.
- **Prompt de indicadores**: escopo pelo tamanho da amostra — **curto** (<40 partidas ou ≤10 dias: forma recente, sem conclusões sobre aberturas/horários, ajustes imediatos no lugar do plano), **médio**, **longo** (≥200 partidas ou >60 dias: separar evolução de traço, seção "O que mudou no período" e "O que acompanhar"). **Nível** pelo rating (`nivelJogador`: <1000 iniciante, <1800 intermediário, <2400 clube, mestre) muda vocabulário e recomendações. Regras: citar o número, não inventar, priorizar por impacto, até 600 palavras, títulos fixos.
- **`resumoParaIA`** lê os cards genericamente (primeiras duas células de cada linha) e **omite deliberadamente** linhas com menos de 10 partidas nas abas sensíveis e, em período curto, abas inteiras (Adversários, Aberturas, Horários, Volume, Precisão, Lances e relógio). Nunca envia nicks de adversários.
- **Dossiê de partidas** (`dossiePartidas`): as últimas `N_DOSSIE` = 100 partidas da modalidade com lances; resumo agregado (placar, por cor, rating, duração média de vitórias × derrotas, motivos das derrotas, aberturas com 3+ partidas) e, por partida: data, cor, resultado e motivo, ratings e variação, abertura, lances, precisão, os **15 primeiros lances**, marcos lidos do texto do SAN (roque de cada lado, primeira captura, dama nos 10 primeiros lances, xeques) e relógio (tempo final dos dois, média de segundos por lance por fase, maior reflexão, a partir de que lance ficou abaixo de 30 s). ~15k tokens. Partidas que o [motor](motor-de-analise.md) já avaliou ganham a linha `erros (motor)`, com grau, chance antes → depois, melhor lance e relógio de cada erro. `dossieCompleto` encadeia motor → IA e reaproveita o cache: só as partidas novas custam.
- **Prompt de lances**: proíbe a IA de afirmar erro em lance específico — sem tabuleiro é chute — e a orienta para repertório, ritmo e relógio. A **exceção** são as partidas com `erros (motor)`, cujos lances vieram do Stockfish e podem ser citados, inclusive o "melhor:" — como fato, sem inventar a razão tática.
- A resposta passa por `mdParaHtml` (títulos, listas, negrito, itálico) com HTML escapado.
- **PDF**: `exportarPDF` monta um HTML autônomo (placar, análise da IA, achados, cards em duas colunas) e chama `window.print()`; o usuário escolhe "Salvar como PDF".

## Decisões

- **Chave do usuário, no navegador.** O autor não paga inferência de ninguém e nenhuma partida passa por servidor do projeto. Custo: cada usuário cria a própria chave.
- **Dados estruturados, não PGN cru.** PGN de 100 partidas com relógio são 50–100k tokens e pior resultado; extrair marcos em JS deixa para o modelo o que ele faz bem (sintetizar padrões) e tira o que faz mal (reproduzir a partida mentalmente).
- **Proibir lance específico sem motor.** LLMs apontam blunders inexistentes com convicção; o jogador confiaria. A proibição é a regra mais importante do prompt.
- **Omitir amostras pequenas no resumo.** Evita que a IA construa conclusão sobre 4 partidas — mesmo pedindo, ela tende a usar o que recebe.

## Limites

- O dossiê só existe depois de uma busca real: a restauração do cache não guarda PGN, e o botão avisa.
- Modelos gratuitos mudam de nome com frequência; o ↻ resolve, e o fallback cobre o resto.
- A qualidade depende do modelo; Flash/Llama gratuitos dão análise mais rasa que Claude/GPT.

## Como testar

Com uma chave gratuita do Gemini: Analisar indicadores em `7d` (deve sair "PERÍODO CURTO", sem plano de 2 semanas) e em `ano` (com "O que mudou"). Dossiê em `file://` (sem motor) e servido por http (com motor): a segunda resposta pode citar lances e o "melhor:"; a primeira não. Parar o motor no meio: a IA não deve ser chamada. Sem chave, a mensagem "Informe a chave da API". Exportar PDF com e sem análise.
