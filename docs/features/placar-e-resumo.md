# Placar, resumo e perfil (modo simples)

**Arquivos**: `js/placar.js` (`render`, `renderResumo`, `renderPerfil`, `renderComparativo`) · `js/app.js` (`aplicarModo`)

## Objetivo

Responder em uma tela, sem rolar, "como foi meu período": placar, o que mais pesou, ponto forte, forma recente e o gráfico de rating. O modo avançado (dez abas) fica a um clique.

## Como usar

O app abre no **modo simples**. "Ver análise completa →" abre o modo avançado; "← Resumo" volta. A escolha fica salva (`placar-chesscom:modo`) e pode ir na URL (`modo=avancado`). Com mais de uma modalidade no período, abas (bullet/blitz/rápida/diária) trocam o recorte de tudo — placar, resumo, indicadores e lista.

## Como funciona

- **Placar**: vitórias, empates, derrotas, variação de rating (soma das diferenças entre a primeira e a última ranqueada da modalidade), aproveitamento = (V + E/2) ÷ partidas, e a linha `rating: antes → depois`.
- **Resumo em frases** (`renderResumo`): a primeira frase é o placar em texto. A segunda ("O que mais pesa") é o primeiro achado automático do tipo alerta ou atenção; a terceira ("Ponto forte") é o primeiro do tipo bom. Achados sobre aberturas ficam para o fim da fila porque só fazem sentido com o nome da abertura na frente. Só a primeira sentença de cada achado entra.
- **Mini-cards**: forma recente (últimas 10 partidas como pontos coloridos e pontos somados), brancas × pretas (aproveitamento de cada cor), sequência atual (com "talvez seja hora de pausar" a partir de 2 derrotas seguidas) e ritmo (partidas por dia com partidas).
- **Gráfico**: sparkline do rating da modalidade, com pico e vale marcados; clique ou "⤢ Ampliar" abre o [gráfico interativo](grafico-de-rating.md).
- **Perfil** (`renderPerfil`): avatar, título, país (emoji da bandeira a partir do código de 2 letras), membro desde, liga; rating atual, melhor rating e histórico total da modalidade vindos de `/stats`. Se o "melhor" tem data até 30 dias após o cadastro, é o rating **provisório** inicial — nesse caso o painel mostra o melhor do período no lugar, com link para a partida.

## Decisões

- **Resumo derivado dos achados, não escrito à parte.** Assim a frase do resumo e o card da aba Análise nunca discordam, e um achado novo aparece no resumo sem código extra.
- **Modo simples como padrão.** A maioria abre no celular para ver o placar do dia; dez abas de indicadores assustam. Quem quer profundidade está a um clique.

## Limites

- O placar de rating some quando o período só tem amistosas (`antes` fica `null`).
- O "histórico total" é da API e inclui partidas contra bots, diferente do resto do painel.

## Como testar

Buscar um nick com várias modalidades e alternar as abas: placar, resumo e lista devem mudar juntos. Conferir o modo simples no celular (largura 390): quatro mini-cards em duas colunas, gráfico visível sem rolar horizontal.
