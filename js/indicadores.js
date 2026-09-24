// kpis(): uma passada pelas partidas gera o HTML de todas as abas e os achados automáticos. Glossário e sparkline.
const GLOSSARIO = {
  'Adversário': 'Compara o rating do adversário com o seu ANTES da partida (a API informa o de depois; o de antes é estimado pela variação, senão o resultado contaminaria a comparação): mais forte = 25+ pontos acima, mais fraco = 25+ abaixo. O Chess.com pareia quase sempre dentro de ±25, então os extremos têm poucas partidas.',
  'Sessões': 'Sessão é um bloco de partidas com menos de 30 minutos de intervalo entre uma e outra. Serve para ver se você rende diferente no começo e no fim de uma sequência de jogos.',
  'Posição na sessão': 'Ordem da partida dentro da sessão: 1ª = a primeira depois de uma pausa de 30 min ou mais.',
  'Tilt': 'Rendimento nas partidas jogadas logo após uma ou duas derrotas seguidas. Se cair muito abaixo da sua média, as derrotas estão afetando as próximas partidas.',
  'Precisão': 'Métrica do Chess.com (0–100) que compara seus lances com os do motor. Só existe nas partidas que foram analisadas no site.',
  'Você × adversário': 'Compara sua precisão com a do adversário na mesma partida. "Jogou melhor e perdeu" = você teve precisão maior e mesmo assim perdeu, o que costuma indicar um único erro decisivo.',
  'Marcos de 50 pontos': 'Quantas partidas levou para cruzar cada múltiplo de 50 no rating pela primeira vez no período.',
  'Maior alta e queda acumuladas': 'Alta: maior subida de rating sem voltar ao mínimo anterior. Queda: maior descida a partir de um pico (drawdown).',
  'Relógio ao final': 'Tempo que sobrava no seu relógio e no do adversário quando a partida terminou. Perder com muito tempo sobrando costuma indicar decisões apressadas.',
  'Quem tinha mais tempo': 'Resultado das partidas separadas por quem terminou com mais tempo no relógio.',
  'Fase em que termina': 'Abertura: até o lance 15. Meio-jogo: 16 a 40. Final: 41 em diante.',
  'De brancas': 'Clique no nome para ver a posição no tabuleiro: os lances mostrados são os que se repetem em todas as suas partidas daquela abertura, e é por eles que dá para reconhecê-la sem saber o nome.',
  'De pretas': 'Clique no nome para ver a posição no tabuleiro: os lances mostrados são os que se repetem em todas as suas partidas daquela abertura, e é por eles que dá para reconhecê-la sem saber o nome.',
  'Melhores variantes': 'Clique no nome para ver a posição no tabuleiro: os lances mostrados são os que se repetem em todas as suas partidas daquela abertura, e é por eles que dá para reconhecê-la sem saber o nome.',
  'Piores variantes': 'Clique no nome para ver a posição no tabuleiro: os lances mostrados são os que se repetem em todas as suas partidas daquela abertura, e é por eles que dá para reconhecê-la sem saber o nome.',
  'Distribuição por código ECO': 'ECO é a classificação padrão de aberturas (Encyclopaedia of Chess Openings), de A00 a E99. A = irregulares e de flanco, B = 1.e4 sem 1…e5, C = 1.e4 e5 e a Francesa, D = 1.d4 d5, E = Índias. Na barra a largura é o volume de partidas e a cor é o aproveitamento.',
  'Cor': 'Resultado quando você jogou de brancas e quando jogou de pretas.',
  'Erros': 'Avaliação do Stockfish, rodando no seu navegador, nas partidas que você mandou analisar. Um lance conta como erro pela queda da sua chance de vitória: 10 pontos percentuais ou mais é imprecisão, 20 é erro, 30 é erro grave (critério do Lichess). "Virada" é quando a chance cruza de menos de 20% para mais de 50%, ou o contrário.',
  'Erros e relógio': 'Quantos erros e erros graves você cometeu com cada faixa de tempo no relógio, e a taxa por 100 lances jogados nessa faixa — é a taxa que diz se o apuro te faz errar mais.',
  'Onde as derrotas escaparam': 'Em cada derrota avaliada, o primeiro erro que deixou sua chance abaixo de 30% sem ela voltar a passar de 45% até o fim. O link abre a partida no Chess.com.',
  'Evolução': 'Quebra o período escolhido em blocos da mesma unidade — 4 semanas viram 4 semanas, 3 meses viram 3 meses, 5 dias viram 5 dias — com o aproveitamento e a variação de rating de cada um. Períodos longos agrupam os blocos para caber em até 12 linhas.',
  'Mapa de calor': 'Cada célula é um dia da semana × hora. Verde = aproveitamento de 50% ou mais, vermelho = abaixo; quanto mais forte a cor, mais partidas naquele horário. Passe o mouse ou toque numa célula para ver os números.',
  'Como a sessão terminou': 'Qual foi o resultado da última partida antes de uma pausa. Parar muito após derrota costuma indicar "só mais uma para recuperar".',
  'Sequências': 'Série atual e maiores séries de vitórias e derrotas seguidas no período.',
};

