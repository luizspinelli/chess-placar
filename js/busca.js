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
const MAX_BUSCAS = 5;   // buscas guardadas (as mais recentes); cada uma tem ~2 KB por partida
function chaveBusca(nick){ return JSON.stringify({nick, periodo: $('periodo').value, data: $('data').value, hora: $('hora').value, dataFim: $('dataFim').value, horaFim: $('horaFim').value, tc: [...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value), bots: $('soHumanos').checked, comparar: $('comparar').checked}); }
// guarda a busca no armazém sem o PGN bruto, mas com os lances já parseados (g._pgn, ~1,8 KB por partida): é o que deixa
// dossiê e motor funcionarem numa restauração. Falha de gravação vira aviso na linha de status, não silêncio.
async function salvarUltima(){
  if (!estado) return;
  const compacto = estado.jogos.map(g => { parsePGN(g); const {pgn, tcn, initial_setup, fen, ...resto} = g; return resto; });
  const ok = await armazem.gravar('buscas', chaveBusca(estado.nick), {quando: Date.now(), versao: VERSAO_ESTADO, estado: {...estado, jogos: compacto}});
  armazem.podar('buscas', MAX_BUSCAS);
  if (!ok && !$('status').className) { const st = $('status'), aviso = `sem cache local (${armazem.erro || 'IndexedDB indisponível'})`; if (!st.textContent.includes('sem cache local')) st.textContent = st.textContent ? `${st.textContent} · ${aviso}` : `Busca concluída · ${aviso}`; }
}
function carregarUltima(nick){
  try {
    const u = armazem.ler('buscas', chaveBusca(nick));
    if (!u || u.versao !== VERSAO_ESTADO) return false;
    estado = structuredClone(u.estado); estado.monitorando = $('auto').checked;
    renderAbasModalidade(estado.jogos, null);
    render();
    $('status').className = ''; $('status').textContent = `Dados salvos ${new Date(u.quando).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})} · atualizando…`;
    return true;
  } catch { return false; }
}

// buscar() em partes: lerFormulario() lê e valida; mesesDaJanela() escolhe os arquivos mensais; baixarMeses() baixa um por
// vez; montarPartidas() é a parte pura (filtra, calcula delta, agrega) — sem DOM nem rede; renderAbasModalidade() monta as
// abas de modalidade (também usada na restauração do cache). buscar() orquestra e cuida do estado da tela.

// lê e valida o formulário; devolve null com a mensagem já no status quando não dá para buscar
function lerFormulario(){
  const nick = $('nick').value.trim().toLowerCase();
  const [inicio, fim] = periodo();
  const modalidades = new Set([...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value));
  const status = $('status');
  status.className = '';
  const erro = msg => { status.className = 'error'; status.textContent = msg; return null; };
  if (isNaN(inicio)) return erro('Informe a data de início.');
  if (fim && fim < inicio) return erro('A data de fim é anterior ao início.');
  if (!modalidades.size) return erro('Marque ao menos uma modalidade.');
  const comparando = $('comparar').checked;
  const [iniAnt, fimAnt] = comparando ? periodoAnterior(inicio, fim) : [];
  return {nick, inicio, fim, inicioTs: inicio.getTime() / 1000, fimTs: fim ? fim.getTime() / 1000 : Infinity, modalidades, monitorando: $('auto').checked,
    soHumanos: $('soHumanos').checked, comparando, iniAnt, fimAnt, iniAntTs: comparando ? iniAnt.getTime() / 1000 : 0, fimAntTs: comparando ? fimAnt.getTime() / 1000 : 0};
}

// arquivos mensais que cobrem a janela (do início — ou do período anterior, se comparando — até o fim), mais o mês
// anterior ao primeiro: a variação de rating da primeira partida precisa da ranqueada anterior como referência
function mesesDaJanela(archives, base, fim){
  const chave = base.getFullYear() * 100 + base.getMonth() + 1;
  const chaveFim = fim ? fim.getFullYear() * 100 + fim.getMonth() + 1 : Infinity;
  let meses = archives.filter(u => { const [y,m] = u.split('/').slice(-2).map(Number); return y*100 + m >= chave && y*100 + m <= chaveFim; });
  const idx = archives.indexOf(meses[0]);
  if (idx > 0) meses.unshift(archives[idx-1]);
  else if (!meses.length && archives.length) meses = archives.slice(-1);
  return meses;
}

// um por vez: a API do Chess.com rejeita chamadas paralelas. Na atualização automática só o último mês é rebaixado
async function baixarMeses(meses, atualizacao){
  const todos = [];
  for (let i = 0; i < meses.length; i++) {
    const c = cache.get(meses[i]);
    if (atualizacao === true && i < meses.length - 1 && c) { todos.push(...c.data.games); continue; }
    todos.push(...(await getJSON(meses[i])).games);
  }
  return todos.sort((a,b) => a.end_time - b.end_time);
}

