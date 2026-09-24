// Bootstrap: tema, link compartilhável e leitura dos parâmetros de URL. Deve ser o último script.
const aplicarTema = t => {
  document.documentElement.dataset.tema = t;
  try { localStorage.setItem('placar-chesscom:tema', t); } catch {}
  $('tema').querySelectorAll('button').forEach(b => b.classList.toggle('ativa', b.dataset.tema === t));
  if ($('modal').classList.contains('aberto')) desenharModal();
  if (typeof renderKpis === 'function' && typeof kpiData !== 'undefined' && kpiData) renderKpis();
};
$('tema').addEventListener('click', e => { const b = e.target.closest('button'); if (b) aplicarTema(b.dataset.tema); });

// a barra de endereço acompanha busca e abas (replaceState: sem entradas novas no histórico), então F5 e o link copiado
// reproduzem o que está na tela; a restauração do armazém faz o resto
function sincronizarURL(){ try { history.replaceState(null, '', linkAtual()); } catch {} }
function linkAtual(){
  const u = new URL(location.href); u.search = '';
  const q = u.searchParams;
  if ($('nick').value.trim()) q.set('nick', $('nick').value.trim());
  q.set('periodo', $('periodo').value);
  if ($('periodo').value === 'custom') for (const k of ['data','hora','dataFim','horaFim']) if ($(k).value) q.set(k, $(k).value);
  q.set('tc', [...document.querySelectorAll('input[name=tc]:checked')].map(i => i.value).join(','));
  if ($('auto').checked) { q.set('auto', '1'); q.set('intervalo', $('intervalo').value); }
  if (!$('soHumanos').checked) q.set('bots', '1');
  if ($('comparar').checked) q.set('comparar', '1');
  else if (comparaAuto($('periodo').value)) q.set('comparar', '0');
  if (document.documentElement.dataset.tema === 'claro') q.set('tema', 'claro');
  // abas: só quando fogem do padrão, para o link continuar curto
  if (estado && new Set(estado.jogos.map(g => g.time_class)).size > 1) q.set('aba', aba);
  if (abaKpi !== 'Resultados') q.set('kpi', abaKpi);
  return u.toString();
}
$('btnLink').addEventListener('click', async () => {
  const link = linkAtual(), status = $('status');
  try { await navigator.clipboard.writeText(link); status.className = ''; status.textContent = 'Link copiado.'; }
  catch { status.className = ''; status.textContent = link; }
});


// ---- dica por toque: `title` só aparece com mouse. No celular, o "?" do glossário, as células do mapa de calor
// e os ▲/▼ do comparativo mostram o texto num balão ao toque (no desktop o hover continua funcionando).
{
  const dica = $('dica'), esconder = () => { dica.hidden = true; };
  document.addEventListener('click', e => {
    const alvo = e.target.closest('.ajuda, .heat i[title], #comparativo i[title], #rpct[title]');
    if (!alvo || !alvo.title) { if (!dica.hidden) esconder(); return; }
    e.preventDefault();
    dica.textContent = alvo.title; dica.hidden = false;
    const r = alvo.getBoundingClientRect(), largura = Math.min(340, innerWidth - 24);
    dica.style.width = `${largura}px`;
    dica.style.left = `${Math.max(12, Math.min(innerWidth - largura - 12, r.left + r.width / 2 - largura / 2))}px`;
    dica.style.top = `${r.bottom + 8 + scrollY}px`;
  });
  addEventListener('scroll', esconder, {passive: true});
  document.addEventListener('keydown', e => { if (e.key === 'Escape') esconder(); });
}

// ---- parâmetros de URL (para favoritos e links compartilháveis)
// ?nick=x&periodo=mes|mes-1|3m|6m|12m|ano|custom&data=YYYY-MM-DD&hora=HH:MM&dataFim=&horaFim=&tc=rapid,blitz&auto=1&intervalo=60&kpi=Aberturas&tema=claro|escuro
{
  const q = new URLSearchParams(location.search);
  let tema = q.get('tema'); try { tema = tema || localStorage.getItem('placar-chesscom:tema'); } catch {}
  aplicarTema(tema === 'claro' ? 'claro' : 'escuro');
  if (q.get('nick')) $('nick').value = q.get('nick');
  aplicarPeriodo(q.get('periodo') || 'ano');
  for (const k of ['data','hora','dataFim','horaFim']) if (q.get(k)) $(k).value = q.get(k);
  if (q.get('tc')) { const tcs = q.get('tc').split(','); document.querySelectorAll('input[name=tc]').forEach(i => i.checked = tcs.includes(i.value)); }
  if (q.get('intervalo')) $('intervalo').value = q.get('intervalo');
  if (q.get('bots') === '1') $('soHumanos').checked = false;
  if (q.has('comparar')) { $('comparar').checked = q.get('comparar') === '1'; comparManual = true; }
  if (q.get('aba') && TIPO[q.get('aba')]) aba = q.get('aba');
  if (q.get('kpi')) abaKpi = q.get('kpi');   // renderKpis() volta para Resultados se o nome não existir
  if (q.get('auto') === '1') $('auto').checked = true;
  // a coluna de partidas cabe no painel do desktop; no celular a lista empurraria o resto para fora da tela
  const ajustaLista = () => document.body.classList.toggle('listaAberta', innerWidth > 1100);
  ajustaLista(); addEventListener('resize', ajustaLista);
  if (q.get('nick')) buscar(false);
  else { document.body.classList.add('inicio'); $('nickInicio').value = $('nick').value; }
}
