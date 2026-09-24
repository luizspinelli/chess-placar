const test = require('node:test'), assert = require('node:assert/strict');
const {elemento} = require('./_ambiente');
const perto = (a, b, tol = 3000) => Math.abs(a - b) <= tol;
const defPeriodo = v => { elemento('periodo').value = v; };

test('periodo(): atalhos relativos e de calendário', () => {
  const hoje = new Date(), y = hoje.getFullYear(), m = hoje.getMonth();
  defPeriodo('7d'); let [ini, fim] = periodo();
  assert.ok(perto(ini.getTime(), Date.now() - 7 * 864e5), 'Nd é rolling a partir de agora'); assert.equal(fim, null);
  defPeriodo('2w'); [ini] = periodo(); assert.ok(perto(ini.getTime(), Date.now() - 14 * 864e5));
  defPeriodo('3m'); [ini, fim] = periodo(); assert.equal(ini.getTime(), new Date(y, m - 2, 1).getTime(), 'Nm começa no dia 1º de N−1 meses atrás'); assert.equal(fim, null);
  defPeriodo('mes'); [ini] = periodo(); assert.equal(ini.getTime(), new Date(y, m, 1).getTime());
  defPeriodo('mes-1'); [ini, fim] = periodo(); assert.equal(ini.getTime(), new Date(y, m - 1, 1).getTime()); assert.equal(fim.getTime(), new Date(y, m, 1).getTime() - 1000, 'mês anterior inteiro, até o último segundo');
  defPeriodo('ano'); [ini] = periodo(); assert.equal(ini.getTime(), new Date(y, 0, 1).getTime());
});

test('periodo(): absoluto lê data/hora do formulário e sinaliza início em falta', () => {
  defPeriodo('custom'); elemento('data').value = '2026-09-08'; elemento('hora').value = '20:00'; elemento('dataFim').value = ''; elemento('horaFim').value = '';
  let [ini, fim] = periodo(); assert.equal(ini.getTime(), new Date('2026-09-08T20:00').getTime()); assert.equal(fim, null);
  elemento('dataFim').value = '2026-09-10'; elemento('horaFim').value = '';
  [, fim] = periodo(); assert.equal(fim.getTime(), new Date('2026-09-10T23:59:59').getTime(), 'fim sem hora vai até 23:59:59');
  elemento('data').value = ''; [ini] = periodo(); assert.ok(isNaN(ini), 'sem data de início não dá para buscar');
});

test('periodoAnterior(): bloco de calendário completo nos recortes de calendário, mesma duração nos rolling', () => {
  const y = 2026, m = 8; // setembro
  defPeriodo('mes'); let [a, b] = periodoAnterior(new Date(y, m, 1), null);
  assert.equal(a.getTime(), new Date(y, m - 1, 1).getTime()); assert.equal(b.getTime(), new Date(y, m, 1).getTime() - 1000);
  defPeriodo('3m'); [a] = periodoAnterior(new Date(y, m - 2, 1), null); assert.equal(a.getTime(), new Date(y, m - 5, 1).getTime(), '3m recua 3 meses inteiros');
  defPeriodo('4w'); const ini = new Date(2026, 8, 18, 19, 46); [a, b] = periodoAnterior(ini, null);
  assert.ok(perto(a.getTime(), ini.getTime() - (Date.now() - ini.getTime()), 5000), 'rolling: a mesma duração imediatamente antes'); assert.equal(b.getTime(), ini.getTime() - 1000);
  defPeriodo('custom'); [a, b] = periodoAnterior(new Date(2026, 8, 1), new Date(2026, 8, 11)); assert.equal(a.getTime(), new Date(2026, 7, 22).getTime());
});

test('recuaMes(): mantém o dia e cai para o último dia quando ele não existe', () => {
  assert.equal(recuaMes(new Date(2026, 2, 31), 1).getTime(), new Date(2026, 1, 28).getTime(), '31/03 − 1 mês = 28/02');
  assert.equal(recuaMes(new Date(2026, 4, 15), 12).getTime(), new Date(2025, 4, 15).getTime());
});