// a parte pura: filtra modalidade e bots/amistosas, calcula g.delta pela ranqueada anterior da mesma modalidade,
// separa o período (jogos) do anterior (só agregados) e guarda o rating de antes/depois por modalidade. Sem partida
// ranqueada anterior como referência (conta nova na modalidade), `antes` cai para o rating da 1ª partida — já com o
// resultado dela embutido — e `aprox[tc]` marca a aproximação, para o placar mostrar "≈" em vez de "?" e variação 0
function montarPartidas(todos, f){
  const antes = {}, depois = {}, ultimo = {}, aprox = {}, jogos = [], compTc = f.comparando ? {} : null;
  let ignoradas = 0;
  for (const g of todos) {
    if (!f.modalidades.has(g.time_class)) continue;
    if (f.soHumanos && (!g.rated || ehBot(g, f.nick))) { if (g.end_time >= f.inicioTs && g.end_time <= f.fimTs) ignoradas++; continue; }
    const eu = g.white.username.toLowerCase() === f.nick ? g.white : g.black;
    const tc = g.time_class;
    if (g.end_time >= f.inicioTs && g.end_time <= f.fimTs) {
      g.delta = g.rated && tc in ultimo ? eu.rating - ultimo[tc] : null;
      if (g.rated) { if (!(tc in antes)) { antes[tc] = ultimo[tc] ?? eu.rating; if (!(tc in ultimo)) aprox[tc] = true; } depois[tc] = eu.rating; }
      jogos.push(g);
    } else if (compTc && g.end_time >= f.iniAntTs && g.end_time <= f.fimAntTs) {
      // do período anterior guardamos só os agregados: o estado inteiro vai para o localStorage
      const c = compTc[tc] ??= {n: 0, w: 0, d: 0, l: 0, acc: 0, accN: 0, antes: undefined, depois: null};
      c.n++; c[eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l']++;
      const ac = g.accuracies?.[eu === g.white ? 'white' : 'black'];
      if (ac != null) { c.acc += ac; c.accN++; }
      if (g.rated) { if (c.antes === undefined) c.antes = ultimo[tc] ?? eu.rating; c.depois = eu.rating; }
    }
    if (g.rated) ultimo[tc] = eu.rating;
  }
  return {jogos, antes, depois, aprox, compTc, ignoradas};
}

// abas bullet/blitz/rápida/diária: só as que têm partidas (e, na busca, só as marcadas); a ativa continua se ainda existir,
// senão vai para a de mais partidas. `modalidades` null = restauração do cache, sem formulário para consultar
function renderAbasModalidade(jogos, modalidades){
  const contagem = {};
  for (const g of jogos) contagem[g.time_class] = (contagem[g.time_class] || 0) + 1;
  const classes = ['bullet','blitz','rapid','daily'].filter(tc => contagem[tc] && (!modalidades || modalidades.has(tc)));
  if (!classes.includes(aba)) aba = classes.sort((a, b) => contagem[b] - contagem[a])[0] || (modalidades ? [...modalidades][0] : aba);
  const abas = $('abas');
  abas.hidden = classes.length < 2;
  abas.innerHTML = ['bullet','blitz','rapid','daily'].filter(tc => classes.includes(tc))
    .map(tc => `<button type="button" role="tab" aria-selected="${tc === aba}" data-tc="${tc}" class="${tc === aba ? 'ativa' : ''}">${TIPO[tc]} <small>${contagem[tc]}</small></button>`).join('');
}

async function buscar(atualizacao){
  if (ocupado) return;
  const f = lerFormulario();
  if (!f) return;
  const {nick, inicio, fim, monitorando} = f, status = $('status');

  ocupado = true;
  document.body.classList.remove('inicio');
  if (!atualizacao) filtros(false);
  clearTimeout(timer); clearInterval(tick);
  $('proxTxt').textContent = 'Atualizando…'; $('proxBar').style.width = '100%';
  $('btn').disabled = true;
  status.textContent = atualizacao ? 'Atualizando…' : 'Buscando…';
  if (!atualizacao) {
    iaTexto = ''; iaErro = ''; iaMeta = null;
    filtro = ''; $('filtro').value = '';
    await armazem.pronto;
    if (!carregarUltima(nick)) { $('placar').style.display = 'none'; $('kpis').style.display = 'none'; $('partidas').style.display = 'none'; }
    else atualizacao = 'cache';
  }

  try {
    const {archives} = await getJSON(API + nick + '/games/archives');
    const todos = await baixarMeses(mesesDaJanela(archives, f.comparando ? f.iniAnt : inicio, fim), atualizacao);
    const {jogos, antes, depois, aprox, compTc, ignoradas} = montarPartidas(todos, f);
    const rotulo = fim ? `de ${fmt.format(inicio)} a ${fmt.format(fim)}` : `desde ${fmt.format(inicio)}`;
    if (!jogos.length && !monitorando) throw new Error(`Nenhuma partida ${rotulo}.`);

    salvarNick(nick);
    let perfil = null, stats = null;
    if (atualizacao !== true || nick !== estado?.nick) {
      try { perfil = await getJSON(API + nick); } catch {}
      try { stats = await getJSON(API + nick + '/stats'); } catch {}
    } else { perfil = estado.perfil; stats = estado.stats; }
    const comp = compTc ? {rotulo: `${fmtDia.format(f.iniAnt)} a ${fmtDia.format(f.fimAnt)}`, tc: compTc} : null;
    estado = {jogos, antes, depois, aprox, nick, rotulo, monitorando, ignoradas, perfil, stats, comp, evolucao: evolucaoDoPeriodo(inicio, fim)};
    renderAbasModalidade(jogos, f.modalidades);
    if (atualizacao !== true) pagina = 1;
    falhou = false;
    render();
    if (atualizacao !== true) sincronizarURL();
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
