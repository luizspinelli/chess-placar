// Modal do gráfico de rating ampliado: desenho em SVG, zoom, pan e opções de vista.
const vista = {t0: null, t1: null, media: true, pontos: true, eixo: 'partidas'};
function abrirModal(tc){
  modalTc = tc; vista.t0 = vista.t1 = null;
  $('modal').classList.add('aberto');
  const tcs = Object.keys(curvaDados);
  $('modalAbas').innerHTML = tcs.length > 1 ? tcs.map(t => `<button type="button" role="tab" aria-selected="${t === tc}" data-tc="${t}" class="${t === tc ? 'ativa' : ''}">${TIPO[t] || t}</button>`).join('') : '';
  desenharModal();
}
function fecharModal(){ $('modal').classList.remove('aberto'); }
function desenharModal(){
  const todos = (curvaDados[modalTc] || []).map((p, i) => ({...p, i}));
  const corpo = $('modalCorpo'), tip = $('modalTip');
  corpo.querySelector('svg')?.remove();
  if (todos.length < 2) return;
  const porTempo = vista.eixo === 'tempo';
  const K = p => porTempo ? p.ts : p.i;
  const T0 = K(todos[0]), T1 = K(todos[todos.length-1]);
  if (vista.t0 === null) { vista.t0 = T0; vista.t1 = T1; }
  const t0 = vista.t0, t1 = vista.t1, span = Math.max(porTempo ? 60 : 1, t1 - t0);
  const pts = todos.filter(p => K(p) >= t0 && K(p) <= t1);
  // viewBox proporcional ao corpo: com preserveAspectRatio=none, um W fixo esmaga os textos no celular
  const H = 560, cx = corpo.getBoundingClientRect();
  const W = Math.round(H * Math.max(.55, cx.width / Math.max(1, cx.height)));
  const ml = 56, mr = 24, mt = 26, mb = 44;
  const base = pts.length ? pts : todos;
  const min = Math.min(...base.map(p => p.rating)), max = Math.max(...base.map(p => p.rating));
  const pad = Math.max(10, Math.round((max - min) * 0.1));
  const y0 = Math.floor((min - pad) / 10) * 10, y1 = Math.ceil((max + pad) / 10) * 10;
  const X = t => ml + (t - t0) / span * (W - ml - mr), Y = v => mt + (y1 - v) / (y1 - y0) * (H - mt - mb);
  const passo = [10, 20, 25, 50, 100, 200].find(p => (y1 - y0) / p <= 8) || 500;
  let g = '';
  for (let v = Math.ceil(y0 / passo) * passo; v <= y1; v += passo) g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${cor('--border')}"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="13" fill="${cor('--muted')}">${v}</text>`;
  const nT = Math.min(W < 450 ? 2 : W < 700 ? 3 : 10, Math.max(2, porTempo ? Math.round(span / 86400 / 7) + 1 : Math.min(10, Math.round(span / 5) + 1)));
  const dias = porTempo ? span / 86400 : (todos[Math.min(todos.length-1, Math.round(t1))].ts - todos[Math.max(0, Math.round(t0))].ts) / 86400;
  const fmtEixo = new Intl.DateTimeFormat('pt-BR', dias > 120 ? {month: 'short', year: '2-digit'} : dias > 2 ? {day: '2-digit', month: '2-digit'} : {day: '2-digit', hour: '2-digit', minute: '2-digit'});
  for (let i = 0; i <= nT; i++) {
    const t = t0 + span * i / nT;
    const rotulo = porTempo ? fmtEixo.format(new Date(t * 1000)) : `#${Math.round(t) + 1} · ${fmtEixo.format(new Date(todos[Math.min(todos.length-1, Math.max(0, Math.round(t)))].ts * 1000))}`;
    g += `<line x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${H - mb}" stroke="${cor('--surface2')}"/><text x="${X(t)}" y="${H - mb + 18}" text-anchor="${i === 0 ? 'start' : i === nT ? 'end' : 'middle'}" font-size="12" fill="${cor('--muted')}">${rotulo}</text>`;
  }
  const i0 = Math.max(0, todos.findIndex(p => K(p) >= t0) - 1);
  let i1 = todos.findIndex(p => K(p) > t1); i1 = i1 < 0 ? todos.length - 1 : Math.min(todos.length - 1, i1);
  const seg = todos.slice(i0, i1 + 1);
  const linha = seg.map((p, i) => `${i ? 'L' : 'M'}${X(K(p)).toFixed(1)},${Y(p.rating).toFixed(1)}`).join(' ');
  const area = seg.length ? `${linha} L${X(K(seg[seg.length-1])).toFixed(1)},${H - mb} L${X(K(seg[0])).toFixed(1)},${H - mb} Z` : '';
  let mediaMovel = '';
  if (vista.media && todos.length > 10) {
    const N = 10, m = todos.map((p, i) => { const w = todos.slice(Math.max(0, i - N + 1), i + 1); return {k: K(p), v: w.reduce((a, b) => a + b.rating, 0) / w.length}; }).slice(i0, i1 + 1);
    mediaMovel = `<path d="${m.map((p, i) => `${i ? 'L' : 'M'}${X(p.k).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${cor('--amber')}" stroke-width="2" stroke-dasharray="6 4" opacity=".9"/>`;
  }
  const iMax = pts.findIndex(p => p.rating === max), iMin = pts.findIndex(p => p.rating === min);
  const marca = (p, label, dy) => {
    if (!p) return '';
    const x = X(K(p)), anchor = x > W - mr - 60 ? 'end' : x < ml + 60 ? 'start' : 'middle';
    return `<circle cx="${x}" cy="${Y(p.rating)}" r="4" fill="${cor('--surface')}" stroke="${cor('--text')}" stroke-width="2"/><text x="${x}" y="${Math.min(H - mb - 4, Math.max(mt + 12, Y(p.rating) + dy))}" text-anchor="${anchor}" font-size="13" font-weight="bold" fill="${cor('--text')}">${label} ${p.rating}</text>`;
  };
  const pontos = vista.pontos ? pts.map(p => `<circle cx="${X(K(p)).toFixed(1)}" cy="${Y(p.rating).toFixed(1)}" r="${pts.length > 300 ? 2 : pts.length > 60 ? 3 : 4}" fill="${p.r === 'w' ? cor('--win') : p.r === 'l' ? cor('--loss') : cor('--draw')}" opacity=".85"/>`).join('') : '';
  const c = {w:0, d:0, l:0}; pts.forEach(p => c[p.r]++);
  const resumo = pts.length ? `${pts.length} partidas · ${c.w}V ${c.d}E ${c.l}D · ${pts[0].rating} → ${pts[pts.length-1].rating} (${sinal(pts[pts.length-1].rating - pts[0].rating)})` : 'sem partidas na janela';
  $('modalResumo').textContent = resumo;
  corpo.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="cursor:grab" role="img" aria-label="Gráfico interativo de rating">${g}
    <clipPath id="clip"><rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}"/></clipPath>
    <g clip-path="url(#clip)"><path d="${area}" fill="${cor('--accent')}" opacity=".08"/><path d="${linha}" fill="none" stroke="${cor('--text')}" stroke-width="1.8"/>${mediaMovel}${pontos}</g>
    ${marca(pts[iMax], 'pico', -12)}${marca(pts[iMin], 'vale', 22)}
    ${W < 900 ? '' : `<text x="${ml}" y="${mt - 8}" font-size="12" fill="${cor('--muted')}">${t0 === T0 && t1 === T1 ? 'rolagem = zoom · arrastar = mover · clique no ponto = abrir partida' : 'duplo clique = ver tudo'}</text>`}</svg>`);
  modalGeo = {t0, t1, span, T0, T1, X, Y, K, pts, W, H, ml, mr, mt, mb, minZoom: porTempo ? 600 : 4};
}
addEventListener('resize', () => { if ($('modal').classList.contains('aberto')) desenharModal(); });
let modalGeo = null, arrasto = null;
{
  const corpo = $('modalCorpo'), tip = $('modalTip');
  const svgAtual = () => corpo.querySelector('svg');
  const tDe = clientX => { const g = modalGeo, rect = svgAtual().getBoundingClientRect(); return g.t0 + ((clientX - rect.left) / rect.width * g.W - g.ml) / (g.W - g.ml - g.mr) * g.span; };
  const maisPerto = t => { const {pts, K} = modalGeo; let i = 0; for (let k = 1; k < pts.length; k++) if (Math.abs(K(pts[k]) - t) < Math.abs(K(pts[i]) - t)) i = k; return pts[i]; };
  corpo.addEventListener('mousedown', e => { if (!modalGeo || !svgAtual()) return; arrasto = {x: e.clientX, t0: modalGeo.t0, t1: modalGeo.t1, moveu: false}; svgAtual().style.cursor = 'grabbing'; e.preventDefault(); });
  corpo.addEventListener('mousemove', e => {
    const svg = svgAtual(); if (!modalGeo || !svg) return;
    const g = modalGeo;
    if (arrasto) {
      const rect = svg.getBoundingClientRect();
      const dt = (e.clientX - arrasto.x) / rect.width * g.W / (g.W - g.ml - g.mr) * (arrasto.t1 - arrasto.t0);
      if (Math.abs(e.clientX - arrasto.x) > 3) arrasto.moveu = true;
      if (!arrasto.moveu) return;
      let n0 = arrasto.t0 - dt, n1 = arrasto.t1 - dt;
      if (n0 < g.T0) { n1 += g.T0 - n0; n0 = g.T0; } if (n1 > g.T1) { n0 -= n1 - g.T1; n1 = g.T1; }
      vista.t0 = Math.max(g.T0, n0); vista.t1 = Math.min(g.T1, n1);
      tip.style.display = 'none';
      desenharModal(); svgAtual().style.cursor = 'grabbing';
      return;
    }
    if (!g.pts.length) return;
    const p = maisPerto(tDe(e.clientX)), rect = svg.getBoundingClientRect();
    tip.style.display = 'block';
    tip.innerHTML = `<b>${p.rating}</b> ${p.delta === null ? '' : `<span class="${cls(p.delta)}">${sinal(p.delta)}</span>`}<br>${fmt.format(new Date(p.ts * 1000))}<br>vs ${p.adv} (${p.advRating}) · ${{w:'vitória', d:'empate', l:'derrota'}[p.r]}`;
    const px = g.X(g.K(p)) / g.W * rect.width, py = g.Y(p.rating) / g.H * rect.height;
    tip.style.left = `${Math.min(px + 14, rect.width - tip.offsetWidth - 8)}px`; tip.style.top = `${Math.max(4, py - 56)}px`;
    svg.querySelector('.cursor')?.remove();
    svg.insertAdjacentHTML('beforeend', `<line class="cursor" x1="${g.X(g.K(p))}" x2="${g.X(g.K(p))}" y1="${g.mt}" y2="${g.H - g.mb}" stroke="${cor('--accent')}" stroke-dasharray="4 3"/>`);
  });
  const soltar = () => { if (arrasto) { arrasto = null; if (svgAtual()) svgAtual().style.cursor = 'grab'; } };
  corpo.addEventListener('mouseup', e => {
    const clique = arrasto && !arrasto.moveu; soltar();
    if (clique && modalGeo?.pts.length) { const p = maisPerto(tDe(e.clientX)); if (p.url) window.open(p.url, '_blank', 'noopener'); }
  });
  corpo.addEventListener('mouseleave', () => { soltar(); tip.style.display = 'none'; svgAtual()?.querySelector('.cursor')?.remove(); });
  corpo.addEventListener('wheel', e => {
    if (!modalGeo || !svgAtual()) return;
    e.preventDefault();
    const g = modalGeo, t = tDe(e.clientX), f = e.deltaY < 0 ? 0.8 : 1.25;
    const n0 = t - (t - g.t0) * f, n1 = t + (g.t1 - t) * f;
    if (n1 - n0 < g.minZoom) return;
    vista.t0 = Math.max(g.T0, n0); vista.t1 = Math.min(g.T1, n1);
    tip.style.display = 'none';
    desenharModal();
  }, {passive: false});
  corpo.addEventListener('dblclick', () => { if (!modalGeo) return; vista.t0 = modalGeo.T0; vista.t1 = modalGeo.T1; desenharModal(); });
  // toque: um dedo move, dois dedos dão zoom
  let toque = null;
  corpo.addEventListener('touchstart', e => {
    if (!modalGeo) return;
    if (e.touches.length === 1) toque = {x: e.touches[0].clientX, t0: modalGeo.t0, t1: modalGeo.t1};
    else if (e.touches.length === 2) toque = {dist: Math.abs(e.touches[0].clientX - e.touches[1].clientX), meio: (e.touches[0].clientX + e.touches[1].clientX) / 2, t0: modalGeo.t0, t1: modalGeo.t1};
  }, {passive: true});
  corpo.addEventListener('touchmove', e => {
    if (!toque || !modalGeo || !svgAtual()) return;
    e.preventDefault();
    const g = modalGeo, rect = svgAtual().getBoundingClientRect(), span = toque.t1 - toque.t0;
    if (e.touches.length === 1 && toque.x !== undefined) {
      const dt = (e.touches[0].clientX - toque.x) / rect.width * g.W / (g.W - g.ml - g.mr) * span;
      let n0 = toque.t0 - dt, n1 = toque.t1 - dt;
      if (n0 < g.T0) { n1 += g.T0 - n0; n0 = g.T0; } if (n1 > g.T1) { n0 -= n1 - g.T1; n1 = g.T1; }
      vista.t0 = Math.max(g.T0, n0); vista.t1 = Math.min(g.T1, n1);
    } else if (e.touches.length === 2 && toque.dist) {
      const dist = Math.abs(e.touches[0].clientX - e.touches[1].clientX), f = toque.dist / Math.max(1, dist);
      const t = toque.t0 + ((toque.meio - rect.left) / rect.width * g.W - g.ml) / (g.W - g.ml - g.mr) * span;
      const n0 = t - (t - toque.t0) * f, n1 = t + (toque.t1 - t) * f;
      if (n1 - n0 < g.minZoom) return;
      vista.t0 = Math.max(g.T0, n0); vista.t1 = Math.min(g.T1, n1);
    }
    desenharModal();
  }, {passive: false});
  corpo.addEventListener('touchend', () => { toque = null; });
}
$('modalOpcoes').addEventListener('change', e => {
  if (e.target.name === 'eixo') { vista.eixo = e.target.value; vista.t0 = vista.t1 = null; }
  else if (e.target.name in vista) vista[e.target.name] = e.target.checked;
  desenharModal();
});
$('kpiGrid').addEventListener('click', e => { const sp = e.target.closest('.spark, .ampliar'); if (sp) abrirModal(sp.dataset.tc); });
$('modalAbas').addEventListener('click', e => { const b = e.target.closest('button'); if (b) abrirModal(b.dataset.tc); });
$('modalFechar').addEventListener('click', fecharModal);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
