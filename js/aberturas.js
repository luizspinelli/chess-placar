// PGN e aberturas: parsePGN, posição a partir dos lances (fenDaAbertura) e o modal do tabuleiro.
// ---- posição a partir dos lances (só para desenhar o tabuleiro da abertura)
// Só resolve o necessário para saber QUEM se moveu: quando duas peças alcançam a casa,
// descarta a que deixaria o próprio rei em xeque. Se ainda assim sobrar dúvida, devolve ''
// e o tabuleiro não aparece — melhor nada que posição errada.
const SALTOS = {N: [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]], K: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]};
const RAIOS = {B: [[-1,-1],[-1,1],[1,-1],[1,1]], R: [[-1,0],[1,0],[0,-1],[0,1]]};
RAIOS.Q = [...RAIOS.B, ...RAIOS.R];
const casa = s => [8 - +s[1], s.charCodeAt(0) - 97];

function fenDaAbertura(san){
  const b = [...'rnbqkbnr', ...'pppppppp', ...Array(32).fill(''), ...'PPPPPPPP', ...'RNBQKBNR'];
  const em = (r, c) => b[r * 8 + c];
  const livre = ([r0,c0], [r1,c1]) => {
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
    for (let r = r0 + dr, c = c0 + dc; r !== r1 || c !== c1; r += dr, c += dc) if (em(r, c)) return false;
    return true;
  };
  // uma peça cravada não pode sair: sem isso "Nf6" com dois cavalos candidatos ficaria ambíguo
  const atacada = (r, c, porBrancas) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const p = b[i * 8 + j];
      if (!p || (p === p.toUpperCase()) !== porBrancas) continue;
      const t = p.toUpperCase(), dr = r - i, dc = c - j;
      if (t === 'P') { if (dr === (porBrancas ? -1 : 1) && Math.abs(dc) === 1) return true; continue; }
      if (SALTOS[t]) { if (SALTOS[t].some(([a, z]) => a === dr && z === dc)) return true; continue; }
      if (RAIOS[t].some(([a, z]) => { const k = a ? dr / a : dc / z; return k > 0 && Number.isInteger(k) && dr === a * k && dc === z * k; }) && livre([i, j], [r, c])) return true;
    }
    return false;
  };
  let brancas = true;
  for (let lance of san) {
    lance = lance.replace(/[+#!?]/g, '');
    const meu = p => brancas ? p.toUpperCase() : p.toLowerCase();
    const roque = lance.match(/^[O0]-[O0](-[O0])?$/);
    if (roque) {
      const r = brancas ? 7 : 0, curto = !roque[1];
      if (em(r, 4) !== meu('k') || em(r, curto ? 7 : 0) !== meu('r')) return '';
      b[r*8 + 4] = ''; b[r*8 + (curto ? 7 : 0)] = '';
      b[r*8 + (curto ? 6 : 2)] = meu('k'); b[r*8 + (curto ? 5 : 3)] = meu('r');
      brancas = !brancas; continue;
    }
    const m = lance.match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/);
    if (!m) return '';
    const tipo = m[1] || 'P', [rd, cd] = casa(m[5]), captura = !!m[4], alvo = em(rd, cd);
    if (alvo && alvo === meu(alvo)) return '';  // não se captura peça própria
    const candidatos = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (em(r, c) !== meu(tipo)) continue;
      if (m[2] && c !== m[2].charCodeAt(0) - 97) continue;
      if (m[3] && r !== 8 - +m[3]) continue;
      const dr = rd - r, dc = cd - c;
      let ok = false;
      if (tipo === 'P') {
        // é o "x" do SAN que diz se o peão anda ou captura: sem ele, e7 nunca vai a d6
        const frente = brancas ? -1 : 1, inicial = brancas ? 6 : 1;
        ok = captura
          ? Math.abs(dc) === 1 && dr === frente
          : dc === 0 && !alvo && (dr === frente || (r === inicial && dr === 2 * frente && !em(r + frente, c)));
      } else if (SALTOS[tipo]) ok = SALTOS[tipo].some(([a, z]) => a === dr && z === dc);
      // deslizantes: (dr,dc) tem de ser um múltiplo positivo da direção, com o caminho livre
      else ok = RAIOS[tipo].some(([a, z]) => { const k = a ? dr / a : dc / z; return k > 0 && Number.isInteger(k) && dr === a * k && dc === z * k; }) && livre([r, c], [rd, cd]);
      if (ok) candidatos.push([r, c]);
    }
    const legais = candidatos.length < 2 ? candidatos : candidatos.filter(([r, c]) => {
      const de = r * 8 + c, para = rd * 8 + cd, peca = b[de], antes = b[para];
      b[para] = peca; b[de] = '';
      const rei = b.indexOf(meu('k'));
      const emXeque = rei >= 0 && atacada(Math.floor(rei / 8), rei % 8, !brancas);
      b[de] = peca; b[para] = antes;
      return !emXeque;
    });
    if (legais.length !== 1) return '';
    const [ro, co] = legais[0];
    if (tipo === 'P' && co !== cd && !alvo) b[ro * 8 + cd] = '';  // en passant
    b[ro * 8 + co] = '';
    b[rd * 8 + cd] = m[6] ? meu(m[6]) : meu(tipo);
    brancas = !brancas;
  }
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let vazias = 0;
    for (let c = 0; c < 8; c++) {
      const p = em(r, c);
      if (p) { if (vazias) { fen += vazias; vazias = 0; } fen += p; }
      else vazias++;
    }
    if (vazias) fen += vazias;
    if (r < 7) fen += '/';
  }
  return `${fen} ${brancas ? 'w' : 'b'} - - 0 1`;
}

