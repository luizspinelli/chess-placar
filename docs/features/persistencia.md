# Persistência no navegador

**Arquivos**: `js/base.js` (`lerLS`, `gravarLS`, `cache`) · `js/busca.js` (`salvarUltima`, `carregarUltima`, nicks) · `js/motor.js` (cache de avaliações) · `js/ia.js` (chaves)

## Objetivo

Abrir o app e ver o placar na hora, lembrar preferências e chaves, e não repetir trabalho caro (requisições, avaliações do motor) — tudo sem servidor.

## Como funciona

Duas camadas, cada uma para o que faz bem:

- **localStorage** para preferências pequenas, lidas de forma síncrona na carga: todas as chaves com prefixo `placar-chesscom:` e acessadas em `try/catch` (`lerLS`/`gravarLS`) — navegador em modo privado ou cota estourada não quebram o app.

| Chave | Conteúdo | Observação |
|---|---|---|
| `nicks` | até 10 nicks recentes | o mais recente primeiro |
| `tema` | `claro`/`escuro` | URL tem precedência |
| `provedor`, `chave:{p}`, `modelo:{p}`, `lembrarChave` | configuração da IA | com "lembrar" desmarcado a chave fica só em `chavesMemoria` (vida da aba); desmarcar apaga as gravadas |
| `motorProf` | profundidade escolhida | |
| `nDossie` | tamanho do dossiê (100/200/300) | valor fora de `TAMANHOS_DOSSIE` cai para 100 |

- **IndexedDB** (`js/armazem.js`, banco `placar-chesscom`) para o que é grande e cresce, com **espelho em memória**: as leituras (`armazem.ler`, `armazem.todos`) são síncronas, do espelho, então `kpis()`, `evalsDe()` e `render()` continuam simples; as escritas (`armazem.gravar`, `apagar`, `podar`) atualizam o espelho na hora e o banco em segundo plano. `armazem.pronto` resolve quando o espelho foi carregado; `buscar` espera por ele antes de restaurar.

| Coleção | Chave | Conteúdo | Poda |
|---|---|---|---|
| `buscas` | `chaveBusca(nick)` (JSON de todos os filtros) | `{quando, versao, estado}` — o `estado` sem `pgn`, `tcn`, `fen`, `initial_setup`, mas **com `_pgn`** (lances e relógios parseados, ~1,8 KB por partida) | `MAX_BUSCAS` = 5 mais recentes |
| `evals` | url da partida | `{p, t, e, m}` do motor | `MAX_EVALS` = 3000 mais recentes por `t` |
| `relatorios` | `nick|modalidade` | `{texto, meta: {modelo, quando}, quando}` da última análise da IA | uma por jogador e modalidade |

- **Versão do esquema**: `VERSAO_ESTADO` (em `base.js`) vai junto de cada busca gravada; busca com versão diferente é ignorada e refeita da API, em vez de ser lida com defaults improvisados. Mudar quando um campo passar a ser obrigatório para `render()`.
- **Migração**: na primeira carga, `armazem.pronto` move `placar-chesscom:evals` e `placar-chesscom:ultima` (formato antigo, só no localStorage) para o IndexedDB e apaga as chaves.
- **Sem IndexedDB** (navegador antigo, modo privado que o bloqueia, Node dos testes): `armazem.falhou` fica `true`, o espelho vive só em memória e `salvarUltima` acrescenta "sem cache local (motivo)" à linha de status — nunca em silêncio.
- **Cache de rede** (`cache`, `Map` em memória): resposta + ETag por URL; morre com a aba. Serve à atualização automática (só o mês corrente é rebaixado) e ao `If-None-Match`.
- **URL**: `sincronizarURL()` (`app.js`) grava o link atual com `history.replaceState` após cada busca e ao trocar de aba de modalidade ou de indicadores — sem entradas novas no histórico. Com isso F5 reproduz a tela: o bootstrap lê os parâmetros, `buscar` restaura a busca do armazém na hora ("Dados salvos … · atualizando…") e consulta a API em seguida. É a camada de persistência mais barata do app; ver [parametros-de-url.md](parametros-de-url.md).

## Decisões

- **Lances parseados ficam na busca salva.** A primeira versão dizia guardar "sem PGN" para caber na cota, mas `parsePGN` roda antes de compactar e `g._pgn` vai junto — 1,8 KB contra 2,1 KB do PGN bruto, economia pequena. O efeito real é o oposto do que a doc antiga dizia: dossiê da IA e motor **funcionam** numa restauração (validado com a rede cortada). Manter, e não descartar `_pgn`.
- **IndexedDB em vez de só localStorage.** Três meses de rápida são 1,5 MB de busca; doze passariam de 6 MB, acima dos 5 MB típicos, e a gravação falhava em silêncio. O IndexedDB tem centenas de MB, guarda objetos em vez de strings e grava sem travar a tela (no modo monitorar a busca era serializada a cada minuto). O espelho em memória preserva as leituras síncronas de todo o resto do código. Alternativa descartada: só avisar quando a cota estourasse — resolveria o silêncio, não o limite.
- **Relatório da IA guardado.** Custa minutos e centavos, e sumia num F5; agora volta com data e modelo no cabeçalho, por jogador e modalidade. O PDF continua sendo o arquivo para guardar fora do navegador.
- **Chave de IA opcionalmente só na aba.** Máquina compartilhada. Não protege contra XSS — nada no cliente protege; a mitigação é não ter script de terceiros e escapar tudo da API.
- **Evals por URL, com poda.** A URL da partida é estável e única; 3000 partidas são ~2,4 MB, e cobrem meses de análises.

## Limites

- Tudo é por navegador e por origem: outro navegador ou dispositivo começa do zero.
- Limpar dados do site apaga buscas, avaliações e relatórios de uma vez; exportar/importar ainda não existe.
- Comportamento do IndexedDB em `file://` varia por navegador; no roteiro manual, conferir que o app segue funcionando com `armazem.falhou` (aviso na linha de status).

## Como testar
Automatizado: `tests/armazem.test.js` (espelho sem IndexedDB, poda, cache do motor via armazém) e `tests/url.test.js` (abas no link).


Buscar, recarregar com o mesmo nick e filtros: o placar aparece na hora com "Dados salvos". Mudar um filtro: não restaura. Desmarcar "lembrar chave": a chave some do `localStorage` e permanece no campo até fechar a aba.
