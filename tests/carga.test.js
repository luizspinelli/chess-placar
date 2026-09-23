const test = require('node:test'), assert = require('node:assert/strict');
const {scripts} = require('./_ambiente');

test('os scripts do index.html carregam em ordem e expõem as funções principais', () => {
  assert.ok(scripts.length >= 12, `esperava 12+ scripts, achei ${scripts.length}`);
  for (const f of ['periodo', 'parsePGN', 'fenDaAbertura', 'kpis', 'montarPartidas', 'errosDaPartida', 'secoesMd', 'Chess']) assert.equal(typeof globalThis[f], 'function', f);
  assert.equal(typeof DRAWS, 'object'); assert.equal(TIPO.rapid, 'rápida');
});
