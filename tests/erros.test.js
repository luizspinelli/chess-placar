const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('chanceVitoria(): 50% no zero, simétrica, mate nos extremos', () => {
  assert.equal(chanceVitoria(0), 50);
  assert.ok(Math.abs(chanceVitoria(100) + chanceVitoria(-100) - 100) < 1e-9);
  assert.ok(chanceVitoria(300) > 70 && chanceVitoria(300) < 80, '300 cp ≈ 75%');
  assert.equal(chanceVitoria(MATE_BASE + 3), 100); assert.equal(chanceVitoria(-(MATE_BASE + 1)), 0);
});

test('errosDaPartida(): classifica pela queda de chance do lado que moveu, marca o decisivo e lê o relógio', () => {
  const g = {url: 'g-teste', white: {username: 'Eu'}, black: {username: 'Ela'},
    pgn: '1. e4 {[%clk 0:09:50]} 1... e5 {[%clk 0:09:55]} 2. Nf3 {[%clk 0:09:00]} 2... Nc6 {[%clk 0:09:40]} 3. Bc4 {[%clk 0:00:20]} 3... Nf6 {[%clk 0:09:30]} *'};
  // e[i] = avaliação depois do i-ésimo lance, do ponto de vista das brancas
  armazem.gravar('evals', g.url, {p: 12, t: 0, e: [20, 30, 25, -350, -340, -900, -950], m: [null, null, 'Nc3', null, 'd4', null]});
  const r = errosDaPartida(g, 'eu');
  assert.equal(r.prof, 12);
  assert.equal(r.erros.length, 2, 'só os lances das brancas (eu) contam');
  const [grave, leve] = r.erros;
  assert.equal(grave.lance, 2); assert.equal(grave.san, 'Nf3'); assert.equal(grave.grau, 'grave'); assert.equal(grave.melhor, 'Nc3'); assert.equal(grave.relogio, 540);
  assert.ok(grave.antes > 50 && grave.depois < 30, `chance ${grave.antes} → ${grave.depois}`);
  assert.equal(leve.lance, 3); assert.equal(leve.grau, 'imprecisão', '−340 → −900 é queda de ~14 pp');
  assert.equal(r.decisivo, grave, 'primeiro erro que deixa a chance abaixo de 30% sem voltar');
  assert.equal(r.meus.length, 3);
  assert.equal(errosDaPartida({url: 'sem-cache'}, 'eu'), null);
});

test('resumoErros(): agrega por fase e faixa de relógio e lista o decisivo das derrotas', () => {
  const g = {url: 'g-teste', white: {username: 'Eu'}, black: {username: 'Ela'}, pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 *'};
  armazem.gravar('evals', g.url, {p: 12, t: 0, e: [20, 30, 25, -350, -340, -900, -950]});
  const res = resumoErros([{g, r: 'l', adv: {username: 'Ela'}, dt: new Date(0), ts: 0}], 'eu');
  assert.equal(res.n, 1); assert.equal(res.cont.grave, 1); assert.equal(res.cont.imprecisão, 1);
  assert.equal(res.fase['Abertura (até 15)'], 1, 'graves + erros por fase; imprecisão não entra');
  assert.equal(res.decisivos.length, 1); assert.equal(res.decisivos[0].er.lance, 2);
  assert.deepEqual(res.lancesRelogio, {}, 'sem relógio no PGN, sem faixa');
});
