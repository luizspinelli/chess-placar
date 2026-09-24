# Lista de partidas, filtro e CSV

**Arquivos**: `js/partidas.js` (`renderLista`, `filtroLista`, CSV)

## Objetivo

Ver e conferir as partidas que estão por trás dos números, achar o retrospecto contra um adversário e levar os dados para uma planilha.

## Como usar

Última seção da página, a lista da modalidade ativa, mais recente primeiro. Começa recolhida em qualquer largura ("Ver as 65 partidas ▾"): são as evidências de quem já leu o diagnóstico e quer conferir partida a partida, não a primeira coisa a mostrar: resultado (ponto colorido), adversário e rating, cor, motivo do fim, variação de rating, data e o link "ver". Paginação de 10/20/50. **Filtrar adversário** aceita parte do nick e mostra o retrospecto (`12 partidas · 10V 0E 2D`). **CSV** baixa as partidas listadas — respeitando o filtro.

## Como funciona

- `jogosAtuais` é a lista da modalidade ativa, invertida; `filtroLista()` aplica o filtro por substring do nick do adversário (minúsculas).
- CSV: separador `;`, BOM UTF-8 (para o Excel abrir acentos), campos com `;`/`"`/quebra de linha entre aspas, e valores que começam com `=`, `+`, `@` ou `-` ganham `'` na frente para não virarem fórmula. Colunas: data, hora, modalidade, controle, cor, adversário, rating do adversário, resultado, motivo, meu rating, variação, precisão, precisão do adversário, abertura, ECO, lances, URL. Nome do arquivo: `chesscom-{nick}-{modalidade}-{data}.csv`.

## Decisões

- **Filtro mostra retrospecto.** Digitar um nick é quase sempre "como estou contra ele"; o número vai direto no cabeçalho da paginação em vez de exigir contar.
- **`;` e BOM.** É o que abre certo no Excel em português sem assistente de importação.

## Limites

- O filtro é por nick, não por abertura ou resultado.
- A lista mostra só a modalidade da aba ativa; para tudo junto, um CSV por modalidade.

## Como testar

Filtrar por um adversário recorrente e conferir o retrospecto com a aba Adversários. Abrir o CSV no Excel/LibreOffice: acentos certos, colunas separadas, nenhum valor virando fórmula.
