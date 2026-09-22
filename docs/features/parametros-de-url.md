# Parâmetros de URL e link compartilhável

**Arquivos**: `js/app.js` (`linkAtual`, bloco de bootstrap)

## Objetivo

Tudo que está no formulário cabe na URL: favoritos por período, link para o OBS, compartilhar uma vista exata.

## Como usar

**Copiar link** gera o endereço completo do estado atual (vai para a área de transferência; sem permissão, aparece na barra de status). A tabela de parâmetros está no [README](../../README.md#parâmetros-de-url).

## Como funciona

- `linkAtual()` só inclui o que difere do padrão (exceções: `periodo` e `tc` sempre saem, para o link ser autoexplicativo). Regras que não são óbvias: `comparar=0` só sai quando o automático valeria e a caixa está desmarcada (ver [comparação](comparacao-de-periodos.md)); `modo=avancado` sai quando o body não tem `simples`; parâmetros de overlay saem com qualquer valor não padrão.
- O bloco final de `app.js` lê os parâmetros na carga, na ordem: tema (URL, depois `localStorage`), nick, período (`aplicarPeriodo`), datas do absoluto, modalidades, intervalo, bots, `comparar` (marca `comparManual`), overlay, `auto`/`streamer`, modo. Com `nick` (ou `streamer=1` com nick salvo) busca na hora; sem, mostra a tela inicial.

## Decisões

- **Um parâmetro por controle do formulário.** Todo filtro novo entra em três lugares: `linkAtual()`, o bootstrap e a tabela do README. Sem os três, o link mente.
- **Omitir padrões.** Links curtos são mais fáceis de ler e de editar à mão no OBS.

## Limites

- A chave de IA, o modelo e a profundidade do motor **não** vão na URL — são do navegador.
- Filtro por adversário e aba de KPI ativa não vão na URL.

## Como testar

Preencher tudo, Copiar link, abrir em janela anônima: a mesma vista deve aparecer (inclusive caixa de comparação, tema, modo e overlay).
