const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
require('./_ambiente');

// Um listener delegado só funciona se o nó em que ele está pendurado for ancestral do elemento
// que emite o evento. Quando o bloco da IA saiu de #kpiGrid para #analiseCorpo, os quatro
// listeners ficaram para trás e TODO o diagnóstico virou enfeite — com os 39 testes passando,
// porque o DOM falso engole addEventListener. Este teste amarra as duas pontas: para cada
// `$('X').addEventListener(...)` que compara `e.target.id === 'Y'`, o id Y precisa ser gerado
// por uma função que é colada dentro de X.
const raiz = path.join(__dirname, '..');
const fonte = f => fs.readFileSync(path.join(raiz, 'js', f), 'utf8');

// onde cada bloco de HTML é colado: função que gera -> nó que recebe
const DESTINO = {
  blocoIA: 'analiseCorpo',        // renderAnalise()
  motorStatus: 'analiseCorpo',    // dentro de blocoIA
  motorControles: 'analiseCorpo', // dentro de blocoIA
};

test('listeners delegados escutam o nó onde o HTML deles é colado', () => {
  const arquivos = ['ia.js', 'motor.js'];
  const geradores = Object.keys(DESTINO).map(f => [f, fonte('ia.js') + fonte('motor.js')]);
  let checados = 0;

  for (const arq of arquivos) {
    const src = fonte(arq);
    // cada $('no').addEventListener('tipo', e => { ...e.target.id === 'alvo'... })
    for (const m of src.matchAll(/\$\('(\w+)'\)\.addEventListener\('(?:click|change)', e => \{([\s\S]*?)\n\}\);/g)) {
      const [, no, corpo] = m;
      for (const id of corpo.matchAll(/e\.target\.id === '(\w+)'/g)) {
        const alvo = id[1];
        // em que função o id é emitido?
        const dono = geradores.find(([fn, texto]) => {
          const i = texto.indexOf(`function ${fn}(`);
          if (i < 0) return false;
          const trecho = texto.slice(i, i + 4000);
          return trecho.includes(`id="${alvo}"`);
        });
        if (!dono) continue;   // id gerado noutro lugar: fora do alcance desta checagem
        checados++;
        assert.equal(no, DESTINO[dono[0]],
          `#${alvo} é gerado por ${dono[0]}() e colado em #${DESTINO[dono[0]]}, mas o listener de ${arq} escuta #${no} — o evento nunca chega`);
      }
    }
  }
  assert.ok(checados >= 6, `esperava conferir vários ids delegados, conferi ${checados}`);
});

test('o HTML do diagnóstico é colado no mesmo nó que os listeners escutam', () => {
  const ind = fonte('indicadores.js');
  const m = ind.match(/\$\('(\w+)'\)\.innerHTML = blocoIA\(\)/);
  assert.ok(m, 'renderAnalise() deveria colar blocoIA() em algum nó');
  assert.equal(m[1], 'analiseCorpo');
  for (const arq of ['ia.js', 'motor.js']) {
    assert.ok(!fonte(arq).includes("$('kpiGrid').addEventListener"),
      `${arq} ainda delega a partir de #kpiGrid, que não contém mais o bloco da IA`);
  }
});