function sparkline(vals, grande){
  if (vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals), h = grande ? 150 : 60, w = 600, pad = grande ? 18 : 4;
  const y = v => max === min ? h/2 : h - pad - (v - min) / (max - min) * (h - pad * 2);
  const x = i => 8 + i / (vals.length-1) * (w - 16);
  const pts = vals.map((v,i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  const iMax = vals.indexOf(max), iMin = vals.indexOf(min);
  const rot = grande ? `
    <circle cx="${x(iMax)}" cy="${y(max)}" r="3.5" fill="${cor('--win')}"/><text x="${x(iMax)}" y="${y(max) - 7}" text-anchor="${iMax > vals.length * .85 ? 'end' : iMax < vals.length * .15 ? 'start' : 'middle'}" font-size="12" fill="${cor('--win')}" font-weight="600">${max}</text>
    <circle cx="${x(iMin)}" cy="${y(min)}" r="3.5" fill="${cor('--loss')}"/><text x="${x(iMin)}" y="${y(min) + 15}" text-anchor="${iMin > vals.length * .85 ? 'end' : iMin < vals.length * .15 ? 'start' : 'middle'}" font-size="12" fill="${cor('--loss')}" font-weight="600">${min}</text>
    <circle cx="${x(vals.length-1)}" cy="${y(vals[vals.length-1])}" r="4" fill="${cor('--surface')}" stroke="${cor('--text')}" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px" role="img" aria-label="Gráfico de rating: mínimo ${min}, máximo ${max}, atual ${vals[vals.length-1]}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor('--accent')}" stop-opacity=".35"/><stop offset="1" stop-color="${cor('--accent')}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${x(0)},${h} ${pts} ${x(vals.length-1)},${h}" fill="url(#${id})"/>
    <polyline points="${pts}" fill="none" stroke="${cor('--text')}" stroke-width="${grande ? 2 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${rot}</svg>`;
}

// kpis() em seções: prepararPartidas() faz a passada que todas usam (L ordenada, com sessão e posição); cada
// seção recebe L (e o que outra seção exportou) e devolve {html, ...dados}; achadosAutomaticos() consome só os
// dados exportados. kpis() orquestra e monta o objeto {nomeDaAba: html}.
const somaWDL = s => s.w + s.d + s.l, aprov = s => (s.w + s.d/2) / somaWDL(s);

function prepararPartidas(jogos, nick){
  const L = [...jogos].sort((a,b) => a.end_time - b.end_time).map(g => {
    const branco = g.white.username.toLowerCase() === nick;
    const eu = branco ? g.white : g.black, adv = branco ? g.black : g.white;
    const dt = new Date(g.end_time * 1000);
    // a API devolve o rating DEPOIS da partida: comparar com ele embute o resultado (perdeu → adversário parece mais forte).
    // Antes ≈ meu rating − minha variação; o do adversário ≈ dele + minha variação (a troca é quase simétrica)
    const d = g.delta, euPre = d == null ? eu.rating : eu.rating - d, advPre = d == null ? adv.rating : adv.rating + d;
    return {g, eu, adv, branco, euPre, advPre, r: eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l', dt, ts: g.end_time, tc: g.time_class,
      acc: g.accuracies?.[branco ? 'white' : 'black'] ?? null, accAdv: g.accuracies?.[branco ? 'black' : 'white'] ?? null};
  });
  // sessões
  let sessao = -1, pos = 0, prevTs = -Infinity;
  const sessoes = [];
  for (const x of L) {
    if (x.ts - prevTs > SESSAO) { sessao++; pos = 0; sessoes.push({itens: [], delta: 0}); }
    pos++; x.sessao = sessao; x.pos = pos; x.gap = pos > 1 ? x.ts - prevTs : null;
    sessoes[sessao].itens.push(x); sessoes[sessao].delta += x.g.delta || 0;
    prevTs = x.ts;
  }
  return {L, sessoes};
}

function secaoResultados(L){
  // ---- Evolução dentro do período (blocos vindos do próprio atalho: 4 semanas, 3 meses, 5 dias…)
  const evo = estado?.evolucao ? {titulo: estado.evolucao.titulo, blocos: estado.evolucao.blocos.map(b => ({...b, n: 0, w: 0, d: 0, l: 0, delta: 0, rated: 0}))} : null;
  // o último bloco fica aberto: numa atualização automática chegam partidas depois do fim calculado na busca
  const achaBloco = ts => { const t = ts * 1000, bs = evo.blocos; if (t < bs[0].ini) return null; return bs.find(b => t < b.fim) || bs[bs.length-1]; };

  // ---- Resultados
  const cor = {}, faixa = {}, ganhou = {}, perdeu = {}, empatou = {}, rated = {}, regras = {};
  for (const x of L) {
    if (evo) { const b = achaBloco(x.ts); if (b) { b.n++; b[x.r]++; if (x.g.delta !== null) { b.delta += x.g.delta; b.rated++; } } }
    conta(cor, x.branco ? 'Brancas' : 'Pretas', x.r);
    // sem a variação conhecida (1ª ranqueada do período, amistosa) não dá para estimar o rating de antes: fica fora da faixa
    if (x.g.delta != null) { const dif = x.advPre - x.euPre; conta(faixa, dif > 25 ? 'Mais forte' : dif < -25 ? 'Mais fraco' : 'Parelho', x.r); }
    const obj = x.r === 'w' ? ganhou : x.r === 'l' ? perdeu : empatou;
    const k = x.r === 'w' ? x.adv.result : x.eu.result;
    obj[k] = (obj[k] || 0) + 1;
    conta(rated, x.g.rated ? 'Ranqueadas' : 'Amistosas', x.r);
    conta(regras, x.g.rules, x.r);
  }
  const motivos = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]).map(([k,v]) => kv(MOTIVO[k] || k, v)).join('') || kv('–', 0);
  const linhaBloco = b => {
    const ap = b.n ? (b.w + b.d/2) / b.n * 100 : 0;
    return `<tr><td>${b.rotulo}</td><td>${b.n ? `<span class="pct"><i style="width:${ap}%"></i></span><b>${Math.round(ap)}%</b> <small>${b.w}-${b.d}-${b.l}</small>` : '<small>sem partidas</small>'}</td><td><b class="${cls(b.delta)}">${b.rated ? sinal(b.delta) : '–'}</b></td></tr>`;
  };
  const resultados = [
    evo ? card(`Evolução ${evo.titulo}`, tabela('<tr><td></td><td><small>aproveitamento</small></td><td><small>rating</small></td></tr>' + evo.blocos.map(linhaBloco).join('')), 'span2 evolucao') : '',
    card('Cor', tabela(ordem(cor, ['Brancas','Pretas']))),
    card('Adversário <small>(±25 de rating)</small>', tabela(ordem(faixa, ['Mais forte','Parelho','Mais fraco']))),
    card('Como terminaram', `<div class="motivos">
      <div><h3 class="w">Vitórias</h3>${tabela(motivos(ganhou))}</div>
      <div><h3 class="d">Empates</h3>${tabela(motivos(empatou))}</div>
      <div><h3 class="l">Derrotas</h3>${tabela(motivos(perdeu))}</div></div>`, 'span2'),
    Object.keys(rated).length > 1 ? card('Ranqueadas × amistosas', tabela(ordem(rated, ['Ranqueadas','Amistosas']))) : '',
    Object.keys(regras).length > 1 ? card('Variantes', tabela(n0(regras))) : '',
  ].join('');
  return {html: resultados, cor, faixa, perdeu};
}

