// Período analisado: leitura dos atalhos, comparação automática, período anterior e blocos de evolução.
$('data').value = new Date().toISOString().slice(0,10);

function periodo(){
  const p = $('periodo').value, hoje = new Date(), y = hoje.getFullYear(), m = hoje.getMonth();
  if (p === 'hoje') return [new Date(y, m, hoje.getDate()), null];
  if (p === 'mes') return [new Date(y, m, 1), null];
  if (p === 'mes-1') return [new Date(y, m-1, 1), new Date(y, m, 1, 0, 0, -1)];
  if (p === 'ano') return [new Date(y, 0, 1), null];
  const dias = p.match(/^(\d+)([dw])$/);
  if (dias) return [new Date(Date.now() - dias[1] * (dias[2] === 'w' ? 7 : 1) * 864e5), null];
  if (/^\d+m$/.test(p)) return [new Date(y, m - parseInt(p) + 1, 1), null];
  if (!$('data').value) return [NaN, null];
  const ini = new Date($('data').value + 'T' + ($('hora').value || '00:00'));
  const fim = $('dataFim').value ? new Date($('dataFim').value + 'T' + ($('horaFim').value || '23:59') + ':59') : null;
  return [ini, fim];
}
// nome curto do período para a barra de contexto ("últimas 2 semanas"); o rótulo com as datas é `estado.rotulo`
const UNI_PERIODO = {d: ['dia', 'dias', 'último', 'últimos'], w: ['semana', 'semanas', 'última', 'últimas'], m: ['mês', 'meses', 'último', 'últimos']};
function rotuloPeriodo(v = $('periodo').value){
  const FIXOS = {hoje: 'hoje', mes: 'este mês', 'mes-1': 'mês passado', ano: 'este ano'};
  if (FIXOS[v]) return FIXOS[v];
  const m = v.match(/^(\d+)([dwm])$/);
  if (!m) return 'período escolhido';
  const [s1, p1, a1, b1] = UNI_PERIODO[m[2]];
  return +m[1] === 1 ? `${a1} ${s1}` : `${b1} ${m[1]} ${p1}`;
}

let ultimoRelativo = 'ano', comparManual = false;
// o período vive num input escondido: os atalhos só escrevem nele e o resto do app segue lendo $('periodo').value
function aplicarPeriodo(v, sincronizar = true){
  if (!v) return;
  const custom = v === 'custom';
  $('periodo').value = v;
  if (!custom) ultimoRelativo = v;
  $('custom').hidden = !custom;
  $('relativo').hidden = custom;
  $('periodoTipo').querySelectorAll('button').forEach(b => b.classList.toggle('ativa', (b.dataset.tipo === 'absoluto') === custom));
  if (!comparManual) $('comparar').checked = comparaAuto(v);
  let atalho = false;
  $('relativo').querySelectorAll('.grade button').forEach(b => { const on = b.dataset.p === v; atalho ||= on; b.classList.toggle('ativa', on); });
  if (!sincronizar) return;
  const m = custom ? null : v.match(/^(\d+)([dwm])$/);
  $('pNum').value = m && !atalho ? m[1] : '';
  if (m) $('pUni').value = m[2];
}
$('comparar').addEventListener('change', () => { comparManual = true; });
$('periodoTipo').addEventListener('click', e => { const b = e.target.closest('button'); if (b) aplicarPeriodo(b.dataset.tipo === 'absoluto' ? 'custom' : ultimoRelativo); });
$('relativo').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) aplicarPeriodo(b.dataset.p); });
const periodoLivre = () => { const n = parseInt($('pNum').value); if (n > 0) aplicarPeriodo(n + $('pUni').value, false); };
$('pNum').addEventListener('input', periodoLivre);
$('pUni').addEventListener('change', periodoLivre);

// recua n meses mantendo o dia (28 de fevereiro quando o dia não existe no mês de destino)
const recuaMes = (d, n) => { const x = new Date(d), dia = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() - n); x.setDate(Math.min(dia, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
// período de comparação: nos recortes de calendário, o bloco completo anterior (mês em curso vs. mês anterior
// inteiro, não só o mesmo trecho dele); no personalizado e nos rolling, a mesma duração imediatamente antes
function periodoAnterior(ini, fim){
  const p = $('periodo').value, f = fim || new Date();
  const meses = p === 'mes' || p === 'mes-1' ? 1 : p === 'ano' ? 12 : /^\d+m$/.test(p) ? parseInt(p) : 0;
  return meses ? [recuaMes(ini, meses), new Date(ini.getTime() - 1000)] : [new Date(ini.getTime() - (f - ini)), new Date(ini.getTime() - 1000)];
}
// duração aproximada em dias, só para decidir se a comparação sai automática
const duracaoEmDias = v => { const m = v.match(/^(\d+)([dwm])$/); return m ? m[1] * (m[2] === 'w' ? 7 : m[2] === 'm' ? 30 : 1) : v === 'hoje' ? 1 : v === 'mes' || v === 'mes-1' ? 30 : Infinity; };
// em recorte relativo curto a comparação com o período anterior vem ligada; no ano inteiro não,
// porque seriam 12 arquivos mensais a mais só para o comparativo
const comparaAuto = v => duracaoEmDias(v) <= 190;
// quebra o período nos blocos da própria unidade (4w → 4 semanas, 3m → 3 meses, 5d → 5 dias) para
// mostrar a evolução dentro dele; acima de 12 blocos agrupa, senão a tabela vira ruído
function evolucaoDoPeriodo(ini, fim){
  const m = $('periodo').value.match(/^(\d+)([dwm])$/);
  if (!m) return null;
  const n = +m[1], uni = m[2];
  if (n < 2) return null;
  const passo = Math.ceil(n / 12), qtd = Math.ceil(n / passo), fimTs = (fim || new Date()).getTime(), blocos = [];
  for (let i = 0; i < qtd; i++) {
    const a = uni === 'm' ? new Date(ini.getFullYear(), ini.getMonth() + i * passo, 1) : new Date(ini.getTime() + i * passo * (uni === 'w' ? 7 : 1) * 864e5);
    if (a.getTime() >= fimTs) break;
    const z = uni === 'm' ? new Date(ini.getFullYear(), ini.getMonth() + (i + 1) * passo, 1) : new Date(a.getTime() + passo * (uni === 'w' ? 7 : 1) * 864e5);
    const fecha = Math.min(z.getTime(), fimTs);
    blocos.push({ini: a.getTime(), fim: fecha, rotulo: rotuloBloco(a, new Date(fecha - 1), uni, passo)});
  }
  const UNI = {d: ['dia a dia', 'dias'], w: ['semana a semana', 'semanas'], m: ['mês a mês', 'meses']};
  return blocos.length > 1 ? {titulo: passo === 1 ? UNI[uni][0] : `a cada ${passo} ${UNI[uni][1]}`, blocos} : null;
}
// um bloco de calendário fechado é o próprio mês; nos rolling o corte cai no meio do dia, então vale o intervalo
const rotuloBloco = (a, z, uni, passo) => uni === 'm'
  ? (passo === 1 ? chaveMes(a) : `${chaveMes(a)} – ${chaveMes(z)}`)
  : (fmtDiaMes.format(a) === fmtDiaMes.format(z) ? fmtDiaMes.format(a) : `${fmtDiaMes.format(a)} – ${fmtDiaMes.format(z)}`);
