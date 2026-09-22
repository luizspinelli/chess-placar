// Motor de análise: Stockfish 19 (WASM, single-thread) num Web Worker, alimentado por lances que o chess.js converte
// de SAN para UCI. Roda inteiro no navegador — nada sai da máquina. Só funciona servido por http(s): em file:// o
// Chrome bloqueia Worker e WASM, e aí o cartão explica em vez de falhar. Avaliações ficam em cache por URL da partida.
const MOTOR_URL = 'vendor/stockfish/stockfish-19-lite-single.js', CHAVE_EVALS = 'placar-chesscom:evals', MAX_EVALS = 600;
const MATE_BASE = 20000;   // |cp| >= MATE_BASE codifica mate: sinal = quem dá, |cp| - MATE_BASE = em quantos lances
const PROFUNDIDADES = {10: 'rápida', 12: 'padrão', 14: 'profunda'};
const motor = {worker: null, pronto: null, rodando: false, cancelar: false, progresso: null, erro: '', inicial: {}};
const motorDisponivel = () => typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && location.protocol !== 'file:' && typeof Chess === 'function';
const motorProf = () => +lerLS('placar-chesscom:motorProf', '12') || 12;

function motorIniciar(){
  if (motor.pronto) return motor.pronto;
  motor.pronto = new Promise((ok, falha) => {
    let w;
    try { w = new Worker(MOTOR_URL); } catch (e) { motor.pronto = null; falha(new Error('Não foi possível carregar o motor: ' + e.message)); return; }
    const t = setTimeout(() => { motor.pronto = null; w.terminate(); falha(new Error('O motor não respondeu em 30 s.')); }, 30000);
    w.onerror = e => { clearTimeout(t); motor.pronto = null; falha(new Error('Erro ao carregar o motor' + (e.message ? ': ' + e.message : '.'))); };
    w.onmessage = e => { if (String(e.data).startsWith('uciok')) { clearTimeout(t); motor.worker = w; w.onmessage = null; ok(w); } };
    w.postMessage('uci');
  });
  return motor.pronto;
}
// manda um comando UCI e espera a linha que casa com `fim`; devolve tudo que chegou até lá (os comandos são sequenciais)
const motorComando = (cmd, fim) => new Promise(ok => {
  const w = motor.worker, linhas = [];
  w.onmessage = e => { const t = String(e.data); linhas.push(t); if (fim.test(t)) { w.onmessage = null; ok(linhas); } };
  w.postMessage(cmd);
});
// avalia a posição depois dos lances `uci`; devolve {cp, best}: cp do ponto de vista das BRANCAS (o Stockfish
// responde do lado que move) e o melhor lance em UCI
async function motorAvaliar(uci, profundidade, brancasMovem){
  motor.worker.postMessage('position startpos' + (uci.length ? ' moves ' + uci.join(' ') : ''));
  const linhas = await motorComando('go depth ' + profundidade, /^bestmove/);
  let info = null;
  for (const l of linhas) if (l.startsWith('info depth ') && l.includes(' score ') && !/ (upper|lower)bound/.test(l)) info = l;
  const best = linhas[linhas.length - 1].split(' ')[1], m = info?.match(/score (cp|mate) (-?\d+)/);
  const r = {cp: null, best: best && best !== '(none)' ? best : null};
  if (!m) return r;
  const lado = brancasMovem ? 1 : -1, n = +m[2];
  r.cp = m[1] === 'cp' ? n * lado : n === 0 ? -MATE_BASE * lado : (n > 0 ? 1 : -1) * lado * (MATE_BASE + Math.abs(n));   // "mate 0": quem move já está em mate
  return r;
}
// UCI → SAN na posição atual, sem deixar rastro (joga e desfaz)
const uciParaSan = (ch, uci) => { if (!uci || uci.length < 4) return null; const mv = ch.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]}); if (!mv) return null; ch.undo(); return mv.san; };
// {e, m}: e[i] = avaliação DEPOIS do i-ésimo lance (e[0] = posição inicial); m[i] = melhor lance na posição ANTES
// do i-ésimo lance, em SAN — é o que deveria ter sido jogado no lugar dele. null se cancelado no meio.
async function avaliarPartida(g, profundidade, aoAvancar){
  const san = parsePGN(g).san, ch = new Chess(), uci = [];
  motor.inicial[profundidade] ??= await motorAvaliar([], profundidade, true);
  const e = [motor.inicial[profundidade].cp], m = [];
  let melhor = motor.inicial[profundidade].best;
  for (let i = 0; i < san.length; i++) {
    m.push(uciParaSan(ch, melhor));   // antes de aplicar o lance: o SAN depende da posição em que o melhor seria jogado
    const mv = ch.move(san[i]);   // modo estrito: o "sloppy" do chess.js lê "bxa3" como lance de bispo e falha
    if (!mv) throw new Error(`lance ${Math.floor(i / 2) + 1} (${san[i]}) não é válido`);
    uci.push(mv.from + mv.to + (mv.promotion || ''));
    if (motor.cancelar) return null;
    // posição terminal não precisa de motor: mate é mate, afogamento é zero
    const r = ch.in_checkmate() ? {cp: ch.turn() === 'w' ? -MATE_BASE : MATE_BASE, best: null} : ch.game_over() ? {cp: 0, best: null} : await motorAvaliar(uci, profundidade, ch.turn() === 'w');
    e.push(r.cp); melhor = r.best;
    aoAvancar?.();
  }
  return {e, m};
}

