// Renderização do placar: render(), resumo, perfil, comparativo e abas de modalidade.
function renderResumo(jogos, c, total, ini, fim){
  const el = $('resumo');
  if (!total) { el.hidden = true; return; }
  el.hidden = false;
  const {rotulo} = estado, ap = Math.round((c.w + c.d/2) / total * 100);
  const div = document.createElement('div'); div.innerHTML = kpiData['Análise'];
  const achados = [...div.querySelectorAll('.achado')].map(a => ({tipo: [...a.classList].find(x => ['alerta','atencao','bom','info'].includes(x)), titulo: a.querySelector('h2').textContent.replace(/^[▲●✔ℹ]\s*/, '').trim(), texto: a.querySelector('p').textContent.trim()}));
  const frases = [];
  frases.push(`<p>${total} partida${total > 1 ? 's' : ''} de <b>${TIPO[aba]}</b> ${rotulo}: <b class="w">${c.w}</b> vitória${c.w !== 1 ? 's' : ''}, <b class="d">${c.d}</b> empate${c.d !== 1 ? 's' : ''} e <b class="l">${c.l}</b> derrota${c.l !== 1 ? 's' : ''} — <b>${ap}%</b> de aproveitamento${ini != null && fim != null ? `, com o rating indo de ${ini} para <b>${fim}</b> (<b class="${cls(fim - ini)}">${sinal(fim - ini)}</b>)` : ''}.</p>`);
  const naoAbertura = a => !/abertura/i.test(a.titulo);
  const problema = achados.find(a => a.tipo === 'alerta' && naoAbertura(a)) || achados.find(a => a.tipo === 'atencao' && naoAbertura(a)) || achados.find(a => a.tipo === 'alerta' || a.tipo === 'atencao');
  const forte = achados.find(a => a.tipo === 'bom' && naoAbertura(a)) || achados.find(a => a.tipo === 'bom');
  if (problema) frases.push(`<p><b>O que mais pesa:</b> ${problema.texto.split(/(?<=[.!?])\s/)[0]}</p>`);
  if (forte) frases.push(`<p><b>Ponto forte:</b> ${forte.texto.split(/(?<=[.!?])\s/)[0]}</p>`);
  if (!problema && !forte) frases.push('<p>Nada fora do padrão neste período: cor, horário, sessões e relógio dentro da sua média.</p>');
  $('resumoTexto').innerHTML = frases.join('');
  const resDe = g => { const eu = g.white.username.toLowerCase() === estado.nick ? g.white : g.black; return eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l'; };
  const cron = [...jogos].sort((a, b) => a.end_time - b.end_time);
  const ult = cron.slice(-10).map(resDe);
  const pts = ult.reduce((t, r) => t + (r === 'w' ? 1 : r === 'd' ? .5 : 0), 0);
  let seq = 0, seqTipo = cron.length ? resDe(cron[cron.length-1]) : null;
  for (let i = cron.length - 1; i >= 0 && resDe(cron[i]) === seqTipo; i--) seq++;
  const cor = {w: {w:0,d:0,l:0}, b: {w:0,d:0,l:0}};
  for (const g of cron) cor[g.white.username.toLowerCase() === estado.nick ? 'w' : 'b'][resDe(g)]++;
  const apc = o => { const n = o.w + o.d + o.l; return n ? Math.round((o.w + o.d/2) / n * 100) + '%' : '–'; };
  const dias = new Set(cron.map(g => new Date(g.end_time * 1000).toDateString())).size;
  const nomeSeq = {w: 'vitória', d: 'empate', l: 'derrota'}[seqTipo] + (seq > 1 ? 's' : '');
  $('resumoMini').innerHTML = `
    <div class="mini"><h2>Forma recente</h2><div class="forma">${ult.map(r => `<i class="${r}"></i>`).join('')}</div><div class="sub">${pts} de ${ult.length} pontos nas últimas ${ult.length}</div></div>
    <div class="mini"><h2>Brancas × pretas</h2><div class="val">${apc(cor.w)} <small style="font-weight:400">·</small> ${apc(cor.b)}</div><div class="sub">${cor.w.w + cor.w.d + cor.w.l} de brancas, ${cor.b.w + cor.b.d + cor.b.l} de pretas</div></div>
    <div class="mini"><h2>Sequência atual</h2><div class="val ${seqTipo === 'd' ? '' : seqTipo}">${seq} ${nomeSeq}</div><div class="sub">${seq < 2 ? 'última partida' : seqTipo === 'w' ? 'seguidas — mantenha o ritmo' : seqTipo === 'l' ? 'seguidas — talvez seja hora de pausar' : 'seguidos'}</div></div>
    <div class="mini"><h2>Ritmo</h2><div class="val">${(total / Math.max(1, dias)).toFixed(1).replace('.', ',')} <small style="font-weight:400;font-size:.8rem">por dia</small></div><div class="sub">${dias} dia${dias > 1 ? 's' : ''} com partidas</div></div>`;
  const v = (curvaDados[aba] || []).map(p => p.rating);
  $('resumoGrafico').innerHTML = v.length > 1 ? `<div class="ratingCard"><div class="cab"><span class="tcNome">rating ${TIPO[aba]}</span><span class="stats"><span class="w">▲ ${Math.max(...v)}</span><span class="l">▼ ${Math.min(...v)}</span></span><button type="button" class="ampliar" data-tc="${aba}">⤢ Ampliar</button></div><div class="spark" data-tc="${aba}">${sparkline(v, true)}</div></div>` : '';
}
$('resumo').addEventListener('click', e => { const sp = e.target.closest('.spark, .ampliar'); if (sp) abrirModal(sp.dataset.tc); });

$('abas').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  aba = b.dataset.tc; pagina = 1;
  $('abas').querySelectorAll('button').forEach(x => { x.classList.toggle('ativa', x === b); x.setAttribute('aria-selected', x === b); });
  render(); sincronizarURL();
});