test('comparaAuto(): liga até ~190 dias, não no ano inteiro nem no absoluto', () => {
  for (const v of ['7d', '30d', '4w', '6m', 'mes', 'mes-1']) assert.equal(comparaAuto(v), true, v);
  for (const v of ['7m', '12m', 'ano', 'custom']) assert.equal(comparaAuto(v), false, v);
  assert.equal(duracaoEmDias('6m'), 180); assert.equal(duracaoEmDias('2w'), 14); assert.equal(duracaoEmDias('ano'), Infinity);
});

test('evolucaoDoPeriodo(): blocos na unidade do atalho, agrupamento acima de 12, nada com 1 bloco', () => {
  defPeriodo('4w'); const ini = new Date(Date.now() - 28 * 864e5);
  let e = evolucaoDoPeriodo(ini, null);
  assert.equal(e.titulo, 'semana a semana'); assert.equal(e.blocos.length, 4);
  assert.equal(e.blocos[0].ini, ini.getTime()); assert.equal(e.blocos[1].ini, ini.getTime() + 7 * 864e5);
  assert.ok(e.blocos[3].fim <= Date.now() + 1000, 'último bloco fecha em agora');
  assert.match(e.blocos[0].rotulo, /^\d\d\/\d\d – \d\d\/\d\d$/, 'rolling mostra o intervalo');
  defPeriodo('30d'); e = evolucaoDoPeriodo(new Date(Date.now() - 30 * 864e5), null);
  assert.equal(e.titulo, 'a cada 3 dias'); assert.equal(e.blocos.length, 10);
  defPeriodo('3m'); const hoje = new Date(), i3 = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  e = evolucaoDoPeriodo(i3, null);
  assert.equal(e.titulo, 'mês a mês'); assert.equal(e.blocos.length, 3); assert.equal(e.blocos[1].ini, new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getTime(), 'meses de calendário a partir do dia 1º');
  assert.match(e.blocos[0].rotulo, /^[a-z]{3}\/\d\d$/, 'mês fechado é "set/26"');
  defPeriodo('1d'); assert.equal(evolucaoDoPeriodo(new Date(Date.now() - 864e5), null), null);
  defPeriodo('ano'); assert.equal(evolucaoDoPeriodo(new Date(2026, 0, 1), null), null);
  defPeriodo('custom'); assert.equal(evolucaoDoPeriodo(new Date(2026, 0, 1), new Date(2026, 5, 1)), null);
});

test('rotuloPeriodo(): nome curto do período, com o gênero certo na unidade', () => {
  assert.equal(rotuloPeriodo('hoje'), 'hoje');
  assert.equal(rotuloPeriodo('mes'), 'este mês');
  assert.equal(rotuloPeriodo('mes-1'), 'mês passado');
  assert.equal(rotuloPeriodo('ano'), 'este ano');
  assert.equal(rotuloPeriodo('7d'), 'últimos 7 dias');
  assert.equal(rotuloPeriodo('2w'), 'últimas 2 semanas');
  assert.equal(rotuloPeriodo('3m'), 'últimos 3 meses');
  assert.equal(rotuloPeriodo('1d'), 'último dia');
  assert.equal(rotuloPeriodo('1w'), 'última semana');
  assert.equal(rotuloPeriodo('custom'), 'período escolhido');
});

test("periodo('hoje'): da meia-noite de hoje até agora", () => {
  $('periodo').value = 'hoje';
  const [ini, fim] = periodo(), agora = new Date();
  assert.equal(fim, null, 'sem fim: vale até agora');
  assert.equal(ini.getHours(), 0); assert.equal(ini.getMinutes(), 0);
  assert.equal(ini.getDate(), agora.getDate());
  assert.equal(ini.getMonth(), agora.getMonth());
  assert.equal(duracaoEmDias('hoje'), 1, 'conta como um dia: a comparação com ontem sai automática');
  assert.equal(comparaAuto('hoje'), true);
});

test("periodoAnterior('hoje'): ontem inteiro, como os outros atalhos de calendário", () => {
  $('periodo').value = 'hoje';
  const [ini] = periodo();
  const [a, z] = periodoAnterior(ini, null);
  assert.equal(a.getHours(), 0, 'começa na meia-noite de ontem');
  assert.equal(Math.round((ini - a) / 864e5), 1, 'recua exatamente um dia');
  assert.equal(z.getTime(), ini.getTime() - 1000, 'termina um segundo antes de hoje');
  assert.ok(z - a > 86e6, 'cobre o dia inteiro, não só as horas já decorridas de hoje');
});
