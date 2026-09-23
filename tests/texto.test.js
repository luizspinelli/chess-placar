const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('secoesMd(): negrito, itálico, listas — e HTML da IA sempre escapado', () => {
  const [s] = secoesMd('## Diagnóstico\nVocê joga **rápido** e *solto*.\n- item <script>x</script>\n1. um\n2. dois');
  assert.equal(s.titulo, 'Diagnóstico');
  assert.ok(s.html.includes('<b>rápido</b>') && s.html.includes('<i>solto</i>'));
  assert.ok(s.html.includes('<ul><li>item &lt;script>x&lt;/script></li></ul>'), 'tag da IA vira texto');
  assert.ok(s.html.includes('<ol><li>um</li><li>dois</li></ol>'));
  assert.ok(!s.html.includes('<script>'));
  assert.deepEqual(secoesMd('intro\n## A\ntexto').map(x => [x.titulo, x.html]), [['', '<p>intro</p>'], ['A', '<p>texto</p>']], 'texto antes do primeiro título vira seção sem título');
  assert.equal(secoesMd('## T <b>x</b>')[0].titulo, 'T &lt;b>x&lt;/b>', 'título também escapado');
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