const bandeira = url => { const c = (url || '').split('/').pop(); return c && c.length === 2 ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) : ''; };
const dataCurta = ts => ts ? new Date(ts * 1000).toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'}) : '–';

function renderPerfil(){
  const {perfil: p, stats, nick} = estado, el = $('perfil');
  if (!p) { el.hidden = true; return; }
  const st = stats?.[`chess_${aba}`], rec = st?.record, last = st?.last;
  let best = st?.best;
  const provisorio = best && p.joined && best.date - p.joined < 30 * 86400;
  const periodoMax = (curvaDados[aba] || []).reduce((m, x) => x.rating > m.rating ? x : m, {rating: -1});
  if (provisorio && periodoMax.rating > 0) best = {rating: periodoMax.rating, date: periodoMax.ts, game: periodoMax.url, rotulo: 'melhor no período'};
  else if (provisorio) best = null;
  const hist = st ? `
    <span><b>${last?.rating ?? '–'}</b>rating atual</span>
    <span><b>${best ? `<a href="${best.game}" target="_blank" rel="noopener" title="ver a partida">${best.rating}</a>` : '–'}</b>${best?.rotulo || 'melhor'}${best ? ` · ${dataCurta(best.date)}` : ''}</span>
    <span><b>${rec ? `${rec.win}-${rec.draw}-${rec.loss}` : '–'}</b>histórico total${rec ? ` · ${Math.round((rec.win + rec.draw / 2) / (rec.win + rec.draw + rec.loss) * 100)}%` : ''}</span>` : `<span><small>sem histórico de ${TIPO[aba]}</small></span>`;
  el.innerHTML = `${p.avatar ? `<img src="${escHtml(p.avatar)}" alt="">` : `<span class="avatarVazio">${(p.username || nick).slice(0, 1).toUpperCase()}</span>`}
    <div class="quem"><span class="nome">${p.title ? `<span class="titulo">${escHtml(p.title)}</span>` : ''}${p.username || nick} ${bandeira(p.country)}</span>
    <span class="sub">${p.name ? `${escHtml(p.name)} · ` : ''}membro desde ${dataCurta(p.joined)}${p.last_online ? ` · visto ${new Date(p.last_online * 1000).toLocaleDateString('pt-BR')}` : ''}${p.league ? ` · liga ${escHtml(p.league)}` : ''}</span></div>
    <div class="hist">${hist}</div>`;
  el.hidden = false;
}

