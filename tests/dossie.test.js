const test = require('node:test'), assert = require('node:assert/strict');
const {armazem} = require('./_ambiente');

// partidas mínimas com PGN legal curto: o dossiê só precisa de lances e resultado
const pgn = '[ECOUrl "https://www.chess.com/openings/Scotch-Game"]\n\n1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:50]} Nc6 {[%clk 0:09:40]} 3. d4 {[%clk 0:09:30]} exd4 {[%clk 0:09:20]} 1-0';
const jogo = (i, venceu = i % 2 === 0) => ({url: 'g' + i, end_time: 1_700_000_000 + i * 3600, time_class: 'rapid', rated: true, rules: 'chess', time_control: '600', pgn,
  white: {username: 'Eu', rating: 800 + i, result: venceu ? 'win' : 'resigned'}, black: {username: 'Outro', rating: 800, result: venceu ? 'resigned' : 'win'}});

test('nDossie(): 100 por padrão; aceita só os tamanhos previstos', () => {
  armazem.delete('placar-chesscom:nDossie');
  assert.equal(nDossie(), 100);
  armazem.set('placar-chesscom:nDossie', '300'); assert.equal(nDossie(), 300);
  armazem.set('placar-chesscom:nDossie', '999'); assert.equal(nDossie(), 100, 'valor fora da lista cai para o padrão');
  armazem.delete('placar-chesscom:nDossie');
});

test('dossiePartidas(): corta nas últimas N, exige 10+ com lances, e o mesmo N alimenta partidasParaMotor', () => {
  const jogos = Array.from({length: 30}, (_, i) => jogo(i));
  assert.equal(dossiePartidas(jogos, 'eu', 12).n, 12);
  assert.equal(dossiePartidas(jogos, 'eu').n, 30, 'com menos partidas que N, entram todas');
  armazem.set('placar-chesscom:nDossie', '200');
  const muitos = Array.from({length: 250}, (_, i) => jogo(i));
  assert.equal(dossiePartidas(muitos, 'eu').n, 200); assert.equal(partidasParaMotor(muitos).length, 200);
  armazem.delete('placar-chesscom:nDossie');
  assert.equal(partidasParaMotor(muitos).length, 100);
  assert.throws(() => dossiePartidas(muitos.slice(0, 9), 'eu'), /pelo menos 10/);
  const d = dossiePartidas(jogos, 'eu', 12).texto;
  assert.ok(d.includes('RESUMO DAS 12 PARTIDAS') && d.includes('#12 ·') && !d.includes('#13 ·'));
  assert.ok(!d.includes('Motor ('), 'sem avaliações do motor, o bloco do motor não aparece');
});

test('dossiePartidas(): derrotas completas (lances, marcos, relógio), vitórias em linha curta', () => {
  const jogos = Array.from({length: 12}, (_, i) => jogo(i));   // pares vencem, ímpares perdem
  const linhas = dossiePartidas(jogos, 'eu', 12).texto.split('\n#').slice(1);
  const vitorias = linhas.filter(l => l.includes('· vitória por')), derrotas = linhas.filter(l => l.includes('· derrota por'));
  assert.equal(vitorias.length, 6); assert.equal(derrotas.length, 6);
  for (const l of derrotas) assert.ok(l.includes('lances: 1.e4') && l.includes('roque:') && l.includes('relógio:'), 'derrota traz lances, marcos e relógio');
  for (const l of vitorias) { assert.ok(!l.includes('lances: 1.'), 'vitória não traz os lances'); assert.ok(l.includes('roque: ') && l.includes('relógio final:'), 'vitória traz roque e relógio final'); }
});
