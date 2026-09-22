// buscar(): baixa os arquivos mensais, monta o estado, agenda a atualização automática; nicks recentes e cache da última busca.
const CHAVE = 'placar-chesscom:nicks';
const lerNicks = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarNicks = lista => { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch {} };
function renderNicks(){
  const lista = lerNicks();
  $('nicks').innerHTML = lista.map(n => `<option value="${n}">`).join('');
  $('recentes').innerHTML = lista.map(n => `<span data-nick="${n}">${n}<i title="remover" data-rm="${n}">×</i></span>`).join('');
}
function salvarNick(n){
  gravarNicks([n, ...lerNicks().filter(x => x !== n)].slice(0, 10));
  renderNicks();
}
$('recentes').addEventListener('click', e => {
  const rm = e.target.dataset.rm;
  if (rm) { gravarNicks(lerNicks().filter(x => x !== rm)); renderNicks(); return; }
  const n = e.target.closest('[data-nick]')?.dataset.nick;
  if (n) { $('nick').value = n; buscar(false); }
});
renderNicks();
if (!$('nick').value && lerNicks()[0]) $('nick').value = lerNicks()[0];

function agendar(){
  clearTimeout(timer); clearInterval(tick);
  $('prox').style.display = 'none';
  if (!$('auto').checked || $('placar').style.display !== 'block') return;
  const ms = $('intervalo').value * 1000, fim = Date.now() + ms;
  timer = setTimeout(() => buscar(true), ms);
  $('prox').style.display = 'block';
  const atualiza = () => {
    const resta = Math.max(0, fim - Date.now());
    $('proxBar').style.width = `${100 - resta / ms * 100}%`;
    $('proxTxt').textContent = `Próxima atualização em ${Math.ceil(resta / 1000)} s`;
  };
  atualiza(); tick = setInterval(atualiza, 1000);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else if ($('auto').checked && $('placar').style.display === 'block') buscar(true);
});
$('auto').addEventListener('change', agendar);
$('intervalo').addEventListener('change', agendar);
$('f').addEventListener('submit', e => { e.preventDefault(); buscar(false); });
const filtros = abrir => { document.body.classList.toggle('filtrosAbertos', abrir); $('filtrosToggle').textContent = abrir ? '▲ Fechar filtros' : '☰ Filtros e opções'; };
$('filtrosToggle').addEventListener('click', () => filtros(!document.body.classList.contains('filtrosAbertos')));
$('btnInicio').addEventListener('click', () => { const n = $('nickInicio').value.trim(); if (!n) { $('nickInicio').focus(); return; } $('nick').value = n; buscar(false); });
$('nickInicio').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnInicio').click(); });
$('exemplo').addEventListener('click', e => { e.preventDefault(); $('nick').value = 'hikaru'; $('nickInicio').value = 'hikaru'; buscar(false); });
$('btnAgora').addEventListener('click', () => {
  if (!$('nick').reportValidity()) return;
  const d = new Date(), p = n => String(n).padStart(2,'0');
  $('data').value = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  $('hora').value = `${p(d.getHours())}:${p(d.getMinutes())}`;
  $('dataFim').value = '';
  $('periodo').value = 'custom'; $('custom').hidden = false;
  $('auto').checked = true;
  buscar(false);
});
const CHAVE_ULTIMA = 'placar-chesscom:ultima';
function chaveBusca(nick){ return JSON.stringify({nick, periodo: $('periodo').value, data: $('data').value, hora: $('hora').value, dataFim: $('dataFim').value, horaFim: $('horaFim').value, tc: [...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value), bots: $('soHumanos').checked, comparar: $('comparar').checked}); }
function salvarUltima(){
  if (!estado) return;
  const compacto = estado.jogos.map(g => { parsePGN(g); const {pgn, tcn, initial_setup, fen, ...resto} = g; return resto; });
  try { localStorage.setItem(CHAVE_ULTIMA, JSON.stringify({chave: chaveBusca(estado.nick), quando: Date.now(), estado: {...estado, jogos: compacto}})); } catch {}
}
function carregarUltima(nick){
  try {
    const u = JSON.parse(localStorage.getItem(CHAVE_ULTIMA) || 'null');
    if (!u || u.chave !== chaveBusca(nick)) return false;
    estado = u.estado; estado.monitorando = $('auto').checked;
    const contagem = {}; for (const g of estado.jogos) contagem[g.time_class] = (contagem[g.time_class] || 0) + 1;
    const classes = ['bullet','blitz','rapid','daily'].filter(tc => contagem[tc]);
    if (!classes.includes(aba)) aba = classes.sort((a, b) => contagem[b] - contagem[a])[0] || aba;
    $('abas').hidden = classes.length < 2;
    $('abas').innerHTML = classes.map(tc => `<button type="button" role="tab" aria-selected="${tc === aba}" data-tc="${tc}" class="${tc === aba ? 'ativa' : ''}">${TIPO[tc]} <small>${contagem[tc]}</small></button>`).join('');
    render();
    $('status').className = ''; $('status').textContent = `Dados salvos ${new Date(u.quando).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})} · atualizando…`;
    return true;
  } catch { return false; }
}