function render(){
  const {jogos: tudo, antes, depois, aprox = {}, nick, rotulo, monitorando, ignoradas} = estado;
  // o relatório da IA é por jogador e modalidade: ao trocar de aba ou restaurar uma busca, vem o último guardado (ou nada)
  if (!iaOcupado) { const r = armazem.ler('relatorios', `${nick}|${aba}`); iaTexto = r?.texto || ''; iaMeta = r?.meta || null; }
  const jogos = tudo.filter(g => g.time_class === aba);
  const classes = Object.keys(depois).filter(tc => tc === aba);
  const c = {w:0, d:0, l:0};
  for (const g of jogos) {
    const eu = g.white.username.toLowerCase() === nick ? g.white : g.black;
    c[eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l']++;
  }
  jogosAtuais = [...jogos].reverse(); nickAtual = nick;
  renderLista();

  const total = jogos.length;
  const varTotal = classes.reduce((t,tc) => antes[tc] == null ? t : t + depois[tc] - antes[tc], 0);
  $('nw').textContent = c.w; $('nd').textContent = c.d; $('nl').textContent = c.l;
  $('nr').textContent = sinal(varTotal); $('nr').className = cls(varTotal);
  document.querySelectorAll('.bar i').forEach(i => i.style.flex = c[i.className] || 0);
  $('rtotal').textContent = `${total} partida${total === 1 ? '' : 's'} de ${TIPO[aba] || aba} ${rotulo}`;
  $('rpct').textContent = (total ? `${Math.round((c.w + c.d/2) / total * 100)}% de aproveitamento` : '') + (ignoradas ? ` · ${ignoradas} contra bots/amistosas ignorada${ignoradas > 1 ? 's' : ''}` : '');
  $('rpct').title = 'Aproveitamento = (vitórias + metade dos empates) ÷ partidas. 50% significa equilíbrio.';
  $('rating').innerHTML = classes.map(tc => {
    const a = antes[tc], d = depois[tc];
    return `<span>${TIPO[tc] || tc}: ${a == null ? '?' : (aprox[tc] ? '≈' : '') + a} → ${d}${a == null ? '' : ` <b class="${cls(d-a)}">${sinal(d-a)}</b>`}</span>`;
  }).join('');
  renderComparativo(jogos, c, total, varTotal);
  kpiData = total ? kpis(jogos, nick) : null;
  renderKpis();
  renderResumo(jogos, c, total, antes[aba], depois[aba]);
  renderPerfil();
  $('placar').style.display = 'block';
  $('kpis').style.display = total ? 'flex' : 'none';
  $('partidas').style.display = total ? 'flex' : 'none';
  $('status').textContent = monitorando ? `Verificado às ${hora()}` : '';
}

function renderComparativo(jogos, c, total, varTotal){
  const el = $('comparativo'), comp = estado.comp, ant = comp?.tc[aba];
  el.hidden = !comp;
  if (!comp) return;
  const cab = `<span class="cmpTitulo">vs. ${comp.rotulo}</span>`;
  if (!ant) { el.innerHTML = `${cab}<span>sem partidas de ${TIPO[aba] || aba} no período anterior</span>`; return; }
  const num = (v, casas) => v.toFixed(casas).replace('.', ',');
  const dif = (rot, agora, antes, {suf = '', sufD = suf, casas = 0, comSinal = false} = {}) => {
    const d = +(agora - antes).toFixed(casas), mais = v => (v > 0 ? '+' : '') + num(v, casas);
    return `<span>${rot} <b>${comSinal ? mais(agora) : num(agora, casas)}${suf}</b> <i class="${cls(d)}" title="período anterior: ${comSinal ? mais(antes) : num(antes, casas)}${suf}">${d ? `${d > 0 ? '▲' : '▼'} ${mais(d)}${sufD}` : '='}</i></span>`;
  };
  const ap = o => { const n = o.w + o.d + o.l; return n ? (o.w + o.d/2) / n * 100 : 0; };
  const partes = [dif('partidas', total, ant.n), dif('aproveitamento', ap(c), ap(ant), {suf: '%', sufD: ' pp'})];
  if (ant.antes != null) partes.push(dif('rating', varTotal, ant.depois - ant.antes, {comSinal: true}));
  let soma = 0, n = 0;
  for (const g of jogos) { const x = g.accuracies?.[g.white.username.toLowerCase() === estado.nick ? 'white' : 'black']; if (x != null) { soma += x; n++; } }
  if (n >= 5 && ant.accN >= 5) partes.push(dif('precisão', soma/n, ant.acc/ant.accN, {casas: 1}));
  el.innerHTML = cab + partes.join('');
}
