const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('mdParaHtml(): títulos, listas, negrito — e HTML da IA sempre escapado', () => {
  const html = mdParaHtml('## Diagnóstico\nVocê joga **rápido**.\n- item <script>x</script>\n1. um\n2. dois');
  assert.ok(html.includes('<h3>Diagnóstico</h3>'));
  assert.ok(html.includes('<b>rápido</b>'));
  assert.ok(html.includes('<ul><li>item &lt;script>x&lt;/script></li></ul>'), 'tag da IA vira texto');
  assert.ok(html.includes('<ol><li>um</li><li>dois</li></ol>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.startsWith('<section><h3>Diagnóstico</h3>') && html.endsWith('</section>'), 'cada título abre uma seção');
  assert.equal(mdParaHtml('## A\ntexto\n## B\n- x').match(/<section>/g).length, 2);
  assert.equal(mdParaHtml('intro\n## A\ntexto'), '<section><p>intro</p></section><section><h3>A</h3><p>texto</p></section>', 'texto antes do primeiro título vira seção sem título');
});

test('helpers de formatação', () => {
  assert.equal(escHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(sinal(5), '+5'); assert.equal(sinal(-3), '-3'); assert.equal(sinal(0), '0');
  assert.equal(cls(4), 'w'); assert.equal(cls(-1), 'l'); assert.equal(cls(0), '');
  assert.equal(seg(65), '1:05'); assert.equal(seg(3725), '1h02'); assert.equal(seg(null), '–');
  assert.equal(numerar(['e4', 'e5', 'Nf3']), '1.e4 e5 2.Nf3');
  assert.equal(controle('600'), '10 min'); assert.equal(controle('180+2'), '3+2'); assert.equal(controle('1/86400'), '1 dia(s)/lance');
});

test('linha()/kv(): aproveitamento conta empate como meio ponto', () => {
  const html = linha('X', {w: 3, d: 2, l: 1});
  assert.ok(html.includes('<b>67%</b>'), '(3 + 1) / 6');
  assert.ok(html.includes('3-2-1'));
  assert.equal(kv('a', 'b'), '<tr><td>a</td><td><b>b</b></td></tr>');
});
