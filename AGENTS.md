<!-- bmad:context -->
<!-- Verificado em 2026-09-23 contra 41f11dc. Gerenciado por bmad-project-context; edições dentro deste bloco são substituídas no refresh. O que você quiser preservar, deixe fora dos marcadores. -->

## chess-placar

Painel que lê a API pública do Chess.com e mostra placar, indicadores e análise de um jogador. JS vanilla, sem servidor, sem build, sem framework: `index.html` só com a marcação, `css/estilo.css` e um arquivo por domínio em `js/`. Cada feature tem um documento em `docs/features/`, indexado em `docs/README.md`.

## Política

- Não sugerir bundler, ES modules, framework ou lib de UI: os scripts são clássicos (`<script src>`) para o app abrir via `file://`, onde o Chrome bloqueia módulos ES. É decisão de design, não dívida.
- Não adicionar script, fonte ou recurso de terceiros, nem servir as dependências de CDN — a privacidade da chave de IA depende de não haver código de terceiros na página. As duas dependências (Stockfish 19 lite, chess.js 0.12.1) ficam vendorizadas em `vendor/`, com a licença ao lado. Única exceção existente: a imagem do tabuleiro em `chess.com/dynboard?fen=`.
- Não trocar a versão do chess.js sem conferir que ela ainda carrega como script clássico — as 0.13+ são só ESM. Usá-lo apenas para SAN → UCI e legalidade no motor.
- Documentação muda no mesmo commit que o código: feature nova = arquivo em `docs/features/` + linha no índice de `docs/README.md`; comportamento alterado ou removido = doc alterada. Feature sem doc atualizada é feature incompleta.
- Limiar, constante ou nome de função citado na doc existe no código com o mesmo valor — ao mudar um, `grep` em `docs/` antes de commitar.
- Commit em português, frase descritiva sem prefixo (`Tela inicial reforçada: miniatura do relatório…`).

## Onde as coisas estão

- Antes de mexer num domínio, ler a doc dele — tem os limiares e o porquê das decisões, que o código não diz:
  - `js/busca.js`, `js/periodo.js` → `docs/features/busca-e-periodo.md`, `comparacao-de-periodos.md`, `evolucao-no-periodo.md`
  - `js/indicadores.js`, `js/erros.js` → `docs/features/indicadores.md`
  - `js/motor.js` → `docs/features/motor-de-analise.md`
  - `js/ia.js` → `docs/features/analise-com-ia.md`
  - `js/aberturas.js` → `docs/features/aberturas.md`
  - `js/armazem.js` e qualquer coisa que persista → `docs/features/persistencia.md`
  - `js/placar.js`, `js/partidas.js`, `js/grafico.js`, `js/app.js` → `placar-e-resumo.md`, `lista-de-partidas.md`, `grafico-de-rating.md`, `parametros-de-url.md`
  - `index.html`, a grade do `css/estilo.css`, a barra de contexto → `docs/features/layout.md`
- `js/base.js` é o que todos leem: constantes, helpers de formatação e de HTML, `getJSON`, `lerLS`/`gravarLS`, estado global.
- Helper usado por dois ou mais domínios vai para `base.js`; listener fica junto do que ele aciona; estado lido por mais de um arquivo é declarado em `base.js`.
- Arquivo novo em `js/` entra no `index.html` na posição certa, e `js/app.js` continua sendo o último.
- `og.png` é o preview de link; o fonte é `og-card.html` — abrir no navegador, capturar 1470×772 e redimensionar para 1200×630.

## Rodar e verificar