// tabuleiro da abertura: o Chess.com desenha a partir do FEN (única requisição a terceiros do app)
function abrirAbertura(el){
  const lances = (el.dataset.lances || '').split(' ').filter(Boolean);
  const fen = lances.length ? fenDaAbertura(lances) : '';
  const texto = numerar(lances);
  $('abNome').textContent = el.dataset.nome || '';
  $('abLances').textContent = texto;
  $('abLegenda').hidden = !texto;
  const img = $('abImg'), aviso = $('abAviso');
  img.hidden = !fen; aviso.hidden = !!fen;
  if (fen) {
    img.alt = `Posição após ${texto}`;
    img.src = `https://www.chess.com/dynboard?fen=${encodeURIComponent(fen)}&board=green&piece=neo&size=3${el.dataset.flip ? '&flip=1' : ''}`;
  } else aviso.textContent = lances.length ? 'Não foi possível montar a posição a partir destes lances.' : 'Suas partidas nesta abertura não têm lances em comum, então não há uma posição única para mostrar.';
  const link = $('abLink'), href = el.getAttribute('href');
  link.href = href || ''; link.hidden = !href;
  $('modalAb').classList.add('aberto');
}
const fecharAbertura = () => $('modalAb').classList.remove('aberto');
$('abImg').addEventListener('error', () => { $('abImg').hidden = true; const av = $('abAviso'); av.hidden = false; av.textContent = 'O tabuleiro não carregou.' + ($('abLink').hidden ? '' : ' Veja a abertura no Chess.com.'); });
$('abFechar').addEventListener('click', fecharAbertura);
$('modalAb').addEventListener('click', e => { if (e.target === $('modalAb')) fecharAbertura(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharAbertura(); });
$('kpiGrid').addEventListener('click', e => { const a = e.target.closest('a.ab'); if (a) { e.preventDefault(); abrirAbertura(a); } });

function parsePGN(g){
  if (g._pgn) return g._pgn;
  const pgn = g.pgn || '';
  const h = {};
  for (const m of pgn.matchAll(/\[(\w+) "([^"]*)"\]/g)) h[m[1]] = m[2];
  const fimCab = pgn.search(/\n\s*\n/);
  const corpo = fimCab >= 0 ? pgn.slice(fimCab) : pgn.replace(/\[\w+ "[^"]*"\]\s*/g, '');
  const clks = [...corpo.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map(m => +m[1]*3600 + +m[2]*60 + +m[3]);
  const san = corpo.replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim().split(/\s+/).filter(Boolean);
  const bruto = h.ECOUrl ? decodeURIComponent(h.ECOUrl.split('/').pop()).replace(/[<>&"']/g, '') : '';
  const palavras = bruto.split('-').filter(Boolean);
  const corte = palavras.findIndex(w => /\d/.test(w));
  const variante = (corte > 0 ? palavras.slice(0, corte) : palavras).join(' ') || h.ECO || '?';
  const fim = palavras.findIndex(w => /^(Defense|Opening|Game|Attack|Gambit|System|Variation|Counter)$/i.test(w));
  const familia = (fim > 0 ? palavras.slice(0, Math.min(fim + 1, corte > 0 ? corte : Infinity)) : (corte > 0 ? palavras.slice(0, Math.min(3, corte)) : palavras.slice(0, 3))).join(' ') || h.ECO || '?';
  return g._pgn = {h, eco: (h.ECO || '').replace(/[<>&"]/g, ''), variante, familia, meias: san.length, lances: Math.ceil(san.length / 2), clks, primeiro: san[0] || '', resposta: san[1] || '', san, url: /^https:\/\/www\.chess\.com\/openings\/[\w%.-]+$/.test(h.ECOUrl || '') ? h.ECOUrl : ''};
}
