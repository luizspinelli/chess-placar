const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('parâmetros do overlay: só o que o CSS e a meta entendem', () => {
  assert.equal(fundoValido('00ff00'), '00ff00'); assert.equal(fundoValido('#0F0'), '0f0'); assert.equal(fundoValido('transparente'), 'transparente');
  assert.equal(fundoValido('red;background:url(x)'), '', 'qualquer coisa fora de hexadecimal cai para vazio');
  assert.equal(escalaValida('1.25'), '1.25'); assert.equal(escalaValida('0,8'), '0.8'); assert.equal(escalaValida('9'), '1'); assert.equal(escalaValida('abc'), '1');
  assert.equal(metaValida('+50'), '+50'); assert.equal(metaValida(' 700 '), '700'); assert.equal(metaValida('700;x'), ''); assert.equal(metaValida('99999'), '');
});

test('linkAtual(): abas só entram quando fogem do padrão', () => {
  $('nick').value = 'eu'; $('periodo').value = 'mes'; $('ovTipo').value = 'placar'; $('ovFonte').value = '1';
  estado = {jogos: [{time_class: 'rapid'}, {time_class: 'blitz'}]}; aba = 'blitz'; abaKpi = 'Aberturas';
  document.body.classList.contains = () => false;   // modo avançado
  const q = new URL(linkAtual()).searchParams;
  assert.equal(q.get('aba'), 'blitz'); assert.equal(q.get('kpi'), 'Aberturas'); assert.equal(q.get('periodo'), 'mes');
  estado = {jogos: [{time_class: 'rapid'}]}; aba = 'rapid'; abaKpi = 'Análise';
  const q2 = new URL(linkAtual()).searchParams;
  assert.equal(q2.get('aba'), null, 'uma modalidade só: sem parâmetro'); assert.equal(q2.get('kpi'), null, 'aba padrão: sem parâmetro');
  estado = null;
});
