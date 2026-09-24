// Análise com IA: provedores, chaves, prompts (indicadores e dossiê de partidas), chamada com fallback e exportação em PDF.
// o header dangerous-direct-browser-access libera CORS para chamadas feitas do navegador
// SSE (text/event-stream): separa o buffer em eventos completos e devolve o resto ainda incompleto. Puro, para o teste.
function parseSSE(buffer){
  const partes = buffer.split(/\r?\n\r?\n/), resto = partes.pop(), eventos = [];
  for (const bloco of partes) {
    let event = 'message', data = '';
    for (const l of bloco.split(/\r?\n/)) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) data += (data ? '\n' : '') + l.slice(5).trim(); }
    if (!data) continue;
    let json = null; try { json = JSON.parse(data); } catch {}
    eventos.push({event, data, json});
  }
  return {eventos, resto};
}
// lê a resposta em streaming e chama aoEvento para cada evento. Os provedores respondem em streaming porque a
// resposta completa de um modelo que raciocina leva minutos, e conexões paradas por tanto tempo são cortadas por
// proxies, VPNs e redes móveis — no navegador isso vira um "Failed to fetch" sem mais explicação.
let INATIVIDADE_SSE = 180000;   // 3 min sem nenhum byte da API = conexão morta; a Anthropic manda ping durante o raciocínio
async function lerSSE(r, aoEvento, controle){
  const reader = r.body.getReader(), dec = new TextDecoder(); let buffer = '', vigia = null;
  const armar = () => { clearTimeout(vigia); vigia = setTimeout(() => controle?.abort(new Error(`a API ficou ${Math.round(INATIVIDADE_SSE / 60000)} min sem enviar dados`)), INATIVIDADE_SSE); };
  try {
    for (;;) {
      armar();
      const {value, done} = await reader.read();
      buffer += done ? '' : dec.decode(value, {stream: true});
      const {eventos, resto} = parseSSE(done ? buffer + '\n\n' : buffer); buffer = resto;
      for (const ev of eventos) aoEvento(ev);
      if (done) return;
    }
  } finally { clearTimeout(vigia); }
}
// fetch com o vigia de inatividade: o AbortController é o que interrompe a leitura quando o servidor some
const fetchSSE = (url, opts) => { const controle = new AbortController(); return fetch(url, {...opts, signal: controle.signal}).then(r => ({r, controle})); };
// esforço de raciocínio do Claude: 'medium' por padrão — a tarefa é organizar números já agregados, e o médio mantém a qualidade
// gastando bem menos tempo pensando; "raciocínio profundo" volta ao 'high'. Só nos modelos que aceitam output_config.effort
// (Opus 5, Sonnet 5, Opus 4.6+, Sonnet 4.6, Fable): nos demais o parâmetro daria 400.
const iaProfunda = () => lerLS('placar-chesscom:iaProfunda', '0') === '1';
const suportaEsforco = m => /claude-(opus|sonnet)-5|claude-opus-4-[678]|claude-sonnet-4-6|fable|mythos/.test(m);
const cabAnthropic = chave => ({'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'});
const PROVEDORES = {
  gemini: {
    nome: 'Gemini', link: 'https://aistudio.google.com/apikey', gratis: true,
    padrao: 'gemini-flash-latest',
    reserva: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview'],
    filtro: m => /flash/i.test(m) && !/image|tts|live|audio|embedding/i.test(m),
    async listar(chave){
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {headers: {'x-goog-api-key': chave}});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || `Erro ${r.status}`);
      return (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name)).map(m => m.name.replace(/^models\//, ''));
    },
    async chamar(chave, modelo, prompt){
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': chave},
        body: JSON.stringify({contents: [{parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: 4096, temperature: 0.4}})
      });
      const d = await r.json().catch(() => ({}));
      return {ok: r.ok, status: r.status, erro: d.error?.message, texto: (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')};
    }
  },
  groq: {
    nome: 'Groq', link: 'https://console.groq.com/keys', gratis: true,
    padrao: 'openai/gpt-oss-120b',
    reserva: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    filtro: m => !/whisper|guard|tts|safeguard|allam/i.test(m),
    async listar(chave){
      const r = await fetch('https://api.groq.com/openai/v1/models', {headers: {'Authorization': `Bearer ${chave}`}});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || `Erro ${r.status}`);
      return (d.data || []).filter(m => m.active !== false).map(m => m.id);
    },
    async chamar(chave, modelo, prompt){
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${chave}`},
        body: JSON.stringify({model: modelo, messages: [{role: 'user', content: prompt}], temperature: 0.4, max_tokens: 4096})
      });
      const d = await r.json().catch(() => ({}));
      return {ok: r.ok, status: r.status, erro: d.error?.message, texto: d.choices?.[0]?.message?.content || ''};
    }
  },
  anthropic: {
    nome: 'Claude', link: 'https://console.anthropic.com/settings/keys',
    padrao: 'claude-opus-5',
    reserva: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
    filtro: m => /^claude/.test(m),
    async listar(chave){
      const r = await fetch('https://api.anthropic.com/v1/models?limit=100', {headers: cabAnthropic(chave)});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || `Erro ${r.status}`);
      return (d.data || []).map(m => m.id);
    },
    // sem temperature nem thinking: os modelos atuais rejeitam sampling e o seletor aceita modelos de qualquer geração
    async chamar(chave, modelo, prompt, aoProgresso){
      const {r, controle} = await fetchSSE('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: {'Content-Type': 'application/json', ...cabAnthropic(chave)},
        body: JSON.stringify({model: modelo, max_tokens: 16000, stream: true, messages: [{role: 'user', content: prompt}], ...(suportaEsforco(modelo) ? {output_config: {effort: iaProfunda() ? 'high' : 'medium'}} : {})})
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return {ok: false, status: r.status, erro: d.error?.message}; }
      let texto = '', parada = null, erro = null;
      aoProgresso?.('conectado', 0);
      // os modelos atuais raciocinam antes de escrever: os blocos "thinking" chegam vazios (e pings no meio), e só depois vem o texto
      await lerSSE(r, ({json}) => {
        if (!json) return;
        if (json.type === 'content_block_start' && json.content_block?.type === 'thinking') aoProgresso?.('raciocinando', 0);
        else if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') { texto += json.delta.text; aoProgresso?.('respondendo', texto.length, texto); }
        else if (json.type === 'message_delta') parada = json.delta?.stop_reason || parada;
        else if (json.type === 'error') erro = json.error?.message || 'erro no streaming';
      }, controle);
      if (parada === 'refusal') return {ok: false, status: r.status, erro: 'O modelo recusou a solicitação. Tente outro modelo.'};
      if (erro) return {ok: false, status: 500, erro};
      return {ok: true, status: r.status, texto};
    }
  },
  openai: {
    nome: 'OpenAI', link: 'https://platform.openai.com/api-keys',
    padrao: 'gpt-5.1',
    reserva: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1'],
    filtro: m => /^(gpt|o[1-9])/.test(m) && !/audio|realtime|image|tts|whisper|embedding|moderation|transcribe|search|codex|dall/i.test(m),
    async listar(chave){
      const r = await fetch('https://api.openai.com/v1/models', {headers: {'Authorization': `Bearer ${chave}`}});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || `Erro ${r.status}`);
      return (d.data || []).map(m => m.id);
    },
    // max_completion_tokens e sem temperature: os modelos de raciocínio rejeitam max_tokens e sampling
    async chamar(chave, modelo, prompt, aoProgresso){
      const {r, controle} = await fetchSSE('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${chave}`},
        body: JSON.stringify({model: modelo, messages: [{role: 'user', content: prompt}], max_completion_tokens: 16000, stream: true})
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return {ok: false, status: r.status, erro: d.error?.message}; }
      let texto = '', erro = null;
      aoProgresso?.('conectado', 0);
      await lerSSE(r, ({data, json}) => {
        if (data === '[DONE]' || !json) return;
        if (json.error) erro = json.error.message || 'erro no streaming';
        const t = json.choices?.[0]?.delta?.content; if (t) { texto += t; aoProgresso?.('respondendo', texto.length, texto); }
      }, controle);
      if (erro) return {ok: false, status: 500, erro};
      return {ok: true, status: r.status, texto};
    }
  }
};
const provAtual = () => lerLS('placar-chesscom:provedor', 'gemini');
const chaveLS = p => `placar-chesscom:chave:${p}`, modeloLS = p => `placar-chesscom:modelo:${p}`;
const modelosIA = {}, modelosCarregados = {};
for (const p in PROVEDORES) {
  modelosIA[p] = [...PROVEDORES[p].reserva];
  if (!PROVEDORES[p].reserva.includes(lerLS(modeloLS(p), PROVEDORES[p].padrao))) gravarLS(modeloLS(p), PROVEDORES[p].padrao);
}
if (lerLS('placar-chesscom:gemini')) { gravarLS(chaveLS('gemini'), lerLS('placar-chesscom:gemini')); try { localStorage.removeItem('placar-chesscom:gemini'); } catch {} }

