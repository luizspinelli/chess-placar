# Parâmetros de URL e link compartilhável

**Arquivos**: `js/app.js` (`linkAtual`, bloco de bootstrap)

## Objetivo

Tudo que está no formulário cabe na URL: favoritos por período, compartilhar uma vista exata.

## Como usar

**Copiar link** gera o endereço completo do estado atual (vai para a área de transferência; sem permissão, aparece na barra de status). A tabela de parâmetros está no [README](../../README.md#parâmetros-de-url).

## Como funciona

- `linkAtual()` só inclui o que difere do padrão (exceções: `periodo` e `tc` sempre saem, para o link ser autoexplicativo). Regras que não são óbvias: `comparar=0` só sai quando o automático valeria e a caixa está desmarcada (ver [comparação](comparacao-de-periodos.md)); `modo=avancado` sai quando o body não tem `simples`.
- O bloco final de `app.js` lê os parâmetros na carga, na ordem: tema (URL, depois `localStorage`), nick, período (`aplicarPeriodo`), datas do absoluto, modalidades, intervalo, bots, `comparar` (marca `comparManual`), `auto`, modo. Com `nick` busca na hora; sem, mostra a tela inicial.

## Decisões

- **Um parâmetro por controle do formulário.** Todo filtro novo entra em três lugares: `linkAtual()`, o bootstrap e a tabela do README. Sem os três, o link mente.
- **Omitir padrões.** Links curtos são mais fáceis de ler e de editar à mão.

## Limites

- A chave de IA, o modelo e a profundidade do motor **não** vão na URL — são do navegador.
- Filtro por adversário e aba de KPI ativa não vão na URL.

A barra de endereço **acompanha a tela**: `sincronizarURL()` chama `history.replaceState` com `linkAtual()` após cada busca e ao trocar de aba de modalidade (`aba`) ou de indicadores (`kpi`), sem criar entradas no histórico. Os dois parâmetros de aba só entram quando fogem do padrão (mais de uma modalidade na busca; aba diferente de Análise no modo avançado).

## Como testar

Preencher tudo, Copiar link, abrir em janela anônima: a mesma vista deve aparecer (inclusive caixa de comparação, tema e modo).