- Rodar: abrir `index.html` no navegador, funciona via `file://`. Não há build nem lint; `node --check js/arquivo.js` confere sintaxe.
- Testes: `node --test tests/*.test.js` — sem dependência nenhuma, só o `node:test`. `tests/_ambiente.js` carrega os scripts na ordem do `index.html` sobre um DOM falso em que `$('id')` aceita qualquer leitura e escrita, então dá para preencher o formulário direto (`$('periodo').value = '4w'`).
- Função pura nova ganha teste no arquivo do domínio; função que toca a tela não se testa aí, se testa no roteiro manual.
- Não afrouxar `tests/tabuleiro.test.js`: ele usa o chess.js como oráculo e exige que `fenDaAbertura` devolva a posição certa ou `''`, nunca uma errada — uma posição plausível e errada é pior que nenhuma.
- Depois de mexer em código compartilhado, percorrer com o console aberto: tela inicial → busca → barra de contexto (rótulo, painel abrindo e fechando pelos três caminhos) → as nove abas de evidência → modal do gráfico pelo "⤢" do cabeçalho → modal da abertura → diagnóstico (botão da barra, com o sinal do achado mais grave) com e sem chave de IA → lista de partidas → largura de celular. No desktop, conferir que a página não rola em nenhum eixo e que as duas colunas rolam por dentro. Usar um nick real (`?nick=hikaru`) ou o botão "Veja um exemplo".
- O motor não roda em `file://` (Worker e WASM bloqueados): para testá-lo, servir a pasta por http (`python -m http.server`). O cartão explica a limitação em vez de falhar, e o resto do app não depende dele.
- API bloqueada no ambiente? Interceptar `https://api.chess.com/**` e servir partidas sintéticas com `pgn`, `time_control`, `uuid` nos dois jogadores e `accuracies`. Partidas para o motor precisam ser legais — gerar com o próprio chess.js.

## Convenções fora do padrão

- Os scripts compartilham o escopo global: `let`/`const` de topo de um arquivo são visíveis nos seguintes. A ordem do `index.html` só importa para o que executa durante a carga.
- Resultado de partida é sempre `'w' | 'd' | 'l'`; empates definidos pelo Set `DRAWS`.
- Componente de UI é função pura que devolve string de HTML (`card`, `blocoIA`, `motorStatus`, `sparkline`…): recebe dados, não lê o DOM, e quem chama decide onde colar. Cada pedaço atualizável sozinho tem `id` estável e uma `renderX` que troca só aquele nó.
- Estado vive nas variáveis globais de `base.js` (ou no próprio arquivo, se só ele lê), nunca em `dataset` do DOM. Derivados (`kpiData`, `curvaDados`, `jogosAtuais`) se recalculam, não se gravam. O DOM do formulário é a fonte de verdade dos filtros.
- Filtro novo do formulário entra em `linkAtual()`, no bootstrap de `js/app.js` e na tabela do README.
- Card novo com conceito não óbvio ganha verbete em `GLOSSARIO` — `card` põe o "?" de ajuda sozinho quando o título casa com uma chave.
- UI, identificadores, comentários e commits em português. Estilo denso (várias declarações por linha, arrow functions curtas).

## Armadilhas conhecidas

- Nunca refazer via `innerHTML` um bloco que contenha campo em que o usuário pode estar digitando — a chave da IA já se perdeu assim. Trocar só o nó (`#motorStatus`, `#motorControles`, `#iaCfg`).
- Dados da API entram no DOM via `innerHTML` em vários pontos: escapar texto livre (nome de perfil, abertura, nick do adversário) com `escHtml` em toda renderização nova.
- A API do Chess.com responde 404 também quando bloqueia por excesso de requisições — `buscar` distingue pelo nick já ter funcionado antes. Não paralelizar as chamadas: um mês por vez.
- Replicar lances no chess.js em modo estrito; com `sloppy` ele lê `bxa3` como lance de bispo e falha.
- `resumoParaIA` lê os cards genericamente (primeiras duas células de cada `<tr>`): linha de cabeçalho de coluna precisa ter a primeira célula vazia para ser ignorada.
- Ao mexer em `promptCompleto`, manter a proibição de a IA afirmar erro em lance específico fora dos marcados pelo motor, e a exceção para esses — sem motor, isso é alucinação com cara de análise.
- `resumoParaIA` omite de propósito linhas com poucas partidas e abas sensíveis em amostras curtas. Preservar ao mexer nele.

<!-- /bmad:context -->