// com "lembrar" desmarcado a chave vive só nesta aba: some ao fechar, e não fica no
// navegador de máquina compartilhada. Não protege contra XSS — nada no cliente protege.
const chavesMemoria = {};
const lembrarChave = () => lerLS('placar-chesscom:lembrarChave', '1') === '1';
const lerChave = p => chavesMemoria[p] ?? lerLS(chaveLS(p));
const gravarChave = (p, v) => { chavesMemoria[p] = v; if (lembrarChave()) gravarLS(chaveLS(p), v); };
const esquecerChaves = () => { for (const p in PROVEDORES) try { localStorage.removeItem(chaveLS(p)); } catch {} };

// a aba Análise abre com uma barra de ação (Analisar · PDF · "Gemini · modelo · motor 65/65") e a configuração
// recolhida; ela só vem aberta enquanto não há chave salva, ou quando o usuário clica em Configurar.
let iaCfgAberta = null;   // null = automático (aberta só sem chave); true/false depois que o usuário decide
function blocoIA(){
  const p = provAtual(), P = PROVEDORES[p];
  const chave = lerChave(p), modelo = lerLS(modeloLS(p), P.padrao);
  const aberta = iaCfgAberta ?? !chave;
  const resumoCfg = [`${P.nome} · ${modelo}`, typeof motorResumo === 'function' ? motorResumo() : ''].filter(Boolean).join(' · ');
  return `<div class="kpi box ia" id="cardIA">
    <div class="acao">
      <button type="button" id="iaAnalisar" title="Avalia as partidas pendentes com o motor (quando disponível) e envia à IA os indicadores do período e o dossiê das últimas partidas (tamanho em configurar)" ${iaOcupado ? 'disabled' : ''}>${iaOcupado ? 'Analisando…' : 'Analisar'}</button>
      <button type="button" id="iaPdf" class="secundario" title="Abre a janela de impressão; escolha 'Salvar como PDF'">Exportar PDF</button>
      <span class="resumoCfg">${escHtml(resumoCfg)}</span>
      <button type="button" id="iaCfgToggle" class="link" aria-expanded="${aberta}" aria-controls="iaCfg">${aberta ? 'ocultar configuração' : 'configurar'}</button>
    </div>
    <div class="cfg" id="iaCfg" ${aberta ? '' : 'hidden'}>
      <select id="iaProv" class="modelo">${Object.entries(PROVEDORES).map(([k, v]) => `<option value="${k}" ${k === p ? 'selected' : ''}>${v.nome}</option>`).join('')}</select>
      <input id="iaChave" type="password" placeholder="Chave da API (${P.nome})" value="${chave.replace(/"/g,'&quot;')}" autocomplete="off">
      <select id="iaModelo" class="modelo">${[...new Set([modelo, ...modelosIA[p]])].map(m => `<option value="${m}" ${m === modelo ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button type="button" id="iaModelos" class="secundario" title="Buscar modelos disponíveis na sua chave" aria-label="Buscar modelos disponíveis" ${iaOcupado ? 'disabled' : ''}>↻</button>
      <label class="lembrar" title="Desmarcado, a chave vale só nesta aba e não fica gravada no navegador"><input type="checkbox" id="iaLembrar" ${lembrarChave() ? 'checked' : ''}>lembrar chave</label>
      <small class="explica"><a href="${P.link}" target="_blank" rel="noopener">criar chave${P.gratis ? ' gratuita' : ' (uso cobrado por ' + P.nome + ')'}</a> · ${lembrarChave() ? 'fica salva só neste navegador' : 'não será gravada'}${P.gratis ? '' : ' · use uma chave dedicada com limite de gasto'}</small>
      <div class="motorCfg"><span class="rotulo">Dossiê</span>
        <select id="dossieN" class="modelo" ${iaOcupado ? 'disabled' : ''}>${TAMANHOS_DOSSIE.map(n => `<option value="${n}" ${n === nDossie() ? 'selected' : ''}>últimas ${n} partidas</option>`).join('')}</select>
        <label class="lembrar" title="Só no Claude: manda o modelo pensar mais antes de responder (effort high). O padrão médio costuma bastar e responde bem mais rápido."><input type="checkbox" id="iaProfunda" ${iaProfunda() ? 'checked' : ''}>raciocínio profundo</label>
        <small class="explica">Quantas partidas recentes vão linha a linha para a IA e entram na fila do motor. Derrotas e empates vão completas (lances, marcos, relógio); vitórias em linha curta. 100 são ~18 mil tokens; 300, 40–50 mil — acima do limite gratuito do Groq e três vezes mais tempo de motor. Os cards de erros e o resumo do motor usam todas as partidas do período que já foram avaliadas, seja qual for o tamanho.</small></div>
      <div id="motorControles">${typeof motorControles === 'function' ? motorControles() : ''}</div>
      <small class="explica"><b>Analisar</b> roda o motor nas partidas ainda não avaliadas e envia à IA os indicadores do período mais o dossiê das últimas <b class="nDossie">${nDossie()}</b> partidas desta modalidade (primeiros lances, relógio, marcos e erros do Stockfish). Devolve diagnóstico, o que manter, o que parar de fazer, o que estudar, plano e regras de rotina. Nenhuma partida sai do navegador além do que vai para o provedor de IA escolhido.</small>
    </div>
    <div id="motorStatus">${typeof motorStatus === 'function' ? motorStatus() : ''}</div>
    ${iaErro ? `<p class="erro">${iaErro}</p>` : ''}
    <div id="iaResultado">${iaTexto ? relatorioIA(iaTexto) : ''}</div>
  </div>`;
}

async function carregarModelos(){
  const p = provAtual(), P = PROVEDORES[p], chave = $('iaChave').value.trim();
  if (!chave) { iaErro = 'Informe a chave para listar os modelos.'; renderAnalise(); return; }
  gravarChave(p, chave);
  iaOcupado = true; iaErro = 'Buscando modelos…'; renderAnalise();
  try {
    const lista = (await P.listar(chave)).filter(P.filtro).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    if (!lista.length) throw new Error('Nenhum modelo de texto encontrado.');
    modelosIA[p] = [...P.reserva.filter(m => /-latest$/.test(m)), ...lista]; modelosCarregados[p] = true;
    if (!modelosIA[p].includes(lerLS(modeloLS(p), P.padrao))) gravarLS(modeloLS(p), modelosIA[p][0]);
    iaErro = `${lista.length} modelos carregados.`;
  } catch (err) {
    iaErro = err.message;
  } finally {
    iaOcupado = false; renderAnalise();
  }
}

// markdown da IA → [{titulo, html}], uma seção por título (o texto antes do primeiro título vira seção sem título).
// É a base de relatorioIA, que encaixa cada seção numa posição fixa. Sempre com HTML escapado.
function secoesMd(md){
  const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  const secoes = []; let atual = null, lista = null;
  const fechar = () => { if (lista) { atual.html += `</${lista}>`; lista = null; } };
  const abrir = titulo => { fechar(); atual = {titulo, html: ''}; secoes.push(atual); };
  for (const l of md.split('\n')) {
    const t = l.trim();
    if (!t) { fechar(); continue; }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.*)/))) { abrir(inline(m[1])); continue; }
    if (!atual) abrir('');
    if ((m = t.match(/^[-*•]\s+(.*)/))) { if (lista !== 'ul') { fechar(); atual.html += '<ul>'; lista = 'ul'; } atual.html += `<li>${inline(m[1])}</li>`; }
    else if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { fechar(); atual.html += '<ol>'; lista = 'ol'; } atual.html += `<li>${inline(m[1])}</li>`; }
    else { fechar(); atual.html += `<p>${inline(t)}</p>`; }
  }
  fechar();
  return secoes;
}

// em que posição do relatório cada seção entra, pelo título que o prompt pede (e sinônimos que os modelos usam)
const POSICOES_RELATORIO = [
  ['diagnostico', /diagn[oó]stico|leitura geral|vis[aã]o geral|resumo/i],
  ['mudou', /mudou|evolu[cç][aã]o|tend[eê]ncia/i],
  ['manter', /manter|pontos? fortes?|continuar/i],
  ['parar', /parar|evitar|pontos? fracos?|erros? recorrentes?/i],
  ['estudar', /estudar|estudo|treinar|prioridades?/i],
  ['plano', /plano|ajustes/i],
  ['regras', /regras|rotina|h[aá]bitos/i],
  ['acompanhar', /acompanhar|metas?|indicadores|m[eé]tricas/i],
];
const posicaoRelatorio = titulo => (POSICOES_RELATORIO.find(([, re]) => re.test(titulo)) || ['resto'])[0];

// números do cabeçalho do relatório, a partir do estado (só a modalidade da aba)
function numerosRelatorio(){
  const nick = estado.nick, jogos = estado.jogos.filter(g => g.time_class === aba);
  const c = {w: 0, d: 0, l: 0}, itens = [], acc = [];
  for (const g of jogos) {
    const branco = g.white.username.toLowerCase() === nick, eu = branco ? g.white : g.black;
    const r = eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l'; c[r]++; itens.push({g, r});
    const a = g.accuracies?.[branco ? 'white' : 'black']; if (a != null) acc.push(a);
  }
  const n = jogos.length, a = estado.antes?.[aba], d = estado.depois?.[aba];
  const nums = [
    {v: n, k: `partida${n === 1 ? '' : 's'}`},
    {v: n ? `${Math.round((c.w + c.d / 2) / n * 100)}%` : '–', k: `${c.w}-${c.d}-${c.l}`},
  ];
  if (a != null && d != null) nums.push({v: `${estado.aprox?.[aba] ? '≈' : ''}${a} → ${d}`, k: `rating <b class="${cls(d - a)}">${sinal(d - a)}</b>`});
  if (acc.length) nums.push({v: (acc.reduce((t, v) => t + v, 0) / acc.length).toFixed(1), k: `precisão · ${acc.length} partida${acc.length === 1 ? '' : 's'}`});
  const res = typeof resumoErros === 'function' ? resumoErros(itens, nick) : null;
  if (res) nums.push({v: (res.cont.grave / res.n).toFixed(1), k: `graves/partida · motor em ${res.n}`});
  return nums;
}

// a resposta da IA como relatório de uma página: cabeçalho com os números do período, diagnóstico como abertura,
// depois três colunas (manter · parar · estudar) e três (plano · regras · acompanhar). Seções com título fora do
// esperado vão para o fim, em colunas. Mesmo HTML no painel e no PDF; só o CSS muda.
function relatorioIA(md, {parcial = false, meta = iaMeta} = {}){
  const por = {}; for (const sec of secoesMd(md)) (por[posicaoRelatorio(sec.titulo)] ??= []).push(sec);
  const bloco = (chave, classe = chave) => (por[chave] || []).map(s => `<section class="${classe}">${s.titulo ? `<h3>${s.titulo}</h3>` : ''}${s.html}</section>`).join('');
  const nums = numerosRelatorio().map(x => `<div><b>${x.v}</b><small>${x.k}</small></div>`).join('');
  const quando = meta ? new Date(meta.quando).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'}) : '';
  const tres = chaves => { const h = chaves.map(([k, cl]) => bloco(k, cl)).join(''); return h ? `<div class="tres">${h}</div>` : ''; };
  return `<div class="relatorio${parcial ? ' parcial' : ''}">
    <div class="cabecalho"><div><h3>Análise · ${TIPO[aba] || aba}</h3><small>${escHtml(estado.nick)} · ${escHtml(estado.rotulo)}${quando ? ` · ${quando}` : ''}${meta?.modelo ? ` · ${escHtml(meta.modelo)}` : ''}${parcial ? ' · <b>recebendo…</b>' : ''}</small></div><div class="numeros">${nums}</div></div>
    ${por.diagnostico || por.mudou ? `<div class="lede${por.mudou ? ' comMudou' : ''}">${bloco('diagnostico')}${bloco('mudou')}</div>` : ''}
    <div class="corpo">${tres([['manter', 'manter'], ['parar', 'parar'], ['estudar', 'estudar']])}
    ${tres([['plano', 'plano'], ['regras', 'regras'], ['acompanhar', 'acompanhar']])}
    ${por.resto ? `<div class="resto">${bloco('resto')}</div>` : ''}</div>
  </div>`;
}

function resumoParaIA(curto){
  const div = document.createElement('div');
  const linhas = [];
  const ABAS_SENSIVEIS = new Set(curto ? ['Adversários','Aberturas','Horários','Volume','Erros e precisão','Lances e relógio'] : ['Adversários','Aberturas']);
  const MIN = 10;
  const ACHADOS_SENSIVEIS = /abertura|dia da semana|período do dia|contra mais fracos/i;
  const {rotulo, nick} = estado;
  linhas.push(`Jogador: ${nick}. Período: ${rotulo}. Modalidade: ${TIPO[aba]}.`);
  linhas.push(`Placar: ${$('nw').textContent} vitórias, ${$('nd').textContent} empates, ${$('nl').textContent} derrotas. ${$('rpct').textContent}. Rating: ${$('rating').textContent.trim()}.`);
  const cmp = estado.comp?.tc[aba];
  if (cmp && cmp.n >= MIN) {
    const apCmp = Math.round((cmp.w + cmp.d/2) / cmp.n * 100);
    linhas.push(`Período anterior equivalente (${estado.comp.rotulo}): ${cmp.n} partidas, aproveitamento ${apCmp}% (${cmp.w}V ${cmp.d}E ${cmp.l}D)${cmp.antes != null ? `, rating ${cmp.antes} → ${cmp.depois}` : ''}${cmp.accN >= MIN ? `, precisão média ${(cmp.acc / cmp.accN).toFixed(1)}` : ''}.`);
  }
  for (const [tab, html] of Object.entries(kpiData)) {
    if (tab === 'Análise') continue;
    div.innerHTML = html;
    linhas.push(`\n## ${tab}`);
    for (const c of div.querySelectorAll('.kpi')) {
      let titulo = c.querySelector('h2')?.textContent.replace(/\s+/g,' ').trim();
      if (tab === 'Aberturas') titulo = {'De brancas': 'Partidas em que o jogador tinha as BRANCAS, por abertura (a defesa nomeada é escolha do adversário; o jogador só controla o 1º lance e a resposta)', 'De pretas': 'Partidas em que o jogador tinha as PRETAS, por abertura (aqui a defesa nomeada é escolha do jogador)'}[titulo] || titulo;
      const rows = [...c.querySelectorAll('tr')].map(tr => {
        let [a, b] = [...tr.children].map(td => td.textContent.replace(/\s+/g,' ').trim());
        if (!a) return '';   // linha de cabeçalho de coluna não diz nada fora da tabela
        const grupo = tr.closest('.motivos > div')?.querySelector('h3')?.textContent.trim();
        if (grupo) a = `${grupo} · ${a}`;
        const m = b && b.match(/^(\d+)%\s+(\d+)-(\d+)-(\d+)$/);
        if (m && ABAS_SENSIVEIS.has(tab) && +m[2] + +m[3] + +m[4] < MIN) return '';
        return m ? `${a}: ${+m[2] + +m[3] + +m[4]} partidas, aproveitamento ${m[1]}% (${m[2]}V ${m[3]}E ${m[4]}D)` : `${a}: ${b}`;
      }).filter(Boolean);
      if (rows.length) linhas.push(`${titulo}: ` + rows.join(' | '));
    }
  }
  div.innerHTML = kpiData['Análise'];
  const achados = [...div.querySelectorAll('.achado')]
    .filter(a => !curto || !ACHADOS_SENSIVEIS.test(a.querySelector('h2').textContent))
    .map(a => `- ${a.querySelector('h2').textContent.trim()}: ${a.querySelector('p').textContent.trim()}`);
  if (achados.length) linhas.push('\n## Achados automáticos\n' + achados.join('\n'));
  linhas.push('\n(Linhas de aberturas e adversários com menos de 10 partidas foram omitidas por serem estatisticamente irrelevantes.)');
  return linhas.join('\n');
}

