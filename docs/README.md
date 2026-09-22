# Documentação

A documentação deste projeto segue **docs as code**: mora no repositório, em Markdown, versionada junto com o código, e muda no **mesmo commit** que o código que descreve. Uma feature sem documento atualizado é uma feature incompleta — vale para criar, alterar comportamento e remover.

## Papéis

| Onde | Para quem | O que |
|---|---|---|
| `README.md` | quem usa | o que o app faz, como usar, parâmetros de URL, privacidade, publicação |
| `docs/features/*.md` | quem quer entender ou mexer numa feature | comportamento completo, regras e limiares, decisões e por quê, limites, como testar |
| `CLAUDE.md` | quem mexe no código (pessoa ou agente) | arquitetura, arquivos, convenções, armadilhas |

Não duplicar: um detalhe fica no lugar mais específico e os outros linkam. Limiares, constantes e nomes de função citados aqui existem no código com o mesmo valor — ao mudar um, procurar em `docs/`.

## Template de feature

```markdown
# Nome da feature

**Arquivos**: `js/x.js` (funções principais) · `css/estilo.css` (seletores)

## Objetivo
Que problema do usuário resolve, em 2-3 frases.

## Como usar
O que o usuário faz e vê. Parâmetros de URL, se houver.

## Como funciona
Fluxo, regras, limiares e fórmulas — com os nomes das funções e constantes.

## Decisões
Cada decisão não óbvia com o porquê e as alternativas descartadas.

## Limites
O que a feature não faz, e casos em que se comporta de forma inesperada.

## Como testar
Roteiro manual (e, se existir, como reproduzir com dados sintéticos).
```

Seções vazias são removidas, não deixadas em branco. Frases curtas; números concretos.

## Índice

| Feature | Documento |
|---|---|
| Busca na API e período analisado | [busca-e-periodo.md](features/busca-e-periodo.md) |
| Placar, resumo e perfil (modo simples) | [placar-e-resumo.md](features/placar-e-resumo.md) |
| Indicadores e achados automáticos (modo avançado) | [indicadores.md](features/indicadores.md) |
| Comparação com o período anterior | [comparacao-de-periodos.md](features/comparacao-de-periodos.md) |
| Evolução dentro do período | [evolucao-no-periodo.md](features/evolucao-no-periodo.md) |
| Aberturas e tabuleiro | [aberturas.md](features/aberturas.md) |
| Gráfico de rating | [grafico-de-rating.md](features/grafico-de-rating.md) |
| Lista de partidas, filtro e CSV | [lista-de-partidas.md](features/lista-de-partidas.md) |
| Análise com IA e exportação em PDF | [analise-com-ia.md](features/analise-com-ia.md) |
| Motor de análise (Stockfish) | [motor-de-analise.md](features/motor-de-analise.md) |
| Modo streamer / OBS | [modo-streamer.md](features/modo-streamer.md) |
| Parâmetros de URL e link compartilhável | [parametros-de-url.md](features/parametros-de-url.md) |
| Persistência no navegador | [persistencia.md](features/persistencia.md) |
