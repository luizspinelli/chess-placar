// Erros a partir das avaliações do motor, no critério do Lichess: queda de chance de vitória do lado que moveu
// (≥10 pp imprecisão, ≥20 erro, ≥30 erro grave). Centipawns brutos enganam — 300 cp numa posição já ganha não custam nada.
const chanceVitoria = cp => Math.abs(cp) >= MATE_BASE ? (cp > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const GRAUS = [[30, 'grave'], [20, 'erro'], [10, 'imprecisão']];
const FASE_PLY = ply => ply < 30 ? 'Abertura (até 15)' : ply < 80 ? 'Meio-jogo (16–40)' : 'Final (41+)';
const FAIXA_RELOGIO = t => t == null ? null : t < 30 ? 'menos de 30 s' : t < 120 ? '30 s a 2 min' : 'mais de 2 min';
const FAIXAS_RELOGIO = ['menos de 30 s', '30 s a 2 min', 'mais de 2 min'];

// erros do jogador numa partida avaliada; null enquanto o motor não passou por ela
function errosDaPartida(g, nick){
  const c = evalsDe(g); if (!c) return null;
  const pg = parsePGN(g), branco = g.white.username.toLowerCase() === nick, lado = branco ? 1 : -1, e = c.e;
  const chance = i => e[i] == null ? null : chanceVitoria(e[i] * lado);   // minha chance de vitória depois de i lances
  const erros = [], meus = [];
  for (let i = 0; i < pg.san.length && i + 1 < e.length; i++) {
    if ((i % 2 === 0) !== branco) continue;
    meus.push({ply: i, relogio: pg.clks[i] ?? null});   // o relógio do PGN é o que sobrava ao concluir o lance
    const antes = chance(i), depois = chance(i + 1);
    if (antes == null || depois == null) continue;
    const queda = antes - depois, grau = GRAUS.find(([min]) => queda >= min)?.[1];
    if (grau) erros.push({ply: i, lance: Math.floor(i / 2) + 1, san: pg.san[i], melhor: c.m?.[i] || null, grau, queda: Math.round(queda), antes: Math.round(antes), depois: Math.round(depois), relogio: pg.clks[i] ?? null, fase: FASE_PLY(i)});
  }
  // decisivo: primeiro erro que deixou a chance abaixo de 30% sem ela voltar a passar de 45% até o fim
  let decisivo = null;
  for (const er of erros) {
    if (er.depois > 30) continue;
    let voltou = false;
    for (let j = er.ply + 2; j < e.length; j++) if ((chance(j) ?? 0) > 45) { voltou = true; break; }
    if (!voltou) { decisivo = er; break; }
  }
  // viradas: a chance cruzou de <20% para >50% (a favor) ou de >80% para <50% (contra)
  let favor = 0, contra = 0, baixo = false, alto = false;
  for (let j = 0; j < e.length; j++) {
    const ch = chance(j); if (ch == null) continue;
    if (ch < 20) baixo = true; if (ch > 80) alto = true;
    if (baixo && ch > 50) { favor++; baixo = false; } if (alto && ch < 50) { contra++; alto = false; }
  }
  return {erros, decisivo, favor, contra, meus, prof: c.p};
}

// agregados das partidas já avaliadas; `itens` são {g, r: 'w'|'d'|'l', adv?, dt?} (os L do kpis servem direto)
function resumoErros(itens, nick){
  const analisadas = itens.map(x => ({x, er: errosDaPartida(x.g, nick)})).filter(a => a.er);
  if (!analisadas.length) return null;
  const cont = {grave: 0, erro: 0, imprecisão: 0}, fase = {}, relogio = {}, lancesRelogio = {}, porAbertura = {}, decisivos = [];
  let favor = 0, contra = 0, lances = 0;
  for (const {x, er} of analisadas) {
    favor += er.favor; contra += er.contra; lances += er.meus.length;
    for (const m of er.meus) { const f = FAIXA_RELOGIO(m.relogio); if (f) lancesRelogio[f] = (lancesRelogio[f] || 0) + 1; }
    for (const e of er.erros) {
      cont[e.grau]++;
      if (e.grau === 'imprecisão') continue;
      fase[e.fase] = (fase[e.fase] || 0) + 1;
      const f = FAIXA_RELOGIO(e.relogio); if (f) relogio[f] = (relogio[f] || 0) + 1;
    }
    const ab = parsePGN(x.g).variante, pa = porAbertura[ab] ??= {n: 0, graves: 0};
    pa.n++; pa.graves += er.erros.filter(e => e.grau === 'grave').length;
    if (x.r === 'l' && er.decisivo) decisivos.push({x, er: er.decisivo});
  }
  return {n: analisadas.length, cont, fase, relogio, lancesRelogio, porAbertura, decisivos, favor, contra, lances, prof: analisadas[0].er.prof};
}
// erros (graves + erros) por 100 lances numa faixa de relógio — compara pressão de tempo com o resto
const taxaErros = (res, faixa) => res.lancesRelogio[faixa] ? (res.relogio[faixa] || 0) / res.lancesRelogio[faixa] * 100 : null;

// cards da aba Precisão (o kpis() chama quando há partidas avaliadas)
function cardsErros(res, total, nick){
  const por = v => (v / res.n).toFixed(1);
  const geral = [
    kv('Partidas analisadas', `${res.n} de ${total} <small>profundidade ${res.prof}</small>`),
    kv('Erros graves por partida', por(res.cont.grave)), kv('Erros por partida', por(res.cont.erro)), kv('Imprecisões por partida', por(res.cont.imprecisão)),
    kv('Viradas a favor / contra', `${res.favor} / ${res.contra}`),
  ].join('');
  const fases = ['Abertura (até 15)', 'Meio-jogo (16–40)', 'Final (41+)'].map(f => kv(f, res.fase[f] || 0)).join('');
  const rel = FAIXAS_RELOGIO.filter(f => res.lancesRelogio[f]).map(f => { const t = taxaErros(res, f); return kv(f, `${res.relogio[f] || 0} <small>em ${res.lancesRelogio[f]} lances · ${t.toFixed(1)} por 100</small>`); }).join('');
  const abert = Object.entries(res.porAbertura).filter(([, v]) => v.n >= 3).sort((a, b) => b[1].graves / b[1].n - a[1].graves / a[1].n).slice(0, 5)
    .map(([k, v]) => kv(escHtml(k), `${(v.graves / v.n).toFixed(1)} <small>graves/partida · ${v.n} partidas</small>`)).join('');
  const dec = res.decisivos.sort((a, b) => b.x.ts - a.x.ts).slice(0, 8).map(({x, er}) => {
    const quem = escHtml(x.adv?.username || '');
    return `<tr><td>${x.g.url ? `<a href="${escHtml(x.g.url)}" target="_blank" rel="noopener">` : ''}${fmtDiaMes.format(x.dt)} vs ${quem}${x.g.url ? '</a>' : ''} <small>lance ${er.lance} ${escHtml(er.san)}${er.melhor ? ` · melhor ${escHtml(er.melhor)}` : ''}</small></td><td><b class="l">−${er.queda} pp</b>${er.relogio != null ? ` <small>${seg(er.relogio)} no relógio</small>` : ''}</td></tr>`;
  }).join('');
  return [
    card('Erros <small>(motor)</small>', tabela(geral)),
    card('Erros por fase <small>(graves + erros)</small>', tabela(fases)),
    card('Erros e relógio', rel ? tabela(rel) : vazio),
    abert ? card('Erros graves por abertura', tabela(abert)) : '',
    dec ? card('Onde as derrotas escaparam', tabela(dec), 'span2') : '',
  ].join('');
}

// achados automáticos derivados do motor (o kpis() chama com o `add` dele)
function achadosErros(res, add){
  if (!res || res.n < 10) return;
  const t30 = taxaErros(res, 'menos de 30 s'), tResto = FAIXAS_RELOGIO.slice(1).reduce((s, f) => s + (res.relogio[f] || 0), 0) / Math.max(1, FAIXAS_RELOGIO.slice(1).reduce((s, f) => s + (res.lancesRelogio[f] || 0), 0)) * 100;
  if (t30 != null && (res.relogio['menos de 30 s'] || 0) >= 5 && t30 >= tResto * 2) add('alerta', 'Erros sob pressão de tempo', `Com menos de 30 s no relógio você erra ${t30.toFixed(1)} vezes por 100 lances, contra ${tResto.toFixed(1)} com mais tempo (${res.relogio['menos de 30 s']} erros nessa faixa em ${res.n} partidas avaliadas). O problema não é o xadrez, é chegar ao apuro: gastar menos na abertura e no meio-jogo vale mais que estudar tática.`);
  const totalFase = Object.values(res.fase).reduce((a, b) => a + b, 0);
  if (totalFase >= 8) {
    const [f, n] = Object.entries(res.fase).sort((a, b) => b[1] - a[1])[0];
    if (n / totalFase >= 0.5) add('atencao', `Erros concentrados: ${f.toLowerCase()}`, `${n} dos ${totalFase} erros e erros graves (${Math.round(n / totalFase * 100)}%) acontecem nessa fase, segundo o motor. É onde o estudo rende mais.`);
  }
  const noApuro = res.decisivos.filter(d => d.er.relogio != null && d.er.relogio < 30).length;
  if (res.decisivos.length >= 4 && noApuro / res.decisivos.length >= 0.5) add('alerta', 'Derrotas decididas no apuro', `Em ${noApuro} das ${res.decisivos.length} derrotas avaliadas o lance decisivo veio com menos de 30 s no relógio.`);
  const cedo = res.decisivos.filter(d => d.er.lance <= 15).length;
  if (res.decisivos.length >= 4 && cedo / res.decisivos.length >= 0.5) add('atencao', 'Derrotas decididas na abertura', `Em ${cedo} das ${res.decisivos.length} derrotas avaliadas o lance decisivo veio até o 15º lance — a partida acaba antes do meio-jogo. Revisar essas aberturas (aba Aberturas) é o caminho curto.`);
}