const nivelJogador = ratingRef => ratingRef >= 2400 ? 'nível de mestre (rating ' + ratingRef + '): trate como jogador profissional; as recomendações devem ser sobre preparação, gestão de energia, escolhas de repertório e tendências, não sobre fundamentos'
  : ratingRef >= 1800 ? 'jogador forte de clube (rating ' + ratingRef + '): fundamentos já resolvidos; foque em tática avançada, planos de meio-jogo, finais técnicos e rotina'
  : ratingRef >= 1000 ? 'amador intermediário (rating ' + ratingRef + '): tática de 2-3 lances, planos das aberturas que já joga, finais básicos'
  : 'amador iniciante (rating ' + ratingRef + '): peças penduradas, mates curtos, contar material, não desistir cedo; aberturas só como princípios';

// um prompt só: indicadores agregados do período + dossiê das últimas partidas (lances, relógio, marcos e erros do
// motor). O escopo (curto/médio/longo) e o nível do jogador vêm da amostra; sem lances na busca, vai só com os indicadores.
let iaAviso = '';
function promptCompleto(){
  iaAviso = '';
  let dossie = null;
  try { dossie = dossiePartidas(estado.jogos.filter(g => g.time_class === aba), estado.nick); }
  catch (err) { iaAviso = `Sem o dossiê de partidas nesta análise (${err.message.replace(/\.$/, '')}).`; }
  const jogosAba = estado.jogos.filter(g => g.time_class === aba);
  const dias = jogosAba.length ? Math.max(1, Math.round((jogosAba[jogosAba.length-1].end_time - jogosAba[0].end_time) / 86400) + 1) : 1;
  const nJogos = jogosAba.length;
  const curto = nJogos < 40 || dias <= 10;
  const longo = !curto && (nJogos >= 200 || dias > 60);
  const escopo = curto
    ? `PERÍODO CURTO (${dias} dia(s), ${nJogos} partidas). Trate como leitura de forma recente, não de perfil. Não tire conclusões sobre aberturas, horários ou dias da semana com essa amostra; use-os só se o padrão for extremo. Foque no que se vê em poucas partidas: como as derrotas aconteceram, relógio, sessões e tilt. No lugar do plano de 2 semanas, dê 3 ajustes imediatos para as próximas sessões. Diga explicitamente que a amostra é pequena.`
    : !longo
    ? `PERÍODO MÉDIO (${dias} dias, ${nJogos} partidas). A amostra sustenta conclusões sobre cores, motivos de derrota, sessões, horários e as 3-4 aberturas mais jogadas; variantes com menos de 10 partidas continuam sendo hipóteses. Dê peso a tendências dentro do período (rating por mês, aproveitamento por mês). O plano de 2 semanas se aplica normalmente.`
    : `PERÍODO LONGO (${dias} dias, ${nJogos} partidas). A amostra é robusta: trate os padrões como traços do jogador, não como fase. O rating mudou muito ao longo do tempo, então separe o que é evolução (compare começo e fim do período pelas linhas de rating e aproveitamento por mês) do que é estrutural (persiste o período todo). Aberturas, horários e dias da semana são confiáveis. Aponte também o que já melhorou, e não gaste o plano de 2 semanas em algo que os dados mostram já resolvido. Onde fizer sentido, sugira o que acompanhar nos próximos 30 dias para confirmar a mudança.`;

  const temCmp = (estado.comp?.tc[aba]?.n ?? 0) >= 10;
  const nivel = nivelJogador(estado.depois[aba] ?? 0);
  return `Você é um treinador de xadrez experiente. Vai analisar um jogador do Chess.com a partir de duas fontes — os INDICADORES agregados do período e${dossie ? ` o DOSSIÊ das últimas ${dossie.n} partidas de ${TIPO[aba]} (primeiros lances, relógio, marcos${dossie.comMotor ? ' e erros apontados pelo motor' : ''})` : ' (o dossiê de partidas não está disponível nesta busca)'} — e escrever, em português do Brasil, um diagnóstico com o que ele deve manter, o que deve parar de fazer, o que deve estudar e um plano.

NÍVEL DO JOGADOR: ${nivel}. Adapte vocabulário, expectativas e recomendações a esse nível.

COMO LER OS INDICADORES
- Formato das linhas: "rótulo: N partidas, aproveitamento X% (V E D)". Aproveitamento conta empate como meio ponto. N é a quantidade de partidas daquela linha; X% é o rendimento nelas, NÃO a proporção sobre o total.
- "Sessão" é um bloco de partidas com menos de 30 minutos entre uma e outra. "Posição na sessão" é a ordem da partida dentro desse bloco.
- "Tilt" mede o rendimento nas partidas jogadas logo após uma ou duas derrotas seguidas.
- "Mais forte / parelho / mais fraco" compara o rating do adversário com o do jogador ANTES da partida (±25 pontos). Como o Chess.com pareia quase sempre dentro dessa faixa, amostras pequenas nos extremos são normais.
- "Como terminaram" tem três grupos: "Vitórias · mate" é como o ADVERSÁRIO perdeu (o jogador deu mate); "Derrotas · desistência" é como o JOGADOR perdeu (ele desistiu).
- "Por rating do adversário" usa faixas absolutas. Como o rating do jogador mudou ao longo do período (veja a linha Rating), as faixas baixas correspondem ao começo do período, quando ele próprio tinha esse rating — não são "adversários fracos de hoje".
- Aberturas: na tabela de BRANCAS, o nome da abertura (ex.: "Scandinavian Defense") é a defesa que o ADVERSÁRIO escolheu contra o 1º lance do jogador; o jogador não pode "trocar" essa abertura, só pode preparar melhor a resposta a ela. Na tabela de PRETAS, a defesa é escolha do próprio jogador e aí sim pode ser trocada.
- "Precisão" é a métrica de análise do Chess.com (0-100), disponível só nas partidas analisadas.
- "Relógio ao final" é o tempo que sobrou quando a partida terminou. Terminar derrotas com muito tempo sobrando indica decisões apressadas, não falta de tempo.
${temCmp ? `- "Período anterior equivalente" é o mesmo recorte de calendário deslocado para trás (mês anterior, ano anterior ou a mesma janela de dias). Serve para dizer se o jogador evoluiu ou regrediu; só compare aproveitamento se as duas amostras tiverem tamanho parecido.
` : ''}- Os "achados automáticos" já apontam desvios estatísticos; use-os como ponto de partida, mas verifique se os números sustentam.

${dossie ? `COMO LER O DOSSIÊ
- Uma linha por partida, numeradas de #1 (mais antiga) a #${dossie.n} (mais recente), com data, cor, resultado e motivo, ratings, abertura, número de lances e precisão (quando o Chess.com analisou).
- Derrotas e empates trazem os 15 primeiros lances em notação algébrica ("…" indica que a partida continuou), os marcos e o relógio. Vitórias vêm em linha curta — cabeçalho, roque e relógio final — porque o que há para corrigir está nas derrotas; as vitórias entram inteiras nos agregados de aberturas e do motor.
- Marcos lidos do texto dos lances: em que lance cada lado rocou, a primeira captura, quantas vezes a dama se moveu nos 10 primeiros lances, xeques dados e recebidos.
- Relógio: tempo inicial e final dos dois lados, média de segundos por lance em cada fase, a maior reflexão e a partir de que lance o jogador ficou abaixo de 30 s.

O QUE VOCÊ NÃO TEM — E NÃO DEVE FINGIR TER
- Você não tem o tabuleiro nem avaliação de motor. NÃO afirme que um lance específico foi erro grave, que uma peça ficou pendurada, que havia mate ou que uma posição estava ganha ou perdida: sem tabuleiro isso é chute e o jogador vai confiar em algo falso. Se um trecho parecer suspeito, apresente como hipótese a conferir ("vale rever a partida #37 a partir do lance 12 na análise do Chess.com").
- Só os 15 primeiros lances estão disponíveis. Sobre o meio-jogo e o final você sabe apenas a duração, o motivo do fim, os xeques e o relógio — use isso, não invente o que aconteceu.
${dossie.comMotor ? `- EXCEÇÃO: ${dossie.comMotor} partidas trazem a linha "erros (motor)". Esses lances foram avaliados pelo Stockfish e são erros de fato — a queda é da chance de vitória do jogador, em pontos percentuais, e "decisivo" é o erro do qual a partida não voltou. Use-os à vontade: em que fase e com quanto relógio acontecem, se repetem na mesma abertura, se o lance decisivo das derrotas vem cedo ou tarde. "melhor:" é o lance que o motor preferia no lugar — cite-o como fato, mas NÃO invente a razão tática por trás dele (sem tabuleiro você não a vê); quando for relevante, diga que vale conferir aquele lance na análise do Chess.com. A proibição acima continua valendo para qualquer lance SEM essa marcação.
` : ''}` : ''}
REGRAS
- Cite o número (e, no dossiê, a partida: #12, #40) que sustenta cada afirmação. Não invente dados nem estime o que não está nos dados.
- Amostras pequenas (menos de ~15 partidas) não sustentam conclusões fortes: mencione como hipótese ou ignore. Um padrão precisa aparecer em várias partidas; o que ocorreu uma vez é anedota.
- Cruze as duas fontes: os indicadores dizem ONDE o rendimento cai (cor, horário, sessão, relógio); o dossiê diz COMO isso acontece nas partidas (abertura, ordem de lances, ritmo, erros). Quando as duas apontam para o mesmo lugar, é o achado principal.
- Priorize o que mais custa rating hoje. Um problema em 40% das partidas vale mais que um em 5%.
- Seja concreto: em vez de "estude aberturas", diga qual abertura, o que revisar nela e por quê, com base nos números.
- Adapte tudo ao NÍVEL DO JOGADOR. Para iniciantes, nada de linhas teóricas nomeadas, puzzles "nível 1500+" ou finais complexos; para mestres, nada de conselhos de fundamentos — desistir em posição perdida é normal nesse nível.
- Não repita os números crus em lista; interprete-os.
- Sem introdução, sem elogios genéricos, sem conclusão motivacional. Até 900 palavras; termine todas as seções.

ESCOPO DO PERÍODO
${escopo}

ESTRUTURA (use exatamente estes títulos, em markdown "##", nesta ordem, sem acrescentar outros)
## Diagnóstico
3-4 frases: como esse jogador ganha e como perde, e o que explica o resultado do período${temCmp ? ', dizendo se ele evoluiu ou regrediu em relação ao período anterior e em quê' : ''}.
${longo ? `## O que mudou no período
Compare começo e fim usando as linhas de rating, aproveitamento por mês e rating médio dos adversários por mês. Diga o que melhorou, o que piorou e o que ficou igual. Só depois disso trate padrões como estruturais.
` : ''}## O que manter
3 itens: hábitos e escolhas que estão dando resultado, cada um com o número${dossie ? ' e as partidas' : ''} que comprovam. Ponto forte é o que fica acima da média geral do jogador, não a média em si.
## O que parar de fazer
3 itens em ordem de impacto: o padrão, em quantas partidas aparece, o que custou e o que fazer no lugar.
## O que estudar
3-4 itens concretos e priorizados: qual abertura ou ordem de lances, que tipo de posição ou final, que habilidade de relógio — e por quê, com base nos dados. Para cada um, diga como estudar (quais partidas revisar, que tipo de exercício, quanto tempo).
${curto ? `## Ajustes imediatos
3 ajustes concretos para as próximas sessões.` : `## Plano para 2 semanas
Semana 1 e Semana 2, com 2-3 ações práticas cada (o que treinar, quanto tempo, como medir).`}
## Regras de rotina
Quando jogar, quando parar, quantas partidas por sessão e o que fazer após derrota, tudo derivado dos dados de sessão, tilt, horário e relógio.
## Como acompanhar
2-3 métricas do próprio painel para verificar nas próximas 50 partidas se mudou, com o valor atual e a meta.

DADOS

=== INDICADORES DO PERÍODO ===
${resumoParaIA(curto)}
${dossie ? `
=== DOSSIÊ DAS ÚLTIMAS ${dossie.n} PARTIDAS ===
${dossie.texto}` : ''}`;
}