function secaoRating(L){
  // ---- Rating
  const curva = {}, ganhoMax = {}, perdaMax = {}, alta = {}, queda = {}, marcos = {};
  curvaDados = {};
  for (const x of L) {
    if (!x.g.rated) continue;
    const tc = x.tc;
    (curva[tc] ??= []).push(x.eu.rating);
    (curvaDados[tc] ??= []).push({ts: x.ts, rating: x.eu.rating, adv: x.adv.username, advRating: x.adv.rating, r: x.r, delta: x.g.delta, url: x.g.url});
    if (x.g.delta !== null) {
      if (!ganhoMax[tc] || x.g.delta > ganhoMax[tc].v) ganhoMax[tc] = {v: x.g.delta, x};
      if (!perdaMax[tc] || x.g.delta < perdaMax[tc].v) perdaMax[tc] = {v: x.g.delta, x};
    }
  }
  for (const [tc, v] of Object.entries(curva)) {
    let pico = v[0], vale = v[0], q = 0, a = 0;
    for (const r of v) { pico = Math.max(pico, r); vale = Math.min(vale, r); q = Math.max(q, pico - r); a = Math.max(a, r - vale); }
    queda[tc] = q; alta[tc] = a;
    const m = []; let ultimoMarco = Math.floor(v[0] / 50) * 50, desde = 0;
    v.forEach((r, i) => { desde++; const marco = Math.floor(r / 50) * 50; if (marco > ultimoMarco) { m.push(kv(`Chegou a ${marco}`, `${desde} partidas`)); ultimoMarco = marco; desde = 0; } });
    marcos[tc] = m.join('');
  }
  const porTc = (obj, f) => Object.keys(obj).map(tc => f(tc, obj[tc])).join('') || vazio;
  const rating = [
    card('Rating', Object.keys(curva).length ? Object.entries(curva).map(([tc, v]) => `<div class="ratingCard"><div class="cab"><span class="tcNome">${TIPO[tc] || tc}</span><span class="stats"><span>${v[0]} → <b>${v[v.length-1]}</b> <b class="${cls(v[v.length-1]-v[0])}">${sinal(v[v.length-1]-v[0])}</b></span><span class="w">▲ ${Math.max(...v)}</span><span class="l">▼ ${Math.min(...v)}</span></span><button type="button" class="ampliar" data-tc="${tc}">⤢ Ampliar</button></div><div class="spark" data-tc="${tc}" title="Ampliar">${sparkline(v, true)}</div></div>`).join('') : '<small>Só amistosas no período</small>', 'span2'),
    card('Maior ganho e perda em uma partida', tabela(porTc(ganhoMax, (tc, m) => kv(`${TIPO[tc]} · ganho`, `${sinal(m.v)} <small>vs ${m.x.adv.username}</small>`) + kv(`${TIPO[tc]} · perda`, `${sinal(perdaMax[tc].v)} <small>vs ${perdaMax[tc].x.adv.username}</small>`)))),
    card('Maior alta e queda acumuladas', tabela(porTc(alta, (tc, a) => kv(`${TIPO[tc]} · alta`, `+${a}`) + kv(`${TIPO[tc]} · queda`, `-${queda[tc]}`)))),
    card('Marcos de 50 pontos', tabela(Object.keys(marcos).map(tc => (Object.keys(marcos).length > 1 ? kv(`<b>${TIPO[tc]}</b>`, '') : '') + (marcos[tc] || kv('Nenhum marco novo', ''))).join('')), 'span2'),
  ].join('');
  return {html: rating, curva};
}

