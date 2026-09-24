# Placar, resumo e perfil

**Arquivos**: `js/placar.js` (`render`, `renderResumo`, `renderPerfil`, `renderComparativo`)

## Objetivo

Abrir o relatório respondendo "como foi meu período" em números: placar, forma recente, brancas × pretas, sequência, ritmo e o gráfico de rating. É o cabeçalho do documento — o diagnóstico vem logo abaixo, em [indicadores](indicadores.md).

## Como usar

O placar e o resumo abrem a página, sempre visíveis. Com mais de uma modalidade no período, abas (bullet/blitz/rápida/diária) trocam o recorte de tudo — placar, resumo, diagnóstico, evidência e lista.

## Como funciona

- **Placar**: vitórias, empates, derrotas, variação de rating (soma das diferenças entre a primeira e a última ranqueada da modalidade), aproveitamento = (V + E/2) ÷ partidas, e a linha `rating: antes → depois`.
- **Resumo em uma frase** (`renderResumo`): o placar em texto, com a variação de rating. Os achados automáticos **não** são destilados aqui: aparecem inteiros na seção de diagnóstico logo abaixo, e repetir os dois primeiros em cima deles era eco, não resumo.
- **Mini-cards**: forma recente (últimas 10 partidas como pontos coloridos e pontos somados), brancas × pretas (aproveitamento de cada cor), sequência atual (com "talvez seja hora de pausar" a partir de 2 derrotas seguidas) e ritmo (partidas por dia com partidas).
- **Gráfico**: sparkline do rating da modalidade, com pico e vale marcados; clique ou "⤢ Ampliar" abre o [gráfico interativo](grafico-de-rating.md).
- **Perfil** (`renderPerfil`): avatar, título, país (emoji da bandeira a partir do código de 2 letras), membro desde, liga; rating atual, melhor rating e histórico total da modalidade vindos de `/stats`. Se o "melhor" tem data até 30 dias após o cadastro, é o rating **provisório** inicial — nesse caso o painel mostra o melhor do período no lugar, com link para a partida.

## Decisões

- **Sem modo simples e avançado.** Eram dois estados exclusivos para o mesmo conteúdo, com um toggle para navegar entre eles. Na página-documento o resumo abre e o aprofundamento está abaixo: a rolagem substitui o toggle, e some um eixo de estado de `linkAtual()`, do bootstrap e do CSS.

## Limites

- O placar de rating some quando o período só tem amistosas (`antes` fica indefinido). Quando há partida ranqueada mas nenhuma anterior como referência (conta nova na modalidade — o mês anterior ao início é baixado justamente para servir de referência), `antes` cai para o rating da 1ª partida, que já embute o resultado dela: o placar mostra `≈323 → 797 +474` (o `≈` vem de `estado.aprox[tc]`) em vez de `? → 797` com variação 0, e a variação fica alguns pontos abaixo da real. Validado com a conta `luizspinelli`, cujas primeiras partidas de rápida são de julho/2026.
- O "histórico total" é da API e inclui partidas contra bots, diferente do resto do painel.

## Como testar

Buscar um nick com várias modalidades e alternar as abas: placar, resumo, diagnóstico e lista devem mudar juntos. No celular (largura 390): quatro mini-cards em duas colunas, gráfico visível sem rolar horizontal.
