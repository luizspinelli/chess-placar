const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

const PGN = `[Event "Live Chess"]
[ECO "B90"]
[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3"]
[TimeControl "600"]

1. e4 {[%clk 0:09:58]} 1... c5 {[%clk 0:09:57.3]} 2. Nf3 {[%clk 0:09:50]} 2... d6 {[%clk 0:09:55]} 3. d4 {[%clk 0:09:40]} 3... cxd4 {[%clk 0:09:50]} 4. Nxd4 {[%clk 0:09:30]} 1-0`;

test('parsePGN(): abertura pelo ECOUrl, todos os lances, relógios, memoização', () => {
  const g = {pgn: PGN};
  const pg = parsePGN(g);
  assert.equal(pg.eco, 'B90');
  assert.equal(pg.variante, 'Sicilian Defense Najdorf Variation', 'slug até o primeiro trecho com número');
  assert.equal(pg.familia, 'Sicilian Defense', 'até a palavra-chave Defense');
  assert.deepEqual(pg.san, ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4'], 'todos os lances, sem números nem resultado');
  assert.equal(pg.meias, 7); assert.equal(pg.lances, 4);
  assert.equal(pg.clks.length, 7); assert.equal(pg.clks[0], 598); assert.ok(Math.abs(pg.clks[1] - 597.3) < 1e-9, 'décimos de segundo preservados');
  assert.equal(pg.primeiro, 'e4'); assert.equal(pg.resposta, 'c5');
  assert.equal(pg.url, 'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3');
  assert.equal(parsePGN(g), pg, 'memoizado em g._pgn');
});

test('parsePGN(): sem ECOUrl cai no código ECO; sem PGN não quebra', () => {
  const pg = parsePGN({pgn: '[ECO "C50"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 *'});
  assert.equal(pg.variante, 'C50'); assert.equal(pg.url, ''); assert.equal(pg.meias, 5);
  const vazio = parsePGN({});
  assert.equal(vazio.meias, 0); assert.deepEqual(vazio.san, []); assert.equal(vazio.variante, '?');
});

test('parsePGN(): ECOUrl fora do domínio do Chess.com não vira link', () => {
  const pg = parsePGN({pgn: '[ECOUrl "https://evil.example/x"]\n\n1. e4 *'});
  assert.equal(pg.url, '');
});