// ---- cache: {url: {p: profundidade, t: quando, e: [cp...] | null (partida que o motor não conseguiu ler), m: [melhor lance em SAN...]}}
let evalsCache = (() => { try { return JSON.parse(lerLS(CHAVE_EVALS, '{}')) || {}; } catch { return {}; } })();
const evalsDe = g => { const c = evalsCache[g.url]; return c && c.e ? c : null; };
function guardarEvals(g, p, res){
  evalsCache[g.url] = {p, t: Date.now(), e: res?.e ?? null, m: res?.m};
  const urls = Object.keys(evalsCache);
  if (urls.length > MAX_EVALS) for (const u of urls.sort((a, b) => evalsCache[a].t - evalsCache[b].t).slice(0, urls.length - MAX_EVALS)) delete evalsCache[u];
  gravarLS(CHAVE_EVALS, JSON.stringify(evalsCache));
}
// as mesmas partidas do dossiê da IA: as últimas N da modalidade que têm lances; só xadrez padrão (o chess.js não lê 960)
const partidasParaMotor = (jogos, N = N_DOSSIE) => [...jogos].filter(g => g.rules === 'chess' && parsePGN(g).meias >= 2).sort((a, b) => a.end_time - b.end_time).slice(-N);
const pendentesMotor = (jogos, prof) => partidasParaMotor(jogos).filter(g => { const c = evalsCache[g.url]; return !c || (c.e && c.p < prof); });

// ---- execução: derrotas primeiro (é onde está o valor), depois empates, depois vitórias
async function motorAnalisar(){
  if (motor.rodando || !estado) return;
  const nick = estado.nick, prof = motorProf();
  const peso = g => { const eu = g.white.username.toLowerCase() === nick ? g.white : g.black; return eu.result === 'win' ? 2 : DRAWS.has(eu.result) ? 1 : 0; };
  const fila = pendentesMotor(estado.jogos.filter(g => g.time_class === aba), prof).sort((a, b) => peso(a) - peso(b) || a.end_time - b.end_time);
  motor.rodando = true; motor.cancelar = false; motor.erro = '';
  motor.progresso = {feitas: 0, total: fila.length, pos: 0, posTotal: fila.reduce((t, g) => t + parsePGN(g).meias, 0), ms: 0, falhas: 0};
  renderMotor();
  const t0 = performance.now();
  try {
    await motorIniciar();
    let ultimaTela = 0;
    for (const g of fila) {
      if (motor.cancelar) break;
      let res = null;
      try {
        res = await avaliarPartida(g, prof, () => { motor.progresso.pos++; motor.progresso.ms = performance.now() - t0; const agora = performance.now(); if (agora - ultimaTela > 500) { ultimaTela = agora; renderMotor(); } });
      } catch (err) { guardarEvals(g, prof, null); motor.progresso.falhas++; motor.progresso.feitas++; continue; }
      if (!res) break;
      guardarEvals(g, prof, res);
      motor.progresso.feitas++;
      // a aba Erros e precisão mostra os erros: refaz os cards conforme as partidas chegam; nas outras abas só o cartão do motor
      if (abaKpi === 'Erros e precisão') { kpiData = kpis(estado.jogos.filter(g => g.time_class === aba), nick); renderKpis(); } else renderMotor();
    }
  } catch (err) {
    motor.erro = err.message;
  }
  motor.rodando = false;
  kpiData = kpis(estado.jogos.filter(g => g.time_class === aba), nick);
  renderKpis();
}
function motorParar(){ motor.cancelar = true; motor.worker?.postMessage('stop'); }