function secaoPrecisao(L, nick){
  // ---- Precisão
  const A = L.filter(x => x.acc !== null);
  const accCor = {}, accPer = {}, accPos = {};
  let melhorPerdeu = 0, piorGanhou = 0;
  for (const x of A) {
    (accCor[x.branco ? 'Brancas' : 'Pretas'] ??= []).push(x.acc);
    const h = x.dt.getHours();
    (accPer[h < 6 ? 'Madrugada' : h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite'] ??= []).push(x.acc);
    (accPos[x.pos === 1 ? '1ª da sessão' : x.pos === 2 ? '2ª' : '3ª+'] ??= []).push(x.acc);
    if (x.accAdv !== null) { if (x.acc > x.accAdv && x.r === 'l') melhorPerdeu++; if (x.acc < x.accAdv && x.r === 'w') piorGanhou++; }
  }
  const accAdv = A.filter(x => x.accAdv !== null).map(x => x.accAdv);
  const kvs = (obj, keys) => keys.filter(k => obj[k]).map(k => kv(k, media(obj[k]))).join('') || vazio;
  const errosMotor = typeof resumoErros === 'function' ? resumoErros(L, nick) : null;
  const precisao = [
    errosMotor ? cardsErros(errosMotor, L.length, nick) : '',
    // sem partidas analisadas no site, cinco cards de "Sem dados" viram uma linha
    ...(A.length ? [
    card('Precisão', tabela(kv('Partidas analisadas', A.length) + kv('Média', media(A.map(x => x.acc))) + kv('Em vitórias', media(A.filter(x => x.r === 'w').map(x => x.acc))) + kv('Em empates', media(A.filter(x => x.r === 'd').map(x => x.acc))) + kv('Em derrotas', media(A.filter(x => x.r === 'l').map(x => x.acc))))),
    card('Por cor', tabela(kvs(accCor, ['Brancas','Pretas']))),
    card('Por período do dia', tabela(kvs(accPer, ['Madrugada','Manhã','Tarde','Noite']))),
    card('Por posição na sessão', tabela(kvs(accPos, ['1ª da sessão','2ª','3ª+']))),
    card('Você × adversário', tabela(kv('Sua média', media(A.map(x => x.acc))) + kv('Média do adversário', media(accAdv)) + kv('Diferença', accAdv.length ? sinal(+(media(A.filter(x => x.accAdv !== null).map(x => x.acc)) - media(accAdv)).toFixed(1)) : '–') + kv('Jogou melhor e perdeu', melhorPerdeu) + kv('Jogou pior e ganhou', piorGanhou)), 'span2'),
    ] : [card('Precisão', '<small>Nenhuma partida deste período foi analisada no Chess.com — a precisão (0–100) só existe nas partidas em que você pediu a análise no site. Os erros acima vêm do motor do próprio painel.</small>')]),
  ].join('');
  return {html: precisao, A, melhorPerdeu, errosMotor};
}

// horários, sequências, controle de tempo e derrotas por tempo saem da mesma passada: os três últimos são cards
// que Sessões e Lances exibem, por isso voltam separados
function secaoRitmo(L){
  // ---- Ritmo
  const periodo = {}, dia = {}, ctrl = {}, timeoutTc = {};
  const heat = Array.from({length: 7}, () => Array(24).fill(null));
  let seq = 0, seqTipo = '', maxW = 0, maxL = 0, runW = 0, runL = 0, posDerrota = {w:0,d:0,l:0}, pos2Derrotas = {w:0,d:0,l:0};
  let a1 = null, a2 = null, somaSen = 0, somaCos = 0;
  const gaps = [];
  for (const x of L) {
    const h = x.dt.getHours();
    conta(periodo, h < 6 ? 'Madrugada' : h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite', x.r);
    conta(dia, DIA[x.dt.getDay()], x.r);
    (heat[x.dt.getDay()][h] ??= {w:0,d:0,l:0})[x.r]++;
    conta(ctrl, `${TIPO[x.tc] || x.tc} ${controle(x.g.time_control)}`, x.r);
    if (x.r === 'l') { (timeoutTc[x.tc] ??= {t:0, n:0}).n++; if (x.eu.result === 'timeout') timeoutTc[x.tc].t++; }
    if (a1 === 'l') posDerrota[x.r]++;
    if (a1 === 'l' && a2 === 'l') pos2Derrotas[x.r]++;
    a2 = a1; a1 = x.r;
    runW = x.r === 'w' ? runW + 1 : 0; runL = x.r === 'l' ? runL + 1 : 0;
    maxW = Math.max(maxW, runW); maxL = Math.max(maxL, runL);
    if (x.r === seqTipo) seq++; else { seq = 1; seqTipo = x.r; }
    // média circular: 23h e 1h devem dar 0h, não 12h
    const ang = (h + x.dt.getMinutes() / 60) / 24 * 2 * Math.PI;
    somaSen += Math.sin(ang); somaCos += Math.cos(ang);
    if (x.gap !== null) gaps.push(x.gap / 60);
  }
  const nomeSeq = seq === 1 ? {w:'vitória', d:'empate', l:'derrota'}[seqTipo] : {w:'vitórias', d:'empates', l:'derrotas'}[seqTipo];
  const hm = (Math.atan2(somaSen, somaCos) / (2 * Math.PI) * 24 + 24) % 24, hmMin = Math.round(hm * 60) % 1440;
  const horaMedia = `${String(Math.floor(hmMin / 60)).padStart(2,'0')}:${String(hmMin % 60).padStart(2,'0')}`;
  const cardSequencias = card('Sequências', tabela(kv('Atual', `${seq} ${nomeSeq}`) + kv('Maior série de vitórias', maxW) + kv('Maior série de derrotas', maxL)));
  const cardControle = card('Controle de tempo', tabela(Object.entries(ctrl).sort((a,b) => (b[1].w+b[1].d+b[1].l)-(a[1].w+a[1].d+a[1].l)).map(([k,s]) => linha(k, s)).join('')));
  const cardTimeout = card('Derrotas por tempo', tabela(Object.entries(timeoutTc).map(([tc, o]) => kv(TIPO[tc] || tc, `${Math.round(o.t / o.n * 100)}% <small>${o.t} de ${o.n}</small>`)).join('') || vazio));
  const maxHeat = Math.max(1, ...heat.flat().map(s => s ? s.w + s.d + s.l : 0));
  const celulaHeat = (s, d, hh) => {
    if (!s) return '<i></i>';
    const tot = s.w + s.d + s.l, apH = (s.w + s.d/2) / tot;
    const alfa = (0.25 + 0.75 * Math.min(1, tot / maxHeat)).toFixed(2);
    return `<i style="background:var(--${apH >= 0.5 ? 'win' : 'loss'});opacity:${alfa}" title="${DIA[d]} ${hh}h: ${tot} partida${tot > 1 ? 's' : ''}, ${Math.round(apH * 100)}% (${s.w}V ${s.d}E ${s.l}D)"></i>`;
  };
  const heatHtml = `<div class="heatWrap"><div class="heat"><span></span>${Array.from({length: 24}, (_, hh) => `<span>${hh % 3 === 0 ? hh : ''}</span>`).join('')}
    ${[1,2,3,4,5,6,0].map(d => `<span>${DIA[d]}</span>${heat[d].map((s, hh) => celulaHeat(s, d, hh)).join('')}`).join('')}</div></div>`;
  const horarios = [
    card('Período do dia', tabela(ordem(periodo, ['Madrugada','Manhã','Tarde','Noite']))),
    card('Dia da semana', tabela(ordem(dia, ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'])), 'span2'),
    card('Mapa de calor <small>(dia × hora)</small>', heatHtml, 'span2'),
    card('Horários', tabela(kv('Hora média das partidas', horaMedia) + kv('Intervalo médio entre partidas', gaps.length ? `${media(gaps)} min` : '–') + kv('Primeira partida do período', fmt.format(L[0].dt)) + kv('Última partida', fmt.format(L[L.length-1].dt)))),
  ].join('');
  return {horarios, cardSequencias, cardControle, cardTimeout, periodo, dia, posDerrota, pos2Derrotas, maxL};
}

function secaoVolume(L){
  // ---- Volume
  const porDia = {}, porSemana = {}, porMes = {}, deltaDia = {}, saldoDia = {};
  for (const x of L) {
    const d = chaveDia(x.dt);
    porDia[d] = (porDia[d] || 0) + 1;
    deltaDia[d] = (deltaDia[d] || 0) + (x.g.delta || 0);
    saldoDia[d] = (saldoDia[d] || 0) + (x.r === 'w' ? 1 : x.r === 'l' ? -1 : 0);
    const seg = new Date(x.dt); seg.setDate(seg.getDate() - (seg.getDay() + 6) % 7);
    const sw = seg.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
    porSemana[sw] = (porSemana[sw] || 0) + 1;
    conta(porMes, chaveMes(x.dt), x.r);
  }
  const dias = Object.keys(porDia), nDias = Object.values(porDia);
  const datasOrd = [...new Set(L.map(x => x.dt.toDateString()))].map(d => new Date(d)).sort((a,b) => a-b);
  let maxRun = 0, run = 0;
  datasOrd.forEach((d, i) => { run = i && (d - datasOrd[i-1]) / 86400000 === 1 ? run + 1 : 1; maxRun = Math.max(maxRun, run); });
  const top = (obj, desc=true) => Object.entries(obj).sort((a,b) => desc ? b[1]-a[1] : a[1]-b[1])[0];
  const melhorSaldo = top(saldoDia), piorSaldo = top(saldoDia, false), melhorDelta = top(deltaDia), piorDelta = top(deltaDia, false);
  const diaMais = top(porDia);
  const volume = [
    card('Partidas', tabela(kv('Total', L.length) + kv('Dias jogados', dias.length) + kv('Média por dia jogado', media(nDias)) + kv('Recorde em um dia', `${diaMais[1]} <small>${diaMais[0]}</small>`) + kv('Média por semana', media(Object.values(porSemana))) + kv('Maior sequência de dias seguidos', `${maxRun} dia${maxRun === 1 ? '' : 's'}`))),
    card('Melhor e pior dia', tabela(kv('Melhor saldo', `${sinal(melhorSaldo[1])} <small>${melhorSaldo[0]}</small>`) + kv('Pior saldo', `${sinal(piorSaldo[1])} <small>${piorSaldo[0]}</small>`) + kv('Maior ganho de rating', `${sinal(melhorDelta[1])} <small>${melhorDelta[0]}</small>`) + kv('Maior perda de rating', `${sinal(piorDelta[1])} <small>${piorDelta[0]}</small>`))),
    card('Aproveitamento por mês', tabela(Object.keys(porMes).map(k => linha(k, porMes[k])).join('')), 'span2'),
    card('Partidas por semana <small>(semana iniciada em)</small>', tabela(Object.entries(porSemana).map(([k, v]) => kv(k, v)).join('')), 'span2'),
  ].join('');
  return {html: volume};
}

function secaoSessoes(L, sessoes, {cardSequencias, posDerrota, pos2Derrotas}){
  // ---- Sessões
  const porPos = {}, parouApos = {w:0, d:0, l:0};
  let sessPos = 0, sessNeg = 0;
  for (const sess of sessoes) {
    parouApos[sess.itens[sess.itens.length-1].r]++;
    if (sess.delta > 0) sessPos++; else if (sess.delta < 0) sessNeg++;
  }
  for (const x of L) conta(porPos, x.pos === 1 ? '1ª da sessão' : x.pos === 2 ? '2ª' : x.pos <= 5 ? '3ª a 5ª' : '6ª+', x.r);
  const tam = sessoes.map(s => s.itens.length);
  const sessoesHtml = [
    card('Sessões <small>(pausa > 30 min separa)</small>', tabela(kv('Sessões', sessoes.length) + kv('Partidas por sessão', media(tam)) + kv('Maior sessão', Math.max(...tam)) + kv('Sessões com rating positivo', `${sessPos} <small>de ${sessoes.length}</small>`) + kv('Sessões com rating negativo', sessNeg))),
    card('Posição na sessão', tabela(ordem(porPos, ['1ª da sessão','2ª','3ª a 5ª','6ª+']))),
    card('Como a sessão terminou', tabela(kv('Parou após vitória', parouApos.w) + kv('Parou após empate', parouApos.d) + kv('Parou após derrota', parouApos.l))),
    card('Tilt', tabela(linha('Após uma derrota', posDerrota) + linha('Após duas derrotas', pos2Derrotas))),
    cardSequencias,
  ].join('');
  return {html: sessoesHtml, porPos, parouApos};
}

function secaoAdversarios(L){
  // ---- Adversários
  const advs = {}, faixaAbs = {}, advMes = {};
  for (const x of L) {
    const a = (advs[x.adv.username] ??= {w:0,d:0,l:0, rating: x.adv.rating}); a[x.r]++; a.rating = x.adv.rating;
    const b = Math.floor(x.advPre / 50) * 50;
    conta(faixaAbs, `${b}–${b+49}`, x.r);
    (advMes[chaveMes(x.dt)] ??= []).push(x.advPre);
  }
  const topAdv = Object.entries(advs).sort((a,b) => (b[1].w+b[1].d+b[1].l)-(a[1].w+a[1].d+a[1].l)).slice(0, 10);
  const adversarios = [
    card('Mais enfrentados', tabela(topAdv.map(([k, s]) => linha(`${k} <small>(${s.rating})</small>`, s)).join('')), 'span2'),
    card('Por rating do adversário', tabela(Object.keys(faixaAbs).sort().map(k => linha(k, faixaAbs[k])).join(''))),
    card('Rating médio dos adversários', tabela(kv('No período', media(L.map(x => x.advPre))) + Object.entries(advMes).map(([k, v]) => kv(k, media(v))).join(''))),
  ].join('');
  return {html: adversarios};
}

function secaoAberturas(L){
  // ---- Aberturas (PGN)
  const abB = {}, abP = {}, variantes = {}, primeiroAdv = {}, meuPrimeiro = {}, minhaResposta = {}, grupos = {}, faixaEco = {};
  const registra = (k, url, san) => {
    if (!san?.length) return;
    const e = ((grupos[k] ??= {})[url || ''] ??= {n: 0, sans: []});
    e.n++; e.sans.push(san);
  };
  // a linha mais jogada: a cada lance segue o mais frequente entre as partidas que chegaram até ali.
  // Prefixo comum não serve — a mesma abertura chega por ordens diferentes (transposição) e colapsa em 1-2 lances.
  const linhaPrincipal = sans => {
    const saida = [];
    let restantes = sans;
    for (let i = 0; i < 12 && restantes.length; i++) {
      const cont = {};
      for (const a of restantes) if (a[i]) cont[a[i]] = (cont[a[i]] || 0) + 1;
      const top = Object.entries(cont).sort((x, y) => y[1] - x[1])[0];
      if (!top) break;
      saida.push(top[0]);
      restantes = restantes.filter(a => a[i] === top[0]);
    }
    return saida;
  };
  // o slug do Chess.com termina nos lances que nomeiam a variante ("...-3...Qa5" = até o 3º das pretas),
  // e é até aí que a posição ainda define a abertura. Sem esses números, 5 meias; teto de 8 para não virar meio-jogo.
  const profundidade = url => {
    const n = [...decodeURIComponent(url || '').matchAll(/(\d+)(\.\.\.|\.)/g)];
    if (!n.length) return 5;
    const u = n[n.length - 1];
    return +u[1] * 2 - (u[2] === '.' ? 1 : 0);
  };
  const melhorSeq = k => {
    const g = grupos[k];
    if (!g) return null;
    const [url, e] = Object.entries(g).sort((a, b) => b[1].n - a[1].n)[0];
    return {url, san: linhaPrincipal(e.sans).slice(0, Math.min(profundidade(url), 8))};
  };
  for (const x of L) {
    const pg = parsePGN(x.g);
    const chaveVar = `${pg.variante}${pg.eco ? ` <small>${pg.eco}</small>` : ''}`;
    registra(pg.familia, pg.url, pg.san); registra(chaveVar, pg.url, pg.san);
    conta(x.branco ? abB : abP, pg.familia, x.r);
    conta(variantes, chaveVar, x.r);
    conta(faixaEco, /^[A-E]/.test(pg.eco) ? pg.eco[0] : '?', x.r);
    if (x.branco) { if (pg.primeiro) conta(meuPrimeiro, `1. ${pg.primeiro}`, x.r); }
    else if (pg.primeiro) { conta(primeiroAdv, `1. ${pg.primeiro}`, x.r); if (pg.resposta) conta(minhaResposta, `1. ${pg.primeiro} ${pg.resposta}`, x.r); }
  }
  const n = s => s.w + s.d + s.l, ap = s => (s.w + s.d/2) / n(s);
  const topN = (obj, k=8) => Object.entries(obj).sort((a,b) => n(b[1]) - n(a[1])).slice(0, k).map(([k,s]) => linha(k, s)).join('') || vazio;
  const comLink = (k, flip) => {
    const m = melhorSeq(k), u = m?.url || '', p = m?.san || [];
    return `<a class="ab"${u ? ` href="${escHtml(u)}"` : ''} data-nome="${escHtml(k.replace(/<[^>]+>/g, '').trim())}" data-lances="${escHtml(p.join(' '))}"${flip ? ' data-flip="1"' : ''} title="Ver a posição no tabuleiro">${k}</a>`;
  };
  const linhaAb = (flip) => ([k, s]) => linha(comLink(k, flip), s);
  const topAb = (obj, flip, k=8) => Object.entries(obj).sort((a,b) => n(b[1]) - n(a[1])).slice(0, k).map(linhaAb(flip)).join('') || vazio;
  const piores = Object.entries(variantes).filter(([,s]) => n(s) >= 3).sort((a,b) => ap(a[1]) - ap(b[1])).slice(0, 8).map(linhaAb(false)).join('') || '<small>Precisa de ao menos 3 partidas por abertura</small>';
  const melhores = Object.entries(variantes).filter(([,s]) => n(s) >= 3).sort((a,b) => ap(b[1]) - ap(a[1])).slice(0, 8).map(linhaAb(false)).join('') || '<small>Precisa de ao menos 3 partidas por abertura</small>';
  // largura = volume, cor = aproveitamento (mesma convenção do mapa de calor)
  const ECO_FAIXA = {A: 'irregulares e de flanco', B: '1.e4 sem 1…e5', C: '1.e4 e5 e Francesa', D: '1.d4 d5', E: 'Índias com 1.d4 Cf6 2.c4 e6', '?': 'sem código'};
  const faixasUsadas = ['A','B','C','D','E','?'].filter(k => faixaEco[k]);
  const distEco = faixasUsadas.length < 2 ? '' :
    (() => {
      const totalEco = faixasUsadas.reduce((t, k) => t + n(faixaEco[k]), 0);
      return `<div class="distBar">${faixasUsadas.map(k => {
        const s = faixaEco[k], q = n(s), a = ap(s), alfa = (0.55 + 0.45 * Math.min(1, Math.abs(a - 0.5) * 4)).toFixed(2);
        return `<span style="flex:${q};background:var(--${a >= 0.5 ? 'win' : 'loss'});opacity:${alfa}" title="${k} · ${q} partida${q > 1 ? 's' : ''} · ${Math.round(a * 100)}% de aproveitamento">${q / totalEco >= 0.06 ? k : ''}</span>`;
      }).join('')}</div>`;
    })() + tabela(faixasUsadas.map(k => linha(`${k} <small>${ECO_FAIXA[k]}</small>`, faixaEco[k])).join(''));

  const aberturas = [
    card('De brancas', tabela(topAb(abB, false)), 'span2'),
    card('De pretas', tabela(topAb(abP, true)), 'span2'),
    card('Melhores variantes <small>(mín. 3 partidas)</small>', tabela(melhores), 'span2'),
    card('Piores variantes <small>(mín. 3 partidas)</small>', tabela(piores), 'span2'),
    distEco ? card('Distribuição por código ECO', distEco, 'span2') : '',
    card('Seu 1º lance de brancas', tabela(topN(meuPrimeiro, 5))),
    card('1º lance do adversário', tabela(topN(primeiroAdv, 5))),
    card('Sua resposta de pretas', tabela(topN(minhaResposta, 6)), 'span2'),
  ].join('');
  return {html: aberturas, variantes};
}

function secaoLances(L, {cardControle, cardTimeout}){
  // ---- Lances e relógio (PGN)
  const fase = {}, lancesArr = [], porLances = {};
  let curta = null, longa = null;
  const relogio = [], relogioAdv = [], relogioDerrota = [], fracDerrota = [];
  let maisTempo = {w:0,d:0,l:0}, menosTempo = {w:0,d:0,l:0}, derrotasSem10s = 0, timeoutsAdv = 0;
  for (const x of L) {
    const pg = parsePGN(x.g);
    if (!pg.meias) continue;
    lancesArr.push(pg.lances);
    if (!curta || pg.lances < curta.pg.lances) curta = {pg, x};
    if (!longa || pg.lances > longa.pg.lances) longa = {pg, x};
    conta(fase, pg.lances <= 15 ? 'Abertura (até 15)' : pg.lances <= 40 ? 'Meio-jogo (16–40)' : 'Final (41+)', x.r);
    conta(porLances, pg.lances <= 20 ? 'até 20' : pg.lances <= 30 ? '21–30' : pg.lances <= 40 ? '31–40' : pg.lances <= 60 ? '41–60' : '61+', x.r);
    if (pg.clks.length >= 2 && x.tc !== 'daily') {
      const meus = pg.clks.filter((_, i) => i % 2 === (x.branco ? 0 : 1)), dele = pg.clks.filter((_, i) => i % 2 === (x.branco ? 1 : 0));
      const meu = meus[meus.length-1], seu = dele[dele.length-1];
      if (meu == null || seu == null) continue;
      relogio.push(meu); relogioAdv.push(seu);
      const base = Number(String(x.g.time_control).split('+')[0]);
      if (x.r === 'l') { relogioDerrota.push(meu); if (meu < 10) derrotasSem10s++; if (base) fracDerrota.push(meu / base); }
      if (x.r === 'w' && x.adv.result === 'timeout') timeoutsAdv++;
      (meu > seu ? maisTempo : menosTempo)[x.r]++;
    }
  }
  const lancesHtml = [
    card('Lances', tabela(kv('Média por partida', media(lancesArr)) + kv('Mais curta', curta ? `${curta.pg.lances} <small>vs ${curta.x.adv.username}</small>` : '–') + kv('Mais longa', longa ? `${longa.pg.lances} <small>vs ${longa.x.adv.username}</small>` : '–'))),
    card('Fase em que termina', tabela(ordem(fase, ['Abertura (até 15)','Meio-jogo (16–40)','Final (41+)']))),
    card('Por duração', tabela(ordem(porLances, ['até 20','21–30','31–40','41–60','61+'])), 'span2'),
    card('Relógio ao final', relogio.length ? tabela(kv('Seu tempo restante (média)', seg(relogio.reduce((a,b)=>a+b,0)/relogio.length)) + kv('Do adversário (média)', seg(relogioAdv.reduce((a,b)=>a+b,0)/relogioAdv.length)) + kv('Restante nas derrotas (média)', relogioDerrota.length ? seg(relogioDerrota.reduce((a,b)=>a+b,0)/relogioDerrota.length) : '–') + kv('Derrotas com menos de 10 s', derrotasSem10s) + kv('Vitórias por tempo do adversário', timeoutsAdv)) : vazio, 'span2'),
    card('Quem tinha mais tempo', relogio.length ? tabela(linha('Você terminou com mais', maisTempo) + linha('Adversário com mais', menosTempo)) : vazio, 'span2'),
    cardControle,
    cardTimeout,
  ].join('');
  return {html: lancesHtml, fase, fracDerrota};
}

// heurísticas com amostra mínima; recebem só os dados que as seções exportaram
function achadosAutomaticos({L, sessoes, cor, faixa, perdeu, curva, A, melhorPerdeu, errosMotor, periodo, dia, pos2Derrotas, maxL, porPos, parouApos, variantes, fase, fracDerrota}){
  const n = somaWDL, ap = aprov;
  // ---- Análise automática
  const total = L.length, apGeral = ap({w: L.filter(x => x.r==='w').length, d: L.filter(x => x.r==='d').length, l: L.filter(x => x.r==='l').length});
  const ratingAtual = [...L].reverse().find(x => x.g.rated)?.eu.rating ?? 0;
  const amador = ratingAtual < 1800;
  const pp = x => `${Math.round(x * 100)}%`;
  const ach = [];
  const add = (tipo, titulo, texto) => ach.push({tipo, titulo, texto});
  const dif = (a, b) => Math.abs(ap(a) - ap(b));
  if (cor.Brancas && cor.Pretas && n(cor.Brancas) >= 20 && n(cor.Pretas) >= 20 && dif(cor.Brancas, cor.Pretas) >= 0.08) {
    const [m, p] = ap(cor.Brancas) > ap(cor.Pretas) ? ['brancas', 'pretas'] : ['pretas', 'brancas'];
    add('atencao', 'Diferença entre as cores', `Você rende bem mais de ${m} (${pp(ap(cor[m === 'brancas' ? 'Brancas' : 'Pretas']))}) do que de ${p} (${pp(ap(cor[p === 'brancas' ? 'Brancas' : 'Pretas']))}). Vale revisar o repertório de ${p}.`);
  }
  if (n(pos2Derrotas) >= 10 && ap(pos2Derrotas) < apGeral - 0.10) add('alerta', 'Tilt', `Depois de duas derrotas seguidas seu aproveitamento cai para ${pp(ap(pos2Derrotas))} (geral: ${pp(apGeral)}). Parar após a segunda derrota da sessão tende a preservar rating.`);
  else if (n(pos2Derrotas) >= 10 && ap(pos2Derrotas) > apGeral + 0.05) add('bom', 'Reação a derrotas', `Após duas derrotas seguidas você rende ${pp(ap(pos2Derrotas))}, acima da média. As derrotas não desestabilizam.`);
  if (porPos['6ª+'] && n(porPos['6ª+']) >= 10 && porPos['1ª da sessão'] && ap(porPos['6ª+']) < ap(porPos['1ª da sessão']) - 0.10) add('alerta', 'Sessões longas', `Da 6ª partida em diante seu aproveitamento é ${pp(ap(porPos['6ª+']))}, contra ${pp(ap(porPos['1ª da sessão']))} na primeira. Sessões mais curtas devem render mais.`);
  const totalDerrotas = Object.values(perdeu).reduce((a,b) => a+b, 0);
  if (totalDerrotas >= 15 && (perdeu.resigned || 0) > (perdeu.checkmated || 0) * 1.5) add(amador ? 'atencao' : 'info', 'Desiste muito', `${pp((perdeu.resigned||0) / totalDerrotas)} das derrotas são por desistência, contra ${pp((perdeu.checkmated||0) / totalDerrotas)} por mate.${amador ? ' Em xadrez amador o adversário erra com frequência na conversão: jogar até o fim costuma recuperar pontos.' : ' Nesse nível é o esperado; vale só conferir se alguma desistência foi precipitada.'}`);
  if (totalDerrotas >= 15 && (perdeu.timeout || 0) / totalDerrotas >= 0.15) add('alerta', 'Derrotas por tempo', `${pp((perdeu.timeout||0) / totalDerrotas)} das derrotas são por tempo. Vale acompanhar o relógio na aba "Lances e relógio".`);
  if (fracDerrota.length >= 10 && media(fracDerrota) >= 0.4) add('atencao', 'Perde com tempo sobrando', `Nas derrotas você termina em média com ${pp(+media(fracDerrota))} do tempo inicial no relógio.${amador ? ' Está jogando rápido demais nas posições difíceis: usar mais o relógio é de graça.' : ' Pode indicar desistências cedo em posições perdidas ou decisões rápidas demais nos momentos críticos.'}`);
  const melhorPior = (obj, nome, min=15, minDif=0.15) => {
    const e = Object.entries(obj).filter(([,s]) => n(s) >= min);
    if (e.length < 2) return;
    e.sort((a,b) => ap(b[1]) - ap(a[1]));
    const [mk, ms] = e[0], [pk, ps] = e[e.length-1];
    if (ap(ms) - ap(ps) >= minDif) add('info', nome, `Melhor: ${mk} (${pp(ap(ms))}, ${n(ms)} partidas). Pior: ${pk} (${pp(ap(ps))}, ${n(ps)} partidas).`);
  };
  melhorPior(periodo, 'Período do dia');
  melhorPior(dia, 'Dia da semana');
  const minAb = total >= 300 ? 15 : total >= 150 ? 10 : 5;
  const variantesValidas = Object.entries(variantes).filter(([,s]) => n(s) >= minAb);
  const piorVar = variantesValidas.sort((a,b) => ap(a[1]) - ap(b[1]))[0];
  if (piorVar && ap(piorVar[1]) <= 0.35) add('alerta', 'Abertura problemática', `${piorVar[0].replace(/<[^>]+>/g, '')}: ${pp(ap(piorVar[1]))} em ${n(piorVar[1])} partidas. É a candidata a estudar ou trocar.`);
  const melhorVar = variantesValidas.sort((a,b) => ap(b[1]) - ap(a[1]))[0];
  if (melhorVar && ap(melhorVar[1]) >= 0.65) add('bom', 'Abertura forte', `${melhorVar[0].replace(/<[^>]+>/g, '')}: ${pp(ap(melhorVar[1]))} em ${n(melhorVar[1])} partidas. Vale buscar mais.`);
  if (A.length >= 20 && melhorPerdeu >= 5 && melhorPerdeu / Math.max(1, A.filter(x => x.r==='l').length) >= 0.25) add('atencao', 'Converte mal', `Em ${melhorPerdeu} derrotas analisadas você jogou com mais precisão que o adversário e mesmo assim perdeu. O problema tende a ser um único erro grave no fim, não a qualidade geral do jogo.`);
  for (const [tc, v] of Object.entries(curva)) {
    if (v.length < 20) continue;
    const meio = Math.floor(v.length / 2);
    const m1 = v.slice(0, meio).reduce((a,b)=>a+b,0)/meio, m2 = v.slice(meio).reduce((a,b)=>a+b,0)/(v.length-meio);
    if (m2 - m1 >= 20) add('bom', `Tendência de alta (${TIPO[tc]})`, `A média da segunda metade do período (${Math.round(m2)}) está ${Math.round(m2-m1)} pontos acima da primeira (${Math.round(m1)}).`);
    else if (m1 - m2 >= 20) add('alerta', `Tendência de queda (${TIPO[tc]})`, `A média da segunda metade do período (${Math.round(m2)}) está ${Math.round(m1-m2)} pontos abaixo da primeira (${Math.round(m1)}).`);
  }
  if (fase['Final (41+)'] && n(fase['Final (41+)']) >= 15 && fase['Meio-jogo (16–40)'] && ap(fase['Final (41+)']) < ap(fase['Meio-jogo (16–40)']) - 0.10) add('atencao', 'Finais', `Partidas que chegam ao final rendem ${pp(ap(fase['Final (41+)']))}, contra ${pp(ap(fase['Meio-jogo (16–40)']))} das decididas no meio-jogo. Técnica de finais é o ponto a treinar.`);
  if (sessoes.length >= 10 && parouApos.l > parouApos.w * 1.5) add('info', 'Fim de sessão', `Você encerra a sessão após uma derrota ${parouApos.l} vezes e após vitória ${parouApos.w}. Um hábito comum é "só mais uma para recuperar", que raramente ajuda.`);
  if (faixa['Mais fraco'] && n(faixa['Mais fraco']) >= 15 && ap(faixa['Mais fraco']) < 0.55) add('atencao', 'Contra mais fracos', `Contra adversários com 25+ pontos a menos você faz só ${pp(ap(faixa['Mais fraco']))}. Deveria ser o grupo mais lucrativo.`);
  if (maxL >= 5) add('info', 'Pior série', `Sua maior sequência de derrotas foi ${maxL}. Sequências assim costumam concentrar-se em uma única sessão.`);
  const cmp = estado?.comp?.tc[aba];
  if (cmp && total >= 15 && cmp.n >= 15) {
    const antesRot = `no período anterior (${estado.comp.rotulo})`;
    const dAp = Math.round((apGeral - ap(cmp)) * 100);
    if (Math.abs(dAp) >= 8) add(dAp > 0 ? 'bom' : 'alerta', dAp > 0 ? 'Rendendo mais que antes' : 'Rendendo menos que antes', `Aproveitamento de ${pp(apGeral)} em ${total} partidas, contra ${pp(ap(cmp))} em ${cmp.n} ${antesRot}: ${sinal(dAp)} pontos percentuais.`);
    const vAgora = estado.antes[aba] == null ? null : estado.depois[aba] - estado.antes[aba];
    const vAntes = cmp.antes == null ? null : cmp.depois - cmp.antes;
    if (vAgora !== null && vAntes !== null && Math.abs(vAgora - vAntes) >= 25) add(vAgora > vAntes ? 'bom' : 'atencao', 'Rating vs. período anterior', `${sinal(vAgora)} de rating no período, contra ${sinal(vAntes)} ${antesRot}.`);
    if (A.length >= 10 && cmp.accN >= 10) {
      const accAgora = A.reduce((t, x) => t + x.acc, 0) / A.length, accAntes = cmp.acc / cmp.accN;
      if (Math.abs(accAgora - accAntes) >= 2) add(accAgora > accAntes ? 'bom' : 'atencao', 'Precisão vs. período anterior', `Precisão média de ${accAgora.toFixed(1)} agora, contra ${accAntes.toFixed(1)} ${antesRot}.`);
    }
    if (total >= cmp.n * 1.5 || cmp.n >= total * 1.5) add('info', 'Volume vs. período anterior', `${total} partidas no período, contra ${cmp.n} ${antesRot}. Com volumes tão diferentes, a comparação de aproveitamento é menos estável.`);
  }
  if (errosMotor) achadosErros(errosMotor, add);
  if (!ach.length) add('info', 'Nada fora do padrão', 'Com os dados do período não há desvio relevante em cor, horário, sessão, aberturas ou relógio.');
  const ICONE = {alerta: '▲', atencao: '●', bom: '✔', info: 'ℹ'}, PRIO = {alerta: 0, atencao: 1, bom: 2, info: 3};
  ach.sort((a, b) => PRIO[a.tipo] - PRIO[b.tipo]);
  const analise = ach.map(a => `<div class="kpi box achado ${a.tipo}"><h2><span class="icone">${ICONE[a.tipo]}</span> ${a.titulo}</h2><p>${a.texto}</p></div>`).join('');
  return analise;
}

function kpis(jogos, nick){
  const {L, sessoes} = prepararPartidas(jogos, nick);
  const resultados = secaoResultados(L), rating = secaoRating(L), precisao = secaoPrecisao(L, nick), ritmo = secaoRitmo(L);
  const volume = secaoVolume(L), sess = secaoSessoes(L, sessoes, ritmo), adversarios = secaoAdversarios(L), aberturas = secaoAberturas(L), lances = secaoLances(L, ritmo);
  const analise = achadosAutomaticos({L, sessoes, ...resultados, ...rating, ...precisao, ...ritmo, ...sess, ...aberturas, ...lances});
  return {
    'Análise': analise, 'Resultados': resultados.html, 'Rating': rating.html,
    'Aberturas': aberturas.html, 'Lances e relógio': lances.html, 'Erros e precisão': precisao.html,
    'Adversários': adversarios.html, 'Sessões': sess.html, 'Horários': ritmo.horarios, 'Volume': volume.html,
  };
}

$('abasKpi').addEventListener('change', e => { if (e.target.id === 'abasSel') { abaKpi = e.target.value; renderKpis(); sincronizarURL(); } });
$('abasKpi').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  abaKpi = b.dataset.aba;
  renderKpis(); sincronizarURL();
});

// o relatório tem vida própria: trocar de aba de evidência não pode refazer o bloco da IA (o campo da chave está nele)
function renderAnalise(){
  if (!kpiData) { renderBotaoDiag(); $('analiseCorpo').innerHTML = ''; return; }
  // a chave pode estar sendo digitada quando a atualização automática chega: guarda antes de refazer o bloco
  const digitada = $('iaChave')?.value.trim();
  if (digitada) gravarChave(provAtual(), digitada);
  $('analiseCorpo').innerHTML = blocoIA() + kpiData['Análise'];
  renderBotaoDiag();
}

function renderKpis(){
  if (!kpiData) return;
  if (kpiData[abaKpi] === undefined || abaKpi === 'Análise') abaKpi = 'Resultados';   // nome vindo da URL ou de versão antiga
  const GRUPOS = [['Visão geral', ['Resultados','Rating']], ['Como você joga', ['Aberturas','Lances e relógio','Erros e precisão']], ['Contexto', ['Adversários','Sessões','Horários','Volume']]];
  // no celular a barra vira um <select> com os grupos como optgroup (o CSS decide qual dos dois aparece)
  const sel = `<select id="abasSel" aria-label="Aba de indicadores">${GRUPOS.map(([nome, abas]) => `<optgroup label="${nome}">${abas.filter(k => kpiData[k] !== undefined).map(k => `<option value="${k}" ${k === abaKpi ? 'selected' : ''}>${k}</option>`).join('')}</optgroup>`).join('')}</select>`;
  $('abasKpi').innerHTML = sel + GRUPOS.map(([nome, abas]) => `<div class="grupoAbas"><span class="grupoAba">${nome}</span><div class="botoes">${abas.filter(k => kpiData[k] !== undefined).map(k => `<button type="button" role="tab" aria-selected="${k === abaKpi}" data-aba="${k}" class="${k === abaKpi ? 'ativa' : ''}">${k}</button>`).join('')}</div></div>`).join('');
  $('kpiGrid').innerHTML = kpiData[abaKpi];
}

// ---- diagnóstico: vive no modal, alcançado pelo botão da barra ----
// O botão leva o sinal do achado mais grave, senão o relatório — que é a promessa da tela inicial —
// viraria um botão neutro que ninguém clica.
const SINAIS = [['alerta', '▲'], ['atencao', '●'], ['bom', '✔'], ['info', 'ℹ']];
function renderBotaoDiag(){
  const b = $('btnDiag');
  b.hidden = !kpiData;
  if (!kpiData) return;
  const achados = [...$('analiseCorpo').querySelectorAll('.achado')];
  const [classe, sinal] = SINAIS.find(([c]) => achados.some(a => a.classList.contains(c))) || ['', ''];
  b.className = classe;
  b.innerHTML = `${sinal ? `<i class="sinal">${sinal}</i>` : ''}Diagnóstico${achados.length ? ` <small>${achados.length}</small>` : ''}`;
}
function analiseFullscreen(abrir){
  $('modalAnalise').classList.toggle('aberto', abrir);
  $('btnDiag').setAttribute('aria-expanded', abrir);
  (abrir ? $('anFechar') : $('btnDiag')).focus();
}
$('btnDiag').addEventListener('click', () => analiseFullscreen(true));
$('anFechar').addEventListener('click', () => analiseFullscreen(false));
$('modalAnalise').addEventListener('click', e => { if (e.target === $('modalAnalise')) analiseFullscreen(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('modalAnalise').classList.contains('aberto')) analiseFullscreen(false); });
