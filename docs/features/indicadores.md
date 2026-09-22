# Indicadores e achados automáticos (modo avançado)

**Arquivos**: `js/indicadores.js` (`kpis`, `GLOSSARIO`, `renderKpis`) · `js/base.js` (helpers `card`, `tabela`, `kv`, `linha`)

## Objetivo

Transformar a lista de partidas em leitura: onde o jogador rende mais e menos (cor, horário, sessão, abertura, relógio) e o que, estatisticamente, merece atenção.

## Como usar

No modo avançado, dez abas agrupadas em **Visão geral** (Análise, Resultados, Rating), **Como você joga** (Aberturas, Lances e relógio, Erros e precisão) e **Contexto** (Adversários, Sessões, Horários, Volume). Todo card com conceito não óbvio tem um "?" com a explicação (`GLOSSARIO`). No desktop, o modo avançado **rola como página**: a lista de partidas vai para baixo dos indicadores e o grid de cards ocupa a largura toda (3 colunas; 4 acima de 1700 px), com o formulário e a barra de abas fixos ao rolar. O modo simples mantém o layout de três colunas com a lista ao lado, sem rolagem — é o modo de olhar o placar; o avançado é o de ler. A barra de abas **nunca rola**: quebra em linhas em qualquer largura — a rolagem horizontal com barra escondida deixava abas fora da tela tanto no celular quanto na coluna estreita do desktop.

## Como funciona

`kpis(jogos, nick)` faz **uma passada** pelas partidas ordenadas e devolve `{nomeDaAba: html}`. Convenções: resultado é `'w' | 'd' | 'l'` (empates no Set `DRAWS`); aproveitamento = (V + E/2) ÷ N; as barras verdes dos cards são aproveitamento.

| Aba | Cards | Regras e limiares |
|---|---|---|
| Resultados | [Evolução no período](evolucao-no-periodo.md), cor, adversário, como terminaram, ranqueadas × amistosas, variantes | "Mais forte / parelho / mais fraco" = rating do adversário ±25 do seu **antes** da partida. A API devolve o rating **depois**; comparar com ele embute o resultado (perdeu → o adversário parece mais forte; num caso real deu 0-0-94 contra "mais fortes" e 115-0-1 contra "mais fracos"). O de antes é estimado: meu − minha variação; do adversário + minha variação. Sem variação conhecida, a partida fica fora da faixa |
| Rating | curva por modalidade, maior ganho/perda, alta e queda acumuladas, marcos | queda = maior descida a partir de um pico (drawdown); marco = primeira vez que cruzou cada múltiplo de 50 |
| Aberturas | ver [aberturas.md](aberturas.md) | |
| Lances e relógio | lances, fase em que termina, por duração, relógio ao final, quem tinha mais tempo, controle, derrotas por tempo | fase: ≤15 lances abertura, 16–40 meio-jogo, 41+ final; relógio vem do `[%clk]` do PGN, ignorado em partidas diárias |
| Erros e precisão | os cards do [motor](motor-de-analise.md) primeiro; depois a precisão do Chess.com: média, por cor, por período do dia, por posição na sessão, você × adversário | precisão é a métrica do Chess.com, só nas partidas analisadas no site; sem nenhuma analisada, os cinco cards viram uma linha explicando |
| Adversários | mais enfrentados (10), por faixa de 50 de rating, rating médio por mês | faixas e médias usam o rating estimado de antes da partida; as faixas baixas costumam ser o começo do período, quando o próprio jogador tinha aquele rating |
| Sessões | sessões, posição na sessão, como terminou, tilt, sequências | **sessão** = partidas com menos de 30 min entre uma e outra (`SESSAO`); posições 1ª, 2ª, 3ª–5ª, 6ª+; **tilt** = rendimento após uma e após duas derrotas seguidas |
| Horários | período do dia, dia da semana, mapa de calor, horários | madrugada <6h, manhã <12h, tarde <18h, noite; **hora média** é circular (23h e 1h dão 0h, não 12h); mapa de calor: cor = aproveitamento ≥50% verde, intensidade = volume |
| Volume | partidas, melhor e pior dia, aproveitamento por mês, partidas por semana | semana começa na segunda |

### Achados automáticos (aba Análise)

Heurísticas com **amostra mínima**; ordenadas por prioridade (▲ alerta, ● atenção, ✔ bom, ℹ info). Se nenhuma dispara, "Nada fora do padrão".

| Achado | Condição |
|---|---|
| Diferença entre as cores | ≥20 partidas de cada cor e diferença de aproveitamento ≥8 pp |
| Tilt / Reação a derrotas | ≥10 partidas após duas derrotas; aproveitamento <geral−10 pp (alerta) ou >geral+5 pp (bom) |
| Sessões longas | ≥10 partidas na 6ª+ e aproveitamento <1ª−10 pp |
| Desiste muito | ≥15 derrotas e desistências >1,5× mates (atenção se rating <1800, info acima) |
| Derrotas por tempo | ≥15 derrotas e ≥15% por tempo |
| Perde com tempo sobrando | ≥10 derrotas com relógio e média ≥40% do tempo inicial restante |
| Período do dia / Dia da semana | duas faixas com ≥15 partidas e diferença ≥15 pp |
| Abertura problemática / forte | mínimo de partidas por variante escala com o total (5, 10 a partir de 150, 15 a partir de 300); ≤35% ou ≥65% |
| Converte mal | ≥20 analisadas, ≥5 derrotas com precisão maior que o adversário e ≥25% das derrotas |
| Tendência de alta / queda | ≥20 ranqueadas; média da segunda metade difere da primeira em ≥20 pontos |
| Finais | ≥15 partidas no final e aproveitamento <meio-jogo−10 pp |
| Fim de sessão | ≥10 sessões e parou após derrota >1,5× parou após vitória |
| Contra mais fracos | ≥15 partidas e aproveitamento <55% |
| Pior série | maior sequência de derrotas ≥5 |
| vs. período anterior (4) | ver [comparacao-de-periodos.md](comparacao-de-periodos.md) |
| do motor (4) | ver [motor-de-analise.md](motor-de-analise.md) |

Os achados alimentam o resumo do modo simples, o PDF e o prompt da IA.

## Decisões

- **Uma passada, HTML pronto.** `kpis` roda a cada `render()` (troca de aba de modalidade, atualização automática); gerar tudo de uma vez e guardar em `kpiData` mantém a troca de aba de KPI instantânea.
- **Limiares explícitos por achado**, em vez de um teste estatístico genérico: cada um foi calibrado para o que um treinador consideraria digno de nota, e o texto explica o número. Com amostra pequena o achado não aparece — melhor silêncio que falso alarme.
- **`GLOSSARIO` por prefixo de título.** O "?" aparece em qualquer card cujo título comece com uma chave; um card novo ganha ajuda só adicionando o verbete.

## Limites

- Tudo é descritivo, não causal: "rende menos à noite" pode ser "joga à noite quando está cansado", e o painel não distingue.
- As faixas de rating do adversário são absolutas; num período longo, misturam épocas.

## Como testar

Com um nick de muito volume (`hikaru`, `ano`), passar pelas dez abas: nenhum card vazio sem o texto "Sem dados"; barras de aproveitamento somando com o placar; achados com números que batem com os cards. Com `7d` de um jogador casual, conferir que a maioria dos achados **não** dispara.
