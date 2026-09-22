# Comparação com o período anterior

**Arquivos**: `js/periodo.js` (`periodoAnterior`, `comparaAuto`, `comparManual`) · `js/busca.js` (acúmulo de `estado.comp`) · `js/placar.js` (`renderComparativo`) · `js/indicadores.js` (achados) · `js/ia.js` (linha no resumo)

## Objetivo

Dizer se o jogador evoluiu: partidas, aproveitamento, rating e precisão do período comparados com o recorte equivalente imediatamente anterior.

## Como usar

A caixa **Comparar com período anterior** já vem marcada nos períodos relativos de até ~6 meses. Com ela ligada, o placar ganha uma faixa "vs. dd/mm a dd/mm" com cada métrica e a variação (▲/▼). Desmarcar vale dali em diante (o automático não religa). Na URL: `comparar=1` liga, `comparar=0` desliga.

## Como funciona

- **Período anterior** (`periodoAnterior`): nos recortes de calendário é o **bloco completo anterior** — mês em curso × mês anterior inteiro, `3m` × os 3 meses de calendário antes, ano × ano anterior. Nos rolling (`Nd`, `Nw`) e no absoluto, a **mesma duração** imediatamente antes do início. `recuaMes` recua meses mantendo o dia (28/02 quando o dia não existe).
- `buscar` começa a janela de meses baixados em `periodoAnterior` e, na mesma passada, acumula `estado.comp.tc[modalidade] = {n, w, d, l, acc, accN, antes, depois}` — **só agregados**, porque `estado` inteiro vai para o `localStorage`.
- **Comparação automática**: `aplicarPeriodo` marca a caixa quando `comparaAuto(v)` — `duracaoEmDias(v) ≤ 190` (dias × 1, semanas × 7, meses × 30; `mes` e `mes-1` contam 30; `ano` e `custom` são infinito). Ao mexer na caixa, `comparManual = true` e o automático para de agir. `linkAtual()` grava `comparar=0` quando o automático valeria e a caixa está desmarcada, para o link reproduzir a escolha; o bootstrap lê o parâmetro e já marca `comparManual`.
- **Faixa** (`renderComparativo`): partidas, aproveitamento (variação em pp), rating (se houver ranqueadas nos dois lados) e precisão (só com ≥5 partidas analisadas em cada lado).
- **Achados** (exigem ≥15 partidas em cada lado, porque só há agregados): rendendo mais/menos que antes (≥8 pp), rating vs. anterior (diferença ≥25), precisão vs. anterior (≥2), volume muito diferente (uma amostra ≥1,5× a outra — aviso de que a comparação é instável).
- O resumo para a IA ganha a linha "Período anterior equivalente" quando o anterior tem ≥10 partidas.

## Decisões

- **Bloco de calendário completo, não o mesmo trecho.** Comparar "1 a 18 de setembro" com "1 a 18 de agosto" parece justo, mas o jogador pensa "este mês vs. mês passado"; e o rolling já cobre quem quer janela igual.
- **Automático até ~190 dias, não sempre.** A comparação dobra as requisições; no ano inteiro seriam 12 arquivos mensais extras só para a faixa. O limite deixa de fora exatamente `ano` e `12m`.
- **Respeitar a decisão manual.** Religar a caixa a cada troca de período seria briga com o usuário. A flag some ao recarregar — a URL preserva a escolha.
- **Agregados, não partidas.** Guardar as partidas do período anterior dobraria o `localStorage` e obrigaria a filtrar tudo duas vezes; os quatro achados que a comparação sustenta só precisam de contagens.

## Limites

- Sem partidas da modalidade no período anterior, a faixa avisa e os achados não disparam.
- A faixa compara a modalidade da aba ativa; trocar de aba troca a comparação.

## Como testar

`?nick=x&periodo=4w` deve abrir com a caixa marcada e a faixa visível; `periodo=ano` sem a faixa; `periodo=4w&comparar=0` sem a faixa e, ao clicar em outro atalho, a caixa continua desmarcada. Em `3m`, o rótulo da faixa deve ser os três meses de calendário anteriores inteiros.
