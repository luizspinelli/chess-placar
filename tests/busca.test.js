const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');
const DIA = 86400;
const jogo = (t, {eu = 1200, adv = 1210, res = 'win', tc = 'rapid', rated = true, bot = false, branco = true, acc} = {}) => {
  const eu_ = {username: 'Eu', rating: eu, result: res, uuid: 'u-eu'}, adv_ = {username: bot ? 'Coach-Bot' : 'Outro', rating: adv, result: res === 'win' ? 'resigned' : 'win', uuid: bot ? undefined : 'u-adv'};
  return {end_time: t, time_class: tc, rated, rules: 'chess', url: 'g' + t, white: branco ? eu_ : adv_, black: branco ? adv_ : eu_, accuracies: acc ? {white: acc, black: acc - 5} : undefined};
};
const f = (extra = {}) => ({nick: 'eu', inicioTs: 1000 * DIA, fimTs: Infinity, modalidades: new Set(['rapid']), soHumanos: true, comparando: true, iniAntTs: 990 * DIA, fimAntTs: 1000 * DIA - 1, ...extra});

test('montarPartidas(): delta pela ranqueada anterior, antes/depois, comparação só agregada, bots fora', () => {
  const todos = [
    jogo(995 * DIA, {eu: 1180, res: 'win', acc: 80}),          // período anterior: vira referência do delta e entra em compTc
    jogo(1001 * DIA, {eu: 1190, res: 'win'}),                  // 1ª do período: delta = 1190 − 1180
    jogo(1002 * DIA, {eu: 1182, res: 'resigned', branco: false}),
    jogo(1003 * DIA, {eu: 1182, bot: true}),                   // bot: ignorada e contada
    jogo(1004 * DIA, {eu: 1500, tc: 'blitz'}),                 // modalidade desmarcada: nem conta
    jogo(1005 * DIA, {eu: 1195, rated: false}),                // amistosa: ignorada
  ];
  const r = montarPartidas(todos, f());
  assert.equal(r.jogos.length, 2);
  assert.deepEqual(r.jogos.map(g => g.delta), [10, -8]);
  assert.equal(r.antes.rapid, 1180, 'rating antes = o da última ranqueada anterior ao período'); assert.equal(r.depois.rapid, 1182);
  assert.equal(r.ignoradas, 2, 'bot e amistosa dentro do período');
  assert.deepEqual(r.compTc.rapid, {n: 1, w: 1, d: 0, l: 0, acc: 80, accN: 1, antes: 1180, depois: 1180}, 'sem referência antes do comparativo, antes cai para a própria 1ª partida');
});

test('montarPartidas(): sem comparação não há compTc; primeira ranqueada sem referência tem delta null e antes aproximado pela própria partida', () => {
  const r = montarPartidas([jogo(1001 * DIA), jogo(1002 * DIA, {eu: 1208})], f({comparando: false}));
  assert.equal(r.compTc, null);
  assert.deepEqual(r.jogos.map(g => g.delta), [null, 8]); assert.equal(r.antes.rapid, 1200); assert.equal(r.aprox.rapid, true);
});

test('montarPartidas(): com referência no mês anterior, antes é exato e não há aprox', () => {
  const r = montarPartidas([jogo(999 * DIA, {eu: 1190}), jogo(1001 * DIA)], f({comparando: false}));
  assert.equal(r.antes.rapid, 1190); assert.equal(r.aprox.rapid, undefined); assert.equal(r.jogos[0].delta, 10);
});

test('mesesDaJanela(): cobre a janela e inclui o mês anterior como referência', () => {
  const arq = ['a/2026/06', 'a/2026/07', 'a/2026/08', 'a/2026/09'];
  assert.deepEqual(mesesDaJanela(arq, new Date(2026, 7, 15), null), ['a/2026/07', 'a/2026/08', 'a/2026/09']);
  assert.deepEqual(mesesDaJanela(arq, new Date(2026, 5, 10), null), arq, 'sem mês anterior disponível, começa no primeiro');
  assert.deepEqual(mesesDaJanela(arq, new Date(2026, 7, 1), new Date(2026, 7, 31)), ['a/2026/07', 'a/2026/08'], 'com fim, para no mês do fim');
  assert.deepEqual(mesesDaJanela(arq, new Date(2027, 0, 1), null), ['a/2026/09'], 'janela no futuro cai no último arquivo (monitorar a partir de agora)');
});

test('ehBot(): adversário sem uuid ou com nome de bot', () => {
  assert.equal(ehBot(jogo(1, {bot: true}), 'eu'), true);
  assert.equal(ehBot(jogo(1), 'eu'), false);
});
