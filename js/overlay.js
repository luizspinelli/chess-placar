// Modo streamer/OBS: overlay do placar e seus controles.
let ovUltimaUrl = null, ovRatingInicio = null;
function renderOverlay(){
  const on = document.body.classList.contains('streamer');
  $('overlay').hidden = !on;
  document.body.classList.toggle('desatualizado', on && falhou);
  if (!on || !estado) return;
  const tipo = $('ovTipo').value; document.body.dataset.ov = tipo;
  document.documentElement.style.setProperty('--ovEscala', $('ovFonte').value);
  $('placar').style.zoom = $('ovFonte').value; $('overlay').style.zoom = $('ovFonte').value;
  const fundo = $('ovFundo').value.trim();
  document.body.style.background = fundo && fundo !== 'transparente' ? (fundo.startsWith('#') ? fundo : '#' + fundo) : 'transparent';

  const jogos = jogosAtuais;                       // já filtrados pela modalidade, mais recente primeiro
  const nick = nickAtual;
  const resDe = g => { const eu = g.white.username.toLowerCase() === nick ? g.white : g.black; return eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l'; };
  let seq = 0, seqTipo = jogos[0] ? resDe(jogos[0]) : null;
  for (const g of jogos) { if (resDe(g) === seqTipo) seq++; else break; }
  const seqHtml = $('ovSeq').checked && seq >= 2 && seqTipo !== 'd' ? `<span class="seq ${seqTipo}">${seqTipo === 'w' ? '🔥' : '🧊'} ${seq} ${seqTipo === 'w' ? 'vitórias' : 'derrotas'} seguidas</span>` : '';

  // ticker
  const t = $('ovTicker');
  t.hidden = tipo !== 'ticker';
  if (!t.hidden) t.innerHTML = `<span><small>V</small><b class="w">${$('nw').textContent}</b></span><span><small>E</small><b class="d">${$('nd').textContent}</b></span><span><small>D</small><b class="l">${$('nl').textContent}</b></span><span><small>rating</small><b class="${$('nr').className}">${$('nr').textContent}</b></span>${seqHtml ? `<span>${seqHtml}</span>` : ''}`;

  // meta
  const m = $('ovMetaBar'), metaTxt = $('ovMeta').value.trim();
  const ratingAtual = estado.depois[aba] ?? null, ratingIni = estado.antes[aba] ?? null;
  if (metaTxt && ratingAtual !== null) {
    const alvo = /^[+-]/.test(metaTxt) ? (ratingIni ?? ratingAtual) + parseInt(metaTxt) : parseInt(metaTxt);
    const base = ratingIni ?? ratingAtual, faltam = alvo - ratingAtual;
    const prog = alvo === base ? 1 : Math.max(0, Math.min(1, (ratingAtual - base) / (alvo - base)));
    m.hidden = false; m.classList.toggle('batida', faltam <= 0);
    m.innerHTML = `<div class="linha"><span>🎯 Meta <b>${alvo}</b></span><span>${faltam <= 0 ? '<b class="w">meta batida!</b>' : `<b>${ratingAtual}</b> · faltam <b>${faltam}</b>`}</span></div><div class="trilha"><i style="width:${prog * 100}%"></i></div>`;
  } else m.hidden = true;

  // última partida
  const u = $('ovUltimaCard'), g = jogos[0];
  if ($('ovUltima').checked && g) {
    const branco = g.white.username.toLowerCase() === nick, eu = branco ? g.white : g.black, adv = branco ? g.black : g.white, r = resDe(g);
    u.hidden = false; u.className = `box ${r}`;
    u.innerHTML = `<span class="res ${r}">${{w:'Vitória', d:'Empate', l:'Derrota'}[r]}</span>
      <span class="adv">vs <b>${adv.username}</b> (${adv.rating}) · ${branco ? 'brancas' : 'pretas'} · ${MOTIVO[r === 'w' ? adv.result : eu.result] || ''}<small>${fmt.format(new Date(g.end_time * 1000))}${seqHtml && tipo !== 'ticker' ? ' · ' + seqHtml : ''}</small></span>
      <span class="delta ${g.delta === null ? '' : cls(g.delta)}">${g.delta === null ? '' : sinal(g.delta)}</span>`;
    if (ovUltimaUrl && ovUltimaUrl !== g.url) { u.classList.add('nova'); setTimeout(() => u.classList.remove('nova'), 700); }
    ovUltimaUrl = g.url;
  } else u.hidden = true;
}
['ovTipo','ovMeta','ovFundo','ovFonte','ovUltima','ovSeq'].forEach(id => $(id).addEventListener('change', renderOverlay));

function modoStreamer(ligar){
  document.body.classList.toggle('streamer', ligar);
  if (!ligar) { document.body.style.background = ''; $('placar').style.zoom = ''; }
  renderOverlay();
  if (ligar && !$('auto').checked) { $('auto').checked = true; agendar(); }
  history.replaceState(null, '', linkAtual());
}
$('btnStreamer').addEventListener('click', () => {
  if (!$('nick').value.trim()) { $('nick').reportValidity(); return; }
  if ($('placar').style.display !== 'block') buscar(false);
  modoStreamer(true);
});
$('sairStreamer').addEventListener('click', () => modoStreamer(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('streamer')) modoStreamer(false); });
