// Lista de partidas: paginação, filtro por adversário e CSV.
let filtro = '';
const filtroLista = () => filtro ? jogosAtuais.filter(g => (g.white.username.toLowerCase() === nickAtual ? g.black : g.white).username.toLowerCase().includes(filtro)) : jogosAtuais;
function renderLista(){
  const filtrados = filtroLista();
  const n = Number($('porPagina').value), total = filtrados.length, paginas = Math.max(1, Math.ceil(total / n));
  pagina = Math.min(Math.max(1, pagina), paginas);
  const ini = (pagina - 1) * n;
  const NOME_R = {w: 'vitória', d: 'empate', l: 'derrota'};
  $('lista').innerHTML = filtrados.slice(ini, ini + n).map(g => {
    const eu = g.white.username.toLowerCase() === nickAtual ? g.white : g.black;
    const adv = eu === g.white ? g.black : g.white;
    const r = eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l';
    return `<li><span class="pip ${r}" title="${NOME_R[r]}" aria-label="${NOME_R[r]}"></span>
      <span>${adv.username} <small>(${adv.rating}) · ${eu === g.white ? 'brancas' : 'pretas'} · ${MOTIVO[r === 'w' ? adv.result : eu.result] || ''}</small></span>
      <span class="meta">${g.delta === null ? '' : `<b class="${cls(g.delta)}">${sinal(g.delta)}</b> `}${g.rated ? eu.rating : 'amistosa'} · ${TIPO[g.time_class] || g.time_class}<br>${fmt.format(new Date(g.end_time*1000))} · <a href="${g.url}" target="_blank" rel="noopener">ver</a></span></li>`;
  }).join('');
  let extra = '';
  if (filtro && total) {
    const c = {w:0, d:0, l:0};
    for (const g of filtrados) { const eu = g.white.username.toLowerCase() === nickAtual ? g.white : g.black; c[eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l']++; }
    extra = ` · ${c.w}V ${c.d}E ${c.l}D`;
  }
  $('pagInfo').textContent = total ? `${ini + 1}–${Math.min(ini + n, total)} de ${total}${extra}` : (filtro ? 'nada com esse filtro' : '');
  rotuloLista(jogosAtuais.length);
  $('pagNum').textContent = `${pagina}/${paginas}`;
  $('pagAnt').disabled = pagina <= 1;
  $('pagProx').disabled = pagina >= paginas;
  $('lista').scrollTop = 0;
}
// no desktop a lista abre por padrão (tem coluna própria); abaixo de 1100 px começa recolhida,
// onde a página rola e 20 partidas abertas empurrariam o resto para fora da tela
const rotuloLista = n => { const aberta = document.body.classList.contains('listaAberta'); $('listaToggle').textContent = aberta ? 'Ocultar partidas ▴' : `Ver as ${n} partida${n === 1 ? '' : 's'} ▾`; $('listaToggle').setAttribute('aria-expanded', aberta); };
$('listaToggle').addEventListener('click', () => { document.body.classList.toggle('listaAberta'); rotuloLista(jogosAtuais.length); });
$('pagAnt').addEventListener('click', () => { pagina--; renderLista(); });
$('filtro').addEventListener('input', () => { filtro = $('filtro').value.trim().toLowerCase(); pagina = 1; renderLista(); });
$('csv').addEventListener('click', () => {
  const selecionadas = filtroLista();
  if (!selecionadas.length) return;
  const esc = v => { v = String(v ?? ''); if (/^[=+@]|^-[^\d]/.test(v)) v = "'" + v; return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const cab = ['data','hora','modalidade','controle','cor','adversario','rating_adversario','resultado','motivo','meu_rating','variacao','precisao','precisao_adversario','abertura','eco','lances','url'];
  const linhas = [...selecionadas].reverse().map(g => {
    const branco = g.white.username.toLowerCase() === nickAtual, eu = branco ? g.white : g.black, adv = branco ? g.black : g.white;
    const r = eu.result === 'win' ? 'vitoria' : DRAWS.has(eu.result) ? 'empate' : 'derrota';
    const pg = parsePGN(g), dt = new Date(g.end_time * 1000);
    return [dt.toLocaleDateString('pt-BR'), dt.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), TIPO[g.time_class] || g.time_class, controle(g.time_control), branco ? 'brancas' : 'pretas',
      adv.username, adv.rating, r, MOTIVO[r === 'vitoria' ? adv.result : eu.result] || '', eu.rating, g.delta ?? '', g.accuracies?.[branco ? 'white' : 'black'] ?? '', g.accuracies?.[branco ? 'black' : 'white'] ?? '',
      pg.variante, pg.eco, pg.lances, g.url].map(esc).join(';');
  });
  const blob = new Blob(['\ufeff' + cab.join(';') + '\n' + linhas.join('\n')], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chesscom-${nickAtual}-${aba}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('pagProx').addEventListener('click', () => { pagina++; renderLista(); });
$('porPagina').addEventListener('change', () => { pagina = 1; renderLista(); });