async function buscar(atualizacao){
  if (ocupado) return;
  const nick = $('nick').value.trim().toLowerCase();
  const [inicio, fim] = periodo();
  const inicioTs = inicio.getTime() / 1000, fimTs = fim ? fim.getTime() / 1000 : Infinity;
  const modalidades = new Set([...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value));
  const monitorando = $('auto').checked;
  const status = $('status');
  status.className = '';
  if (isNaN(inicio)) { status.className = 'error'; status.textContent = 'Informe a data de início.'; return; }
  if (fim && fim < inicio) { status.className = 'error'; status.textContent = 'A data de fim é anterior ao início.'; return; }
  if (!modalidades.size) { status.className = 'error'; status.textContent = 'Marque ao menos uma modalidade.'; return; }

  const comparando = $('comparar').checked;
  const [iniAnt, fimAnt] = comparando ? periodoAnterior(inicio, fim) : [];
  const iniAntTs = comparando ? iniAnt.getTime() / 1000 : 0, fimAntTs = comparando ? fimAnt.getTime() / 1000 : 0;

  ocupado = true;
  document.body.classList.remove('inicio');
  if (!atualizacao) filtros(false);
  clearTimeout(timer); clearInterval(tick);
  $('proxTxt').textContent = 'Atualizando…'; $('proxBar').style.width = '100%';
  $('btn').disabled = true;
  status.textContent = atualizacao ? 'Atualizando…' : 'Buscando…';
  if (!atualizacao) {
    iaTexto = ''; iaErro = '';
    filtro = ''; $('filtro').value = '';
    if (!carregarUltima(nick)) { $('placar').style.display = 'none'; $('kpis').style.display = 'none'; $('partidas').style.display = 'none'; }
    else atualizacao = 'cache';
  }

  try {
    const {archives} = await getJSON(API + nick + '/games/archives');
    const base = comparando ? iniAnt : inicio;
    const chave = base.getFullYear() * 100 + base.getMonth() + 1;
    const chaveFim = fim ? fim.getFullYear() * 100 + fim.getMonth() + 1 : Infinity;
    let meses = archives.filter(u => { const [y,m] = u.split('/').slice(-2).map(Number); return y*100 + m >= chave && y*100 + m <= chaveFim; });
    const idx = archives.indexOf(meses[0]);
    if (idx > 0) meses.unshift(archives[idx-1]);
    else if (!meses.length && archives.length) meses = archives.slice(-1);

    const todos = [];
    for (let i = 0; i < meses.length; i++) {
      const c = cache.get(meses[i]);
      if (atualizacao === true && i < meses.length - 1 && c) { todos.push(...c.data.games); continue; }
      todos.push(...(await getJSON(meses[i])).games);
    }
    todos.sort((a,b) => a.end_time - b.end_time);

    const antes = {}, depois = {}, ultimo = {}, jogos = [], compTc = comparando ? {} : null;
    const soHumanos = $('soHumanos').checked;
    let ignoradas = 0;
    for (const g of todos) {
      if (!modalidades.has(g.time_class)) continue;
      if (soHumanos && (!g.rated || ehBot(g, nick))) { if (g.end_time >= inicioTs && g.end_time <= fimTs) ignoradas++; continue; }
      const eu = g.white.username.toLowerCase() === nick ? g.white : g.black;
      const tc = g.time_class;
      if (g.end_time >= inicioTs && g.end_time <= fimTs) {
        g.delta = g.rated && tc in ultimo ? eu.rating - ultimo[tc] : null;
        if (g.rated) { if (!(tc in antes)) antes[tc] = ultimo[tc] ?? null; depois[tc] = eu.rating; }
        jogos.push(g);
      } else if (compTc && g.end_time >= iniAntTs && g.end_time <= fimAntTs) {
        // do período anterior guardamos só os agregados: o estado inteiro vai para o localStorage
        const c = compTc[tc] ??= {n: 0, w: 0, d: 0, l: 0, acc: 0, accN: 0, antes: undefined, depois: null};
        c.n++; c[eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l']++;
        const ac = g.accuracies?.[eu === g.white ? 'white' : 'black'];
        if (ac != null) { c.acc += ac; c.accN++; }
        if (g.rated) { if (c.antes === undefined) c.antes = ultimo[tc] ?? null; c.depois = eu.rating; }
      }
      if (g.rated) ultimo[tc] = eu.rating;
    }
    const rotulo = fim ? `de ${fmt.format(inicio)} a ${fmt.format(fim)}` : `desde ${fmt.format(inicio)}`;
    if (!jogos.length && !monitorando) throw new Error(`Nenhuma partida ${rotulo}.`);

    salvarNick(nick);
    let perfil = null, stats = null;
    if (atualizacao !== true || nick !== estado?.nick) {
      try { perfil = await getJSON(API + nick); } catch {}
      try { stats = await getJSON(API + nick + '/stats'); } catch {}
    } else { perfil = estado.perfil; stats = estado.stats; }
    const comp = compTc ? {rotulo: `${fmtDia.format(iniAnt)} a ${fmtDia.format(fimAnt)}`, tc: compTc} : null;
    estado = {jogos, antes, depois, nick, rotulo, monitorando, ignoradas, perfil, stats, comp, evolucao: evolucaoDoPeriodo(inicio, fim)};
    const contagem = {};
    for (const g of jogos) contagem[g.time_class] = (contagem[g.time_class] || 0) + 1;
    const classes = ['bullet','blitz','rapid','daily'].filter(tc => contagem[tc] && modalidades.has(tc));
    if (!classes.includes(aba)) aba = classes.sort((a, b) => contagem[b] - contagem[a])[0] || [...modalidades][0];
    const abas = $('abas');
    abas.hidden = classes.length < 2;
    abas.innerHTML = ['bullet','blitz','rapid','daily'].filter(tc => classes.includes(tc))
      .map(tc => `<button type="button" role="tab" aria-selected="${tc === aba}" data-tc="${tc}" class="${tc === aba ? 'ativa' : ''}">${TIPO[tc]} <small>${contagem[tc]}</small></button>`).join('');
    if (atualizacao !== true) pagina = 1;
    falhou = false;
    render();
    salvarUltima();
  } catch (err) {
    // 404 num nick que já funcionou antes é bloqueio da API, não nick inexistente
    const conhecido = estado?.nick === nick || lerNicks().includes(nick);
    const msg = err.status === 404 && conhecido
      ? 'A API do Chess.com está recusando as requisições agora. Aguarde um minuto e tente de novo.'
      : err.message;
    falhou = true;
    status.className = 'error';
    status.textContent = msg;
    if ($('placar').style.display !== 'block' && !atualizacao) { document.body.classList.add('inicio'); $('inicio').querySelector('.erro')?.remove(); $('inicio').insertAdjacentHTML('beforeend', `<p class="erro">${escHtml(msg)}</p>`); }
  } finally {
    ocupado = false;
    $('btn').disabled = false;
    renderOverlay();
    agendar();
  }
}
