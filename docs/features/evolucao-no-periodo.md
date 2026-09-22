# Evolução dentro do período

**Arquivos**: `js/periodo.js` (`evolucaoDoPeriodo`, `rotuloBloco`) · `js/indicadores.js` (card na aba Resultados, acúmulo no laço de Resultados)

## Objetivo

Quem pede "últimas 4 semanas" quer ver semana a semana; "3 meses", mês a mês; "5 dias", dia a dia. O card mostra a curva dentro do período em vez de um único número.

## Como usar

Escolha um período relativo com número (`4w`, `3m`, `5d`, `30d`…). A aba **Resultados** abre com o card **Evolução semana a semana / mês a mês / dia a dia**: uma linha por bloco com aproveitamento (barra + V-E-D) e variação de rating. Períodos de calendário (`mes`, `ano`), absoluto e `1d` não geram o card.

## Como funciona

- `evolucaoDoPeriodo(ini, fim)` lê o atalho (`^(\d+)([dwm])$`), exige `n ≥ 2` e monta os blocos na **unidade do próprio atalho**: `m` = meses de calendário a partir do dia 1º; `d`/`w` = janelas de 24 h ou 7 dias a partir do início rolling. O último bloco fecha em `fim` (ou agora).
- Acima de 12 blocos agrupa: `passo = ceil(n / 12)` unidades por bloco (`30d` → 10 blocos de 3 dias); o título vira "a cada 3 dias".
- Rótulos (`rotuloBloco`): mês fechado é `set/26`; nos rolling o corte cai no meio do dia, então o rótulo é o intervalo (`11/09 – 18/09`) em vez de fingir dia cheio.
- O resultado `{titulo, blocos: [{ini, fim, rotulo}]}` vai para `estado.evolucao`, calculado sobre a janela **realmente buscada**. `kpis()` acumula V-E-D e Δ rating por bloco na mesma passada dos Resultados (`achaBloco`); o último bloco fica **aberto à direita** porque a atualização automática traz partidas depois do fim calculado.
- O card entra no PDF e no resumo da IA pelo caminho genérico dos cards (a linha de cabeçalho de coluna tem a primeira célula vazia e é ignorada).

## Decisões

- **Blocos na unidade do atalho, não em calendário.** "4 semanas" a partir de agora não coincide com semanas de segunda a domingo; snapping criaria um primeiro bloco de 3 dias e um sexto bloco — não é o que o usuário pediu.
- **Guardar em `estado`, não recalcular no render.** O usuário pode mudar o período no formulário sem buscar; o card deve continuar descrevendo os dados na tela.
- **Teto de 12 linhas.** Com 30 linhas o card vira lista, não curva; agrupar preserva a leitura.

## Limites

- Blocos com poucas partidas mostram porcentagens instáveis; o card não esconde blocos pequenos (a IA recebe o N de cada um e o prompt já manda desconfiar de amostras curtas).

## Como testar
Automatizado: `tests/periodo.test.js` cobre `evolucaoDoPeriodo` (blocos na unidade do atalho, agrupamento acima de 12, nada com 1 bloco).

`4w` → 4 linhas; `3m` → 3 meses de calendário (o primeiro começa no dia 1º); `5d` → 5 janelas com rótulo de intervalo; `30d` → 10 blocos "a cada 3 dias"; `1d`, `ano`, absoluto → sem card. Somar V-E-D dos blocos deve dar o placar.
