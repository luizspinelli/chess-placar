# Persistência no navegador

**Arquivos**: `js/base.js` (`lerLS`, `gravarLS`, `cache`) · `js/busca.js` (`salvarUltima`, `carregarUltima`, nicks) · `js/motor.js` (cache de avaliações) · `js/ia.js` (chaves)

## Objetivo

Abrir o app e ver o placar na hora, lembrar preferências e chaves, e não repetir trabalho caro (requisições, avaliações do motor) — tudo sem servidor.

## Como funciona

Todas as chaves do `localStorage` têm o prefixo `placar-chesscom:` e são acessadas em `try/catch` (`lerLS`/`gravarLS`): navegador em modo privado ou cota estourada não quebram o app.

| Chave | Conteúdo | Regra |
|---|---|---|
| `nicks` | até 10 nicks recentes | o mais recente primeiro |
| `tema`, `modo` | `claro`/`escuro`, `simples`/`avancado` | URL tem precedência |
| `ultima` | `{chave, quando, estado}` da última busca | `estado.jogos` **sem `pgn`, `tcn`, `fen`, `initial_setup`** — a cota não comporta; `chave` é `chaveBusca(nick)` = JSON de todos os filtros, e a restauração só acontece se bater exatamente |
| `provedor`, `chave:{p}`, `modelo:{p}`, `lembrarChave` | configuração da IA | com "lembrar" desmarcado a chave fica só em `chavesMemoria` (vida da aba); desmarcar apaga as gravadas |
| `motorProf` | profundidade escolhida | |
| `evals` | `{url: {p, t, e}}` avaliações do motor | poda para as 600 mais recentes por `t` |

- **Restauração** (`carregarUltima`): numa busca nova com a mesma chave, o painel renderiza o estado salvo imediatamente com o aviso "Dados salvos … · atualizando…" e busca a API em seguida. Como os PGNs não estão lá, tudo que depende de lances (dossiê da IA, motor) fica indisponível até a busca real terminar — e avisa.
- **Cache de rede** (`cache`, `Map` em memória): resposta + ETag por URL; morre com a aba. Serve à atualização automática (só o mês corrente é rebaixado) e ao `If-None-Match`.

## Decisões

- **Guardar a última busca sem PGN.** Um mês de bullet passa de 5 MB com PGN; sem, cabe. O que depende de lances é recalculado a partir de `g._pgn` enquanto a busca está em memória — e é por isso que `parsePGN` roda antes de compactar.
- **Chave de IA opcionalmente só na aba.** Máquina compartilhada. Não protege contra XSS — nada no cliente protege; a mitigação é não ter script de terceiros e escapar tudo da API.
- **Evals por URL, com poda.** A URL da partida é estável e única; 600 partidas são ~300 KB, longe da cota, e cobrem várias buscas de 100.

## Limites

- Tudo é por navegador e por origem: outro navegador ou dispositivo começa do zero.
- Limpar dados do site apaga as chaves de IA e as avaliações do motor.

## Como testar

Buscar, recarregar com o mesmo nick e filtros: o placar aparece na hora com "Dados salvos". Mudar um filtro: não restaura. Desmarcar "lembrar chave": a chave some do `localStorage` e permanece no campo até fechar a aba.
