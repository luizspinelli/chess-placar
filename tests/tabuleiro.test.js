const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');
// o chess.js vendorizado (gerador de lances completo) é o oráculo: a posição que fenDaAbertura devolve tem de ser a dele
const posicao = fen => fen.split(' ').slice(0, 2).join(' ');   // peças + lado a mover; os outros campos não interessam ao tabuleiro
const oraculo = san => { const c = new Chess(); for (const m of san) assert.ok(c.move(m), `lance inválido no caso de teste: ${m}`); return posicao(c.fen()); };
const casos = {
  'Italiana': 'e4 e5 Nf3 Nc6 Bc4',
  'roque curto dos dois lados': 'e4 e5 Nf3 Nc6 Bc4 Nf6 O-O Bc5 d3 O-O',
  'roque longo dos dois lados': 'd4 d5 Nc3 Nc6 Bf4 Bf5 Qd2 Qd7 O-O-O O-O-O',
  'en passant': 'e4 Nf6 e5 d5 exd6',
  'captura de peão e promoção': 'e4 d5 exd5 c6 dxc6 Nf6 cxb7 Nbd7 bxa8=Q',
  'desambiguação por coluna': 'Nf3 Nf6 Nc3 Nc6 Nb5 Nb4 Nbd4',
  'cravada: só o cavalo livre pode ir a f6': 'e4 d6 d4 Nd7 Bb5 c6 Ba4 Ngf6',
};
for (const [nome, seq] of Object.entries(casos)) test(`fenDaAbertura(): ${nome}`, () => {
  const san = seq.split(' ');
  const fen = fenDaAbertura(san);
  assert.ok(fen, 'não deveria desistir desta sequência');
  assert.equal(posicao(fen), oraculo(san));
});

test('fenDaAbertura(): em partidas legais aleatórias, ou acerta a posição do chess.js ou devolve "" (nunca uma posição errada)', () => {
  let seed = 11, ok = 0, desistiu = 0; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let n = 0; n < 60; n++) {
    const c = new Chess(), san = [];
    while (!c.game_over() && san.length < 24) { const ms = c.moves(); const m = ms[Math.floor(rnd() * ms.length)]; c.move(m); san.push(m); }
    const fen = fenDaAbertura(san);
    if (!fen) { desistiu++; continue; }
    assert.equal(posicao(fen), posicao(c.fen()), `partida aleatória ${n}: ${san.join(' ')}`); ok++;
  }
  assert.ok(ok >= 40, `acertou ${ok} de 60, desistiu de ${desistiu}: desistir demais também é problema`);
});