// dossiê das últimas N partidas da modalidade: derrotas e empates com os 15 primeiros lances, marcos lidos do
// texto do SAN (roque, primeira captura, dama cedo, xeques) e o uso do relógio. Nada aqui simula o tabuleiro —
// é o que dá para afirmar sem motor, e o prompt proíbe a IA de fingir que avaliou posições.
function dossiePartidas(jogos, nick, N = nDossie()){
  const comLances = [...jogos].sort((a, b) => a.end_time - b.end_time).filter(g => parsePGN(g).meias >= 2);
  if (comLances.length < 10) throw new Error(comLances.length || !jogos.length ? `Só ${comLances.length} partidas com lances nesta busca; precisa de pelo menos 10.` : 'Os lances não ficam no cache do navegador: clique em Buscar para baixar as partidas de novo e tente outra vez.');
  const sel = comLances.slice(-N), RES = {w: 'vitória', d: 'empate', l: 'derrota'};
  const tot = {w: 0, d: 0, l: 0}, cor = {}, abert = {Brancas: {}, Pretas: {}}, motivos = {}, dur = {w: [], l: []}, ratings = [];
  // o bloco do motor no resumo agrega todas as partidas do período que já foram avaliadas (o cache guarda 600, e cresce a
  // cada rodada), não só as N do dossiê — os erros partida a partida, esses sim, ficam restritos às N linhas abaixo
  const resultado = g => { const eu = g.white.username.toLowerCase() === nick ? g.white : g.black; return eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l'; };
  const avaliadas = comLances.filter(g => errosDaPartida(g, nick)).map(g => ({g, r: resultado(g)}));
  let comMotor = 0;
  const linhas = sel.map((g, i) => {
    const branco = g.white.username.toLowerCase() === nick, eu = branco ? g.white : g.black, adv = branco ? g.black : g.white;
    const r = eu.result === 'win' ? 'w' : DRAWS.has(eu.result) ? 'd' : 'l', lado = branco ? 'Brancas' : 'Pretas';
    const pg = parsePGN(g), san = pg.san, meu = k => k % 2 === (branco ? 0 : 1);
    tot[r]++; conta(cor, lado, r); conta(abert[lado], pg.variante, r); dur[r]?.push(pg.lances);
    if (g.rated) ratings.push(eu.rating);
    const motivo = MOTIVO[r === 'w' ? adv.result : eu.result] || (r === 'w' ? adv.result : eu.result);
    if (r === 'l') motivos[motivo] = (motivos[motivo] || 0) + 1;
    const lance = k => k < 0 ? null : Math.floor(k / 2) + 1;
    const roque = lance(san.findIndex((m, k) => meu(k) && /^O-O/.test(m))), roqueAdv = lance(san.findIndex((m, k) => !meu(k) && /^O-O/.test(m)));
    const captura = lance(san.findIndex(m => m.includes('x')));
    const damaCedo = san.filter((m, k) => meu(k) && k < 20 && /^Q/.test(m)).length;
    const xeques = san.filter((m, k) => meu(k) && m.includes('+')).length, xequesAdv = san.filter((m, k) => !meu(k) && m.includes('+')).length;
    const marcos = [`roque: ${roque ? `lance ${roque}` : 'não rocou'} (adversário: ${roqueAdv ? `lance ${roqueAdv}` : 'não rocou'})`, `1ª captura: ${captura ? `lance ${captura}` : 'nenhuma'}`, damaCedo ? `dama movida ${damaCedo}× nos 10 primeiros lances` : '', `xeques: ${xeques} dados, ${xequesAdv} recebidos`].filter(Boolean).join(' · ');
    // tempo gasto num lance = relógio anterior − atual + incremento; a base vem do time_control ("600" ou "600+5")
    const [base, inc = 0] = String(g.time_control || '').split('+').map(Number);
    const meus = pg.clks.filter((_, k) => meu(k)), dele = pg.clks.filter((_, k) => !meu(k));
    let relogio = '';
    if (base && meus.length >= 2 && g.time_class !== 'daily') {
      const gasto = meus.map((c, k) => Math.max(0, (k ? meus[k-1] : base) - c + inc));
      const fase = (a, b) => { const f = gasto.slice(a, b); return f.length ? Math.round(f.reduce((t, v) => t + v, 0) / f.length) : null; };
      const maior = gasto.reduce((m, v, k) => v > m.v ? {v, k} : m, {v: 0, k: 0});
      const apuro = meus.findIndex(c => c < 30);
      relogio = `relógio: ${seg(base)} → ${seg(meus[meus.length-1])} no fim (adversário: ${seg(dele[dele.length-1])}) · média por lance: ${fase(0, 15)}s na abertura${gasto.length > 15 ? `, ${fase(15, 40)}s no meio-jogo` : ''}${gasto.length > 40 ? `, ${fase(40)}s no final` : ''} · maior reflexão: ${Math.round(maior.v)}s no lance ${maior.k + 1}${apuro >= 0 ? ` · abaixo de 30 s a partir do lance ${apuro + 1}` : ''}`;
    }
    const acc = g.accuracies ? ` · precisão ${g.accuracies[branco ? 'white' : 'black']?.toFixed(0)} vs ${g.accuracies[branco ? 'black' : 'white']?.toFixed(0)}` : '';
    // partidas que o motor já avaliou ganham a lista de erros: é o único trecho em que a IA pode falar de lance específico
    const er = errosDaPartida(g, nick);
    if (er) comMotor++;
    const errosTxt = !er ? '' : (er.erros.filter(e => e.grau !== 'imprecisão').map(e => `lance ${e.lance} ${e.san} (${e.grau}, chance ${e.antes}% → ${e.depois}%${e.melhor ? `, melhor: ${e.melhor}` : ''}${e.relogio != null ? `, ${seg(e.relogio)} no relógio` : ''})`).join('; ') || 'nenhum erro ou erro grave') + (er.decisivo ? ` · decisivo: lance ${er.decisivo.lance}` : '') + (er.favor || er.contra ? ` · viradas: ${er.favor} a favor, ${er.contra} contra` : '');
    const cabecalho = `#${i + 1} · ${fmtDia.format(new Date(g.end_time * 1000))} · ${lado.toLowerCase()} · ${RES[r]} por ${motivo} · ${eu.rating} vs ${adv.rating}${g.delta != null ? ` (${sinal(g.delta)})` : ''} · ${pg.variante}${pg.eco ? ` (${pg.eco})` : ''} · ${pg.lances} lances${acc}`;
    const errosLinha = errosTxt ? `\n  erros (motor, profundidade ${er.prof}): ${errosTxt}` : '';
    // vitória em linha curta: o que há para corrigir está nas derrotas e empates; a vitória entra inteira nos agregados de aberturas e do
    // motor, e aqui só o roque e o relógio final — os 15 lances, os marcos e o relógio detalhado são ~60% dos tokens de cada partida
    if (r === 'w') return `${cabecalho} · roque: ${roque ? `lance ${roque}` : 'não'}${meus.length ? ` · relógio final: ${seg(meus[meus.length-1])} vs ${seg(dele[dele.length-1])}` : ''}${errosLinha}`;
    return `${cabecalho}\n  lances: ${numerar(san.slice(0, 30))}${san.length > 30 ? ' …' : ''}\n  ${marcos}${relogio ? `\n  ${relogio}` : ''}${errosLinha}`;
  });
  const ap = s => { const n = s.w + s.d + s.l; return `${n} partidas, aproveitamento ${Math.round((s.w + s.d/2) / n * 100)}% (${s.w}V ${s.d}E ${s.l}D)`; };
  const abertLinhas = lado => Object.entries(abert[lado]).filter(([, s]) => s.w + s.d + s.l >= 3).sort((a, b) => (b[1].w + b[1].d + b[1].l) - (a[1].w + a[1].d + a[1].l)).map(([k, s]) => `  ${k}: ${ap(s)}`).join('\n') || '  (nenhuma com 3+ partidas)';
  const med = arr => arr.length ? Math.round(arr.reduce((t, v) => t + v, 0) / arr.length) : '–';
  const resumo = `RESUMO DAS ${sel.length} PARTIDAS (${fmtDia.format(new Date(sel[0].end_time * 1000))} a ${fmtDia.format(new Date(sel[sel.length-1].end_time * 1000))}, ${TIPO[sel[0].time_class]})
Total: ${ap(tot)}${ratings.length ? ` · rating ${ratings[0]} → ${ratings[ratings.length-1]}` : ''}
Por cor: ${['Brancas', 'Pretas'].filter(c => cor[c]).map(c => `${c}: ${ap(cor[c])}`).join(' · ')}
Duração média: ${med(dur.w)} lances nas vitórias, ${med(dur.l)} nas derrotas
Derrotas por motivo: ${Object.entries(motivos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'nenhuma'}
Aberturas de brancas (3+ partidas):
${abertLinhas('Brancas')}
Aberturas de pretas (3+ partidas):
${abertLinhas('Pretas')}
${resumoMotor(avaliadas, nick, comMotor)}
PARTIDAS (#1 = mais antiga)
`;
  return {n: sel.length, comMotor, texto: resumo + linhas.join('\n')};
}
// bloco do motor no resumo do dossiê: só existe se alguma das partidas foi avaliada
function resumoMotor(avaliadas, nick, noDossie = avaliadas.length){
  const res = avaliadas.length ? resumoErros(avaliadas, nick) : null;
  if (!res) return '';
  const t30 = taxaErros(res, 'menos de 30 s'), fases = Object.entries(res.fase).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ');
  return `Motor (Stockfish, profundidade ${res.prof}) em ${res.n} partidas avaliadas do período${noDossie < res.n ? ` (${noDossie} delas estão no dossiê abaixo, com os erros lance a lance)` : ''}: ${(res.cont.grave / res.n).toFixed(1)} erros graves e ${(res.cont.erro / res.n).toFixed(1)} erros por partida · erros por fase: ${fases || '–'} · erros por 100 lances com menos de 30 s no relógio: ${t30 == null ? '–' : t30.toFixed(1)} (${FAIXAS_RELOGIO.slice(1).map(f => { const t = taxaErros(res, f); return t == null ? null : `${f}: ${t.toFixed(1)}`; }).filter(Boolean).join(', ')}) · viradas: ${res.favor} a favor, ${res.contra} contra · derrotas com lance decisivo identificado: ${res.decisivos.length}
`;
}

// o único botão de análise: primeiro o motor nas partidas pendentes (quando ele existe e a página é servida por
// http), depois a IA com indicadores + dossiê. Motor interrompido não chama a IA; motor com erro manda o que já estava avaliado.
async function analisarTudo(){
  if (!estado) return;
  const chave = $('iaChave').value.trim();
  if (!chave) { iaErro = 'Informe a chave da API.'; renderAnalise(); return; }
  // grava já: o cartão é re-renderizado enquanto o motor roda e o campo voltaria ao valor salvo, perdendo a chave digitada
  gravarChave(provAtual(), chave); gravarLS(modeloLS(provAtual()), $('iaModelo').value);
  if (typeof motorDisponivel === 'function' && motorDisponivel() && !motor.rodando) {
    const pend = pendentesMotor(estado.jogos.filter(g => g.time_class === aba), motorProf()).length;
    if (pend) {
      iaOcupado = true; iaErro = `Avaliando ${pend} partida${pend === 1 ? '' : 's'} com o motor antes de chamar a IA.`; renderAnalise();
      await motorAnalisar();
      iaOcupado = false;
      if (motor.cancelar) { iaErro = 'Motor interrompido; a IA não foi chamada. Clique de novo para continuar de onde parou.'; renderAnalise(); return; }
    }
  }
  await executarIA(promptCompleto);
}

// laço da chamada: valida chave, monta o prompt, tenta o modelo escolhido e cai para os reservas
const chaveRelatorio = () => `${estado.nick}|${aba}`;
// "Failed to fetch" é o navegador dizendo que não houve resposta nenhuma; a causa real só aparece no console
const erroDeRede = (P, e) => {
  const host = {Gemini: 'generativelanguage.googleapis.com', Groq: 'api.groq.com', Claude: 'api.anthropic.com', OpenAI: 'api.openai.com'}[P.nome] || 'o provedor';
  // o abort do vigia chega ao leitor como "BodyStreamBuffer was aborted" (Chrome) ou AbortError, não com a nossa razão
  if (e.name === 'AbortError' || /abort/i.test(e.message)) return `${P.nome} conectou mas ficou ${Math.round(INATIVIDADE_SSE / 60000)} min sem enviar dados, e a chamada foi encerrada. Costuma ser VPN, proxy ou rede que segura respostas em streaming; tente de novo ou em outra rede.`;
  return `Sem resposta da rede ao chamar ${P.nome} (${e.message}). Causas comuns: bloqueador de anúncios ou extensão de privacidade barrando ${host}; VPN, proxy ou rede corporativa cortando a conexão; sem internet. Abra o console do navegador (F12 → Console) para ver o motivo exato e tente de novo.`;
};
async function executarIA(montarPrompt){
  const p = provAtual(), P = PROVEDORES[p];
  const chave = $('iaChave').value.trim(), escolhido = $('iaModelo').value;
  if (!chave) { iaErro = 'Informe a chave da API.'; renderAnalise(); return; }
  gravarChave(p, chave); gravarLS(modeloLS(p), escolhido);
  iaOcupado = true; iaErro = ''; renderAnalise();
  const espera = ms => new Promise(r => setTimeout(r, ms));
  try {
    const prompt = montarPrompt();
    if (!modelosCarregados[p]) { try { modelosIA[p] = [...P.reserva.filter(m => /-latest$/.test(m)), ...(await P.listar(chave)).filter(P.filtro)]; modelosCarregados[p] = true; } catch {} }
    const modelo = modelosIA[p].includes(escolhido) ? escolhido : modelosIA[p].find(m => P.reserva.includes(m)) || modelosIA[p][0];
    const modelos = [modelo, ...P.reserva.filter(m => m !== modelo && modelosIA[p].includes(m)), ...modelosIA[p].filter(m => m !== modelo && !P.reserva.includes(m))].slice(0, 6);
    let ultimoErro = null;
    for (const m of modelos) {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        iaOcupado = true; iaErro = `Tentando ${P.nome} · ${m}${tentativa ? ` (${tentativa + 1}ª tentativa)` : ''}…`; renderAnalise();
        // progresso no lugar, sem refazer o cartão; o fetch que falha antes de qualquer resposta (rede, CORS, extensão
        // bloqueando, conexão cortada) lança TypeError "Failed to fetch": vira status 0, repetível e com mensagem explicada
        // a linha de status mostra fase e tempo decorrido, atualizada a cada segundo: o Opus passa minutos raciocinando antes da
        // primeira palavra, e sem isso a tela parecia travada em "Tentando…"
        const t0 = Date.now(); let fase = 'aguardando resposta', chars = 0;
        const FASE = {conectado: 'conectado, aguardando o modelo', raciocinando: 'o modelo está raciocinando', respondendo: 'respondendo'};
        const pintar = () => { const el = document.querySelector('#cardIA .erro'); if (el) el.textContent = `${P.nome} · ${m} · ${FASE[fase] || fase}… ${seg(Math.round((Date.now() - t0) / 1000))}${chars ? ` · ${chars} caracteres` : ''}`; };
        // o relatório vai sendo montado enquanto chega (no máximo a cada 1,5 s): quem lê o Diagnóstico não espera a última coluna
        let ultimoParcial = 0;
        const progresso = (f, n, parcial) => {
          fase = f; chars = n; pintar();
          if (parcial && Date.now() - ultimoParcial > 1500) { ultimoParcial = Date.now(); const el = $('iaResultado'); if (el) el.innerHTML = relatorioIA(parcial, {parcial: true, meta: {modelo: m, quando: t0}}); }
        };
        const relogio = setInterval(pintar, 1000);
        let res;
        try { res = await P.chamar(chave, m, prompt, progresso); }
        catch (e) { res = {ok: false, status: 0, erro: erroDeRede(P, e)}; }
        finally { clearInterval(relogio); }
        if (res.ok) {
          iaTexto = res.texto || 'Resposta vazia.';
          iaMeta = {modelo: m, quando: Date.now()};
          // o relatório custou minutos e centavos: fica guardado por jogador e modalidade, e render() o traz de volta após um refresh
          armazem.gravar('relatorios', chaveRelatorio(), {texto: iaTexto, meta: iaMeta, quando: iaMeta.quando});
          iaErro = [m !== escolhido ? `Respondido por ${m} (o modelo escolhido estava indisponível); ele passou a ser o padrão.` : '', iaAviso].filter(Boolean).join(' ');
          gravarLS(modeloLS(p), m);
          return;
        }
        ultimoErro = res.erro || `Erro ${res.status}`;
        if (res.status === 0 || res.status === 503 || res.status === 429 || res.status >= 500) { await espera(2000 * (tentativa + 1)); continue; }
        if (res.status === 404 || res.status === 400 && /model/i.test(ultimoErro)) { modelosIA[p] = modelosIA[p].filter(x => x !== m); break; }
        throw new Error(ultimoErro);
      }
    }
    throw new Error(ultimoErro || 'Nenhum modelo respondeu.');
  } catch (err) {
    iaErro = err.message;
  } finally {
    iaOcupado = false; renderAnalise();
  }
}
$('kpiGrid').addEventListener('click', e => {
  if (e.target.id === 'iaCfgToggle') { const digitada = $('iaChave')?.value.trim(); if (digitada) gravarChave(provAtual(), digitada); iaCfgAberta = $('iaCfg').hidden; renderAnalise(); }
  if (e.target.id === 'iaAnalisar') analisarTudo(); if (e.target.id === 'iaModelos') carregarModelos(); if (e.target.id === 'iaPdf') exportarPDF(); });

