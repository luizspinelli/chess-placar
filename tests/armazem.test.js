const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('armazem: sem IndexedDB cai para o espelho em memória, com falhou=true, e ler/gravar/podar/apagar funcionam', async () => {
  await armazem.pronto;
  assert.equal(armazem.falhou, true); assert.equal(armazem.bd, null);
  assert.equal(await armazem.gravar('evals', 'u1', {p: 10, t: 1, e: [0]}), false, 'gravar devolve false quando não há IndexedDB, mas o espelho recebe');
  assert.deepEqual(armazem.ler('evals', 'u1'), {p: 10, t: 1, e: [0]});
  for (let i = 2; i <= 6; i++) armazem.gravar('buscas', 'b' + i, {quando: i, versao: VERSAO_ESTADO, estado: {}});
  armazem.podar('buscas', 3);
  assert.deepEqual(Object.keys(armazem.todos('buscas')).sort(), ['b4', 'b5', 'b6'], 'poda mantém as mais recentes por quando');
  armazem.apagar('evals', 'u1'); assert.equal(armazem.ler('evals', 'u1'), undefined);
});

test('evalsDe/guardarEvals passam pelo armazém e pendentesMotor respeita a profundidade', () => {
  const g = {url: 'g-x', rules: 'chess', end_time: 1, pgn: '1. e4 e5 2. Nf3 Nc6 1-0'};
  assert.equal(evalsDe(g), null);
  guardarEvals(g, 10, {e: [10, -5, 20, 0], m: ['e4', 'e5', 'Nf3', 'Nc6']});
  assert.equal(evalsDe(g).p, 10);
  assert.deepEqual(pendentesMotor([g], 10), [], 'já avaliada nessa profundidade');
  assert.deepEqual(pendentesMotor([g], 12).map(x => x.url), ['g-x'], 'profundidade maior reabre a partida');
  guardarEvals(g, 10, null); assert.equal(evalsDe(g), null, 'e: null marca partida ilegível e não conta como avaliada');
  assert.deepEqual(pendentesMotor([g], 12), [], 'mas também não volta para a fila');
  armazem.apagar('evals', 'g-x');
});
