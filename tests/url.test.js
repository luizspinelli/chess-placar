const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('linkAtual(): abas só entram quando fogem do padrão', () => {
  $('nick').value = 'eu'; $('periodo').value = 'mes';
  estado = {jogos: [{time_class: 'rapid'}, {time_class: 'blitz'}]}; aba = 'blitz'; abaKpi = 'Aberturas';
  const q = new URL(linkAtual()).searchParams;
  assert.equal(q.get('aba'), 'blitz'); assert.equal(q.get('kpi'), 'Aberturas'); assert.equal(q.get('periodo'), 'mes');
  estado = {jogos: [{time_class: 'rapid'}]}; aba = 'rapid'; abaKpi = 'Resultados';
  const q2 = new URL(linkAtual()).searchParams;
  assert.equal(q2.get('aba'), null, 'uma modalidade só: sem parâmetro'); assert.equal(q2.get('kpi'), null, 'aba padrão: sem parâmetro');
  estado = null;
});