function exportarPDF(){
  if (!estado || !kpiData) return;
  const {nick, rotulo} = estado;
  const div = document.createElement('div'); div.innerHTML = kpiData['Análise'];
  const achados = [...div.querySelectorAll('.achado')].map(a => `<li><b>${a.querySelector('h2').textContent.replace(/^[▲●✔ℹ]\s*/, '').trim()}</b> — ${a.querySelector('p').textContent.trim()}</li>`).join('');
  const esc = t => t.replace(/</g, '&lt;');
  const secoes = ['Resultados','Rating','Aberturas','Lances e relógio','Erros e precisão','Sessões','Horários'].map(tab => {
    if (!kpiData[tab]) return '';
    div.innerHTML = kpiData[tab];
    const cards = [...div.querySelectorAll('.kpi')].map(c => {
      const t = [...c.querySelector('h2')?.childNodes || []].filter(n => !(n.nodeType === 1 && n.classList.contains('ajuda'))).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();   // sem o "?" da ajuda
      // linha de cabeçalho de coluna (primeira célula vazia, ex.: "· aproveitamento · rating") não é dado: fica de fora
      const rows = [...c.querySelectorAll('tr')].filter(tr => tr.children[0]?.textContent.trim()).map(tr => { const g = tr.closest('.motivos > div')?.querySelector('h3')?.textContent.trim(); return (g ? `${g} · ` : '') + [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join(': '); }).filter(Boolean);
      return rows.length ? `<div class="bloco"><h4>${esc(t)}</h4><ul class="mini">${rows.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : '';
    }).join('');
    return cards ? `<h3>${tab}</h3>${cards}` : '';
  }).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise Chess.com — ${esc(nick)}</title>
  <style>
    body{font:11pt/1.4 Georgia,serif;color:#1c1a17;margin:0;padding:0}
    h1{font-size:20pt;margin:0 0 2px} .sub{color:#6b655b;margin:0 0 14px}
    .placar{display:flex;gap:18px;margin:0 0 18px;padding:10px 14px;border:1.5px solid #1c1a17}
    .placar b{font-size:16pt;display:block;line-height:1}.placar span{font-size:9pt;color:#6b655b}
    h2{font-size:13pt;border-bottom:1.5px solid #1c1a17;padding-bottom:3px;margin:16px 0 6px;break-after:avoid}
    h3{font-size:10.5pt;margin:12px 0 5px;color:#6b655b;text-transform:uppercase;letter-spacing:.05em;break-after:avoid}
    h4{font-size:9.5pt;margin:6px 0 2px}
    ul,ol{margin:4px 0 8px;padding-left:20px} li{margin:2px 0}
    .mini{font-size:8.5pt;columns:1;margin:0 0 5px} .cols{columns:3;column-gap:18px;column-fill:auto} .bloco{break-inside:avoid;margin:0 0 6px} .cols h3{margin:8px 0 4px;break-after:avoid} .cols h3:first-child{margin-top:0} .cols h4{break-after:avoid}
    /* relatório impresso: o mesmo HTML de relatorioIA, mas como documento — cabeçalho e diagnóstico em largura total e as seções
       fluindo em duas colunas de texto que atravessam as páginas; a grade de três colunas da tela não cabe numa folha */
    .relatorio{font-size:9.5pt;line-height:1.4} .relatorio .cabecalho{display:flex;flex-direction:column;gap:6px;border-bottom:1.5px solid #1c1a17;padding-bottom:8px}
    .relatorio .cabecalho h3{font-size:15pt;margin:0;color:#1c1a17;text-transform:none;letter-spacing:0} .relatorio .cabecalho small{color:#6b655b;font-size:8.5pt}
    .relatorio .numeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(90pt,1fr));gap:6px} .relatorio .numeros>div{border:1px solid #d9d2c2;padding:4px 8px} .relatorio .numeros>div>b{display:block;font-size:13pt;line-height:1.1} .relatorio .numeros small{font-size:8pt;color:#6b655b}
    .relatorio .lede{border-left:3px solid #1c1a17;padding:4px 12px;margin:10px 0 12px;display:grid;gap:14px} .relatorio .lede.comMudou{grid-template-columns:3fr 2fr}
    .relatorio .corpo{columns:2;column-gap:8mm} .relatorio .tres,.relatorio .resto{display:contents}
    .relatorio section{display:block;break-inside:auto;margin:0 0 8px;padding:0 0 6px;border-bottom:1px solid #d9d2c2} .relatorio section h3{border-top:3px solid #6b655b;padding-top:5px} .relatorio li,.relatorio p{break-inside:avoid}
    .relatorio .manter h3{border-top-color:#2f9e5a} .relatorio .parar h3{border-top-color:#d0463c} .relatorio .estudar h3{border-top-color:#3b6fe8}
    .relatorio section h3{font-size:8pt;text-transform:uppercase;letter-spacing:.08em;color:#6b655b;margin:0 0 4px;break-after:avoid} .relatorio p{margin:3px 0} .relatorio ol,.relatorio ul{margin:0;padding-left:16px} .relatorio li{margin:2px 0}
    .rodape{margin-top:24px;font-size:9pt;color:#6b655b;border-top:1px solid #d9d2c2;padding-top:6px}
    @page{size:A4 portrait;margin:11mm 12mm} @media print{.cols{columns:3}}
  </style></head><body>
  ${iaTexto ? relatorioIA(iaTexto) : `<h1>Análise de xadrez — ${esc(nick)}</h1>
  <p class="sub">Chess.com · ${esc(rotulo)} · modalidade: ${TIPO[aba]}</p>`}
  ${iaTexto ? '' : `<div class="placar">
    <div><b>${$('nw').textContent}</b><span>vitórias</span></div>
    <div><b>${$('nd').textContent}</b><span>empates</span></div>
    <div><b>${$('nl').textContent}</b><span>derrotas</span></div>
    <div><b>${$('nr').textContent}</b><span>rating</span></div>
    <div><b>${esc($('rpct').textContent.replace(' de aproveitamento','') || '–')}</b><span>aproveitamento</span></div>
    <div style="align-self:center;color:#6b655b;font-size:10pt">${esc($('rating').textContent.trim())}</div>`}
  </div>
  ${achados ? `<h2>Achados automáticos</h2><ul>${achados}</ul>` : ''}
  <h2>Indicadores</h2><div class="cols">${secoes}<p class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')} a partir da API pública do Chess.com.</p></div>
  <scr` + `ipt>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</scr` + `ipt>
  </body></html>`;
  const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
  const w = window.open(url, '_blank');
  if (!w) { iaErro = 'O navegador bloqueou a janela; libere pop-ups para este arquivo.'; renderAnalise(); return; }
  iaErro = 'Na janela de impressão, escolha "Salvar como PDF" e desmarque "Cabeçalhos e rodapés" para um resultado limpo.'; renderAnalise();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$('kpiGrid').addEventListener('change', e => {
  if (e.target.id === 'iaModelo') gravarLS(modeloLS(provAtual()), e.target.value);
  // tamanho do dossiê: atualiza os textos e os controles do motor no lugar, sem refazer o cartão (a chave pode estar sendo digitada)
  if (e.target.id === 'iaProfunda') gravarLS('placar-chesscom:iaProfunda', e.target.checked ? '1' : '0');
  if (e.target.id === 'dossieN') { gravarLS('placar-chesscom:nDossie', e.target.value); document.querySelectorAll('.nDossie').forEach(el => el.textContent = nDossie()); if (typeof renderMotor === 'function') renderMotor(); }
  if (e.target.id === 'iaProv') { gravarChave(provAtual(), $('iaChave').value.trim()); gravarLS('placar-chesscom:provedor', e.target.value); iaErro = ''; renderAnalise(); }
  if (e.target.id === 'iaLembrar') {
    gravarLS('placar-chesscom:lembrarChave', e.target.checked ? '1' : '0');
    if (e.target.checked) gravarChave(provAtual(), $('iaChave').value.trim()); else esquecerChaves();
    renderAnalise();
  }
});