// ---- pedaços do cartão da IA: os controles vivem dentro de "configurar", o status logo abaixo da barra de ação
const motorContagem = () => {
  const jogos = estado.jogos.filter(g => g.time_class === aba), todas = partidasParaMotor(jogos), prof = motorProf();
  return {todas, prof, prontas: todas.filter(g => evalsDe(g)).length, pendentes: pendentesMotor(jogos, prof).length};
};
// resumo curto para a barra de ação: "motor 65/65 · profundidade 10"
function motorResumo(){
  if (!estado || !motorDisponivel()) return '';
  const {todas, prontas, prof} = motorContagem();
  return todas.length ? `motor ${prontas}/${todas.length} em profundidade ${prof}` : '';
}
function motorControles(){
  if (!estado) return '';
  if (!motorDisponivel()) return `<small class="explica">Motor de análise indisponível: ${location.protocol === 'file:' ? 'a página precisa vir de um servidor (http ou https) — aberta como arquivo local, o navegador bloqueia o Worker e o WASM.' : 'este navegador não tem Web Worker ou WebAssembly.'} A análise da IA segue sem os erros do Stockfish.</small>`;
  const {todas, pendentes, prof} = motorContagem(), celular = /Mobi|Android/i.test(navigator.userAgent);
  const n = pendentes || todas.length;
  return `<div class="motorCfg"><span class="rotulo">Motor</span>
    <select id="motorProf" class="modelo" ${motor.rodando ? 'disabled' : ''}>${Object.entries(PROFUNDIDADES).map(([k, v]) => `<option value="${k}" ${+k === prof ? 'selected' : ''}>profundidade ${k} (${v})</option>`).join('')}</select>
    <button type="button" id="motorBtn" class="secundario" title="Só o motor, sem chamar a IA: gera os cards de erros da aba Erros e precisão e não precisa de chave" ${pendentes && !motor.rodando ? '' : 'disabled'}>Só o motor · ${n} partida${n === 1 ? '' : 's'}</button>
    <small class="explica">Stockfish 19 rodando no seu navegador; nada sai da máquina. Profundidade 12 leva uns 5 s por partida no computador${celular ? '; no celular é mais lento e gasta bateria' : ''}. Subir a profundidade refaz só o que está abaixo dela.</small></div>`;
}
// barra de progresso e linha de status; vazio no estado normal (o resumo já está na barra de ação)
function motorStatus(){
  if (!estado || !motorDisponivel()) return '';
  const p = motor.progresso;
  if (motor.rodando) {
    const pct = p.posTotal ? Math.round(p.pos / p.posTotal * 100) : 0, resta = p.pos > 20 ? seg(Math.round((p.posTotal - p.pos) * (p.ms / p.pos) / 1000)) : null;
    return `<div class="barra"><i style="width:${pct}%"></i></div><p class="status">Motor: partida ${p.feitas + 1}/${p.total} · posição ${p.pos}/${p.posTotal}${resta ? ` · ~${resta} restantes` : ''} · <button type="button" id="motorParar" class="link">parar</button></p>`;
  }
  if (p) return `<p class="status">Motor: ${p.feitas - p.falhas} partida${p.feitas - p.falhas === 1 ? '' : 's'} avaliada${p.feitas - p.falhas === 1 ? '' : 's'} em ${seg(Math.round(p.ms / 1000))}${p.falhas ? ` · ${p.falhas} que o motor não conseguiu ler` : ''}${motor.cancelar ? ' · interrompido' : ''}. Os erros estão na aba Erros e precisão.</p>${motor.erro ? `<p class="erro">${escHtml(motor.erro)}</p>` : ''}`;
  if (!motorContagem().todas.length) return '<p class="status">Esta busca veio do cache, que não guarda os lances: clique em Buscar para baixá-los e o motor fica disponível.</p>';
  return '';
}
// atualiza só os pedaços do motor, sem refazer o cartão: refazer apagaria a chave que o usuário está digitando
function renderMotor(){
  const st = $('motorStatus'), ct = $('motorControles'), rs = document.querySelector('#cardIA .resumoCfg');
  if (st) st.innerHTML = motorStatus();
  if (ct) ct.innerHTML = motorControles();
  if (rs) rs.textContent = [`${PROVEDORES[provAtual()].nome} · ${lerLS(modeloLS(provAtual()), PROVEDORES[provAtual()].padrao)}`, motorResumo()].filter(Boolean).join(' · ');
}
$('kpiGrid').addEventListener('click', e => { if (e.target.id === 'motorBtn') motorAnalisar(); if (e.target.id === 'motorParar') motorParar(); });
$('kpiGrid').addEventListener('change', e => { if (e.target.id === 'motorProf') { gravarLS('placar-chesscom:motorProf', e.target.value); renderMotor(); } });
