// Análise com IA: provedores, chaves, prompts (indicadores e dossiê de partidas), chamada com fallback e exportação em PDF.
// o header dangerous-direct-browser-access libera CORS para chamadas feitas do navegador
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
    async chamar(chave, modelo, prompt){
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: {'Content-Type': 'application/json', ...cabAnthropic(chave)},
        body: JSON.stringify({model: modelo, max_tokens: 16000, messages: [{role: 'user', content: prompt}]})
      });
      const d = await r.json().catch(() => ({}));
      if (d.stop_reason === 'refusal') return {ok: false, status: r.status, erro: 'O modelo recusou a solicitação. Tente outro modelo.'};
      return {ok: r.ok, status: r.status, erro: d.error?.message, texto: (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('')};
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
    async chamar(chave, modelo, prompt){
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${chave}`},
        body: JSON.stringify({model: modelo, messages: [{role: 'user', content: prompt}], max_completion_tokens: 16000})
      });
      const d = await r.json().catch(() => ({}));
      return {ok: r.ok, status: r.status, erro: d.error?.message, texto: d.choices?.[0]?.message?.content || ''};
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

function blocoIA(){
  const p = provAtual(), P = PROVEDORES[p];
  const chave = lerChave(p), modelo = lerLS(modeloLS(p), P.padrao);
  return `<div class="kpi box ia"><h2>Análise com IA</h2>
    <div class="cfg">
      <select id="iaProv" class="modelo">${Object.entries(PROVEDORES).map(([k, v]) => `<option value="${k}" ${k === p ? 'selected' : ''}>${v.nome}</option>`).join('')}</select>
      <input id="iaChave" type="password" placeholder="Chave da API (${P.nome})" value="${chave.replace(/"/g,'&quot;')}" autocomplete="off">
      <select id="iaModelo" class="modelo">${[...new Set([modelo, ...modelosIA[p]])].map(m => `<option value="${m}" ${m === modelo ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button type="button" id="iaModelos" title="Buscar modelos disponíveis na sua chave" aria-label="Buscar modelos disponíveis" ${iaOcupado ? 'disabled' : ''}>↻</button>
      <button type="button" id="iaAnalisar" title="Avalia as partidas pendentes com o motor (quando disponível) e envia à IA os indicadores do período e o dossiê das últimas ${N_DOSSIE} partidas" ${iaOcupado ? 'disabled' : ''}>${iaOcupado ? 'Analisando…' : 'Analisar'}</button>
      <button type="button" id="iaPdf" title="Abre a janela de impressão; escolha 'Salvar como PDF'">Exportar PDF</button>
      <label class="lembrar" title="Desmarcado, a chave vale só nesta aba e não fica gravada no navegador"><input type="checkbox" id="iaLembrar" ${lembrarChave() ? 'checked' : ''}>lembrar chave</label>
      <small><a href="${P.link}" target="_blank" rel="noopener">criar chave${P.gratis ? ' gratuita' : ' (uso cobrado por ' + P.nome + ')'}</a> · ${lembrarChave() ? 'fica salva só neste navegador' : 'não será gravada'}${P.gratis ? '' : ' · use uma chave dedicada com limite de gasto'}</small>
    </div>
    ${iaErro ? `<p class="erro">${iaErro}</p>` : ''}
    <div class="texto">${iaTexto ? mdParaHtml(iaTexto) : `<small>Roda o motor nas partidas ainda não avaliadas e envia à IA os indicadores do período mais o dossiê das últimas ${N_DOSSIE} partidas desta modalidade (primeiros lances, relógio, marcos e erros do Stockfish). Devolve diagnóstico, o que manter, o que parar de fazer, o que estudar, plano e regras de rotina.</small>`}</div>
  </div>`;
}

async function carregarModelos(){
  const p = provAtual(), P = PROVEDORES[p], chave = $('iaChave').value.trim();
  if (!chave) { iaErro = 'Informe a chave para listar os modelos.'; renderKpis(); return; }
  gravarChave(p, chave);
  iaOcupado = true; iaErro = 'Buscando modelos…'; renderKpis();
  try {
    const lista = (await P.listar(chave)).filter(P.filtro).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    if (!lista.length) throw new Error('Nenhum modelo de texto encontrado.');
    modelosIA[p] = [...P.reserva.filter(m => /-latest$/.test(m)), ...lista]; modelosCarregados[p] = true;
    if (!modelosIA[p].includes(lerLS(modeloLS(p), P.padrao))) gravarLS(modeloLS(p), modelosIA[p][0]);
    iaErro = `${lista.length} modelos carregados.`;
  } catch (err) {
    iaErro = err.message;
  } finally {
    iaOcupado = false; renderKpis();
  }
}

function mdParaHtml(md){
  const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  const out = []; let lista = null;
  const fechar = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const l of md.split('\n')) {
    const t = l.trim();
    if (!t) { fechar(); continue; }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.*)/))) { fechar(); out.push(`<h3>${inline(m[1])}</h3>`); }
    else if ((m = t.match(/^[-*•]\s+(.*)/))) { if (lista !== 'ul') { fechar(); out.push('<ul>'); lista = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { fechar(); out.push('<ol>'); lista = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else { fechar(); out.push(`<p>${inline(t)}</p>`); }
  }
  fechar();
  return out.join('');
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
- Os 15 primeiros lances de cada partida em notação algébrica; "…" indica que a partida continuou.
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

const N_DOSSIE = 100;
// dossiê das últimas N partidas da modalidade: uma linha por partida com os 15 primeiros lances, marcos lidos do
// texto do SAN (roque, primeira captura, dama cedo, xeques) e o uso do relógio. Nada aqui simula o tabuleiro —
// é o que dá para afirmar sem motor, e o prompt proíbe a IA de fingir que avaliou posições.
function dossiePartidas(jogos, nick, N = N_DOSSIE){
  const comLances = [...jogos].sort((a, b) => a.end_time - b.end_time).filter(g => parsePGN(g).meias >= 2);
  if (comLances.length < 10) throw new Error(comLances.length || !jogos.length ? `Só ${comLances.length} partidas com lances nesta busca; precisa de pelo menos 10.` : 'Os lances não ficam no cache do navegador: clique em Buscar para baixar as partidas de novo e tente outra vez.');
  const sel = comLances.slice(-N), RES = {w: 'vitória', d: 'empate', l: 'derrota'};
  const tot = {w: 0, d: 0, l: 0}, cor = {}, abert = {Brancas: {}, Pretas: {}}, motivos = {}, dur = {w: [], l: []}, ratings = [], avaliadas = [];
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
    if (er) { comMotor++; avaliadas.push({g, r}); }
    const errosTxt = !er ? '' : (er.erros.filter(e => e.grau !== 'imprecisão').map(e => `lance ${e.lance} ${e.san} (${e.grau}, chance ${e.antes}% → ${e.depois}%${e.melhor ? `, melhor: ${e.melhor}` : ''}${e.relogio != null ? `, ${seg(e.relogio)} no relógio` : ''})`).join('; ') || 'nenhum erro ou erro grave') + (er.decisivo ? ` · decisivo: lance ${er.decisivo.lance}` : '') + (er.favor || er.contra ? ` · viradas: ${er.favor} a favor, ${er.contra} contra` : '');
    return `#${i + 1} · ${fmtDia.format(new Date(g.end_time * 1000))} · ${lado.toLowerCase()} · ${RES[r]} por ${motivo} · ${eu.rating} vs ${adv.rating}${g.delta != null ? ` (${sinal(g.delta)})` : ''} · ${pg.variante}${pg.eco ? ` (${pg.eco})` : ''} · ${pg.lances} lances${acc}\n  lances: ${numerar(san.slice(0, 30))}${san.length > 30 ? ' …' : ''}\n  ${marcos}${relogio ? `\n  ${relogio}` : ''}${errosTxt ? `\n  erros (motor, profundidade ${er.prof}): ${errosTxt}` : ''}`;
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
${resumoMotor(avaliadas, nick)}
PARTIDAS (#1 = mais antiga)
`;
  return {n: sel.length, comMotor, texto: resumo + linhas.join('\n')};
}
// bloco do motor no resumo do dossiê: só existe se alguma das partidas foi avaliada
function resumoMotor(avaliadas, nick){
  const res = avaliadas.length ? resumoErros(avaliadas, nick) : null;
  if (!res) return '';
  const t30 = taxaErros(res, 'menos de 30 s'), fases = Object.entries(res.fase).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ');
  return `Motor (Stockfish, profundidade ${res.prof}) em ${res.n} partidas: ${(res.cont.grave / res.n).toFixed(1)} erros graves e ${(res.cont.erro / res.n).toFixed(1)} erros por partida · erros por fase: ${fases || '–'} · erros por 100 lances com menos de 30 s no relógio: ${t30 == null ? '–' : t30.toFixed(1)} (${FAIXAS_RELOGIO.slice(1).map(f => { const t = taxaErros(res, f); return t == null ? null : `${f}: ${t.toFixed(1)}`; }).filter(Boolean).join(', ')}) · viradas: ${res.favor} a favor, ${res.contra} contra · derrotas com lance decisivo identificado: ${res.decisivos.length}
`;
}

// o único botão de análise: primeiro o motor nas partidas pendentes (quando ele existe e a página é servida por
// http), depois a IA com indicadores + dossiê. Motor interrompido não chama a IA; motor com erro manda o que já estava avaliado.
async function analisarTudo(){
  if (!estado) return;
  const chave = $('iaChave').value.trim();
  if (!chave) { iaErro = 'Informe a chave da API.'; renderKpis(); return; }
  // grava já: o cartão é re-renderizado enquanto o motor roda e o campo voltaria ao valor salvo, perdendo a chave digitada
  gravarChave(provAtual(), chave); gravarLS(modeloLS(provAtual()), $('iaModelo').value);
  if (typeof motorDisponivel === 'function' && motorDisponivel() && !motor.rodando) {
    const pend = pendentesMotor(estado.jogos.filter(g => g.time_class === aba), motorProf()).length;
    if (pend) {
      iaOcupado = true; iaErro = `Avaliando ${pend} partida${pend === 1 ? '' : 's'} com o motor antes de chamar a IA — o progresso está no cartão do motor, logo abaixo.`; renderKpis();
      await motorAnalisar();
      iaOcupado = false;
      if (motor.cancelar) { iaErro = 'Motor interrompido; a IA não foi chamada. Clique de novo para continuar de onde parou.'; renderKpis(); return; }
    }
  }
  await executarIA(promptCompleto);
}

// laço da chamada: valida chave, monta o prompt, tenta o modelo escolhido e cai para os reservas
async function executarIA(montarPrompt){
  const p = provAtual(), P = PROVEDORES[p];
  const chave = $('iaChave').value.trim(), escolhido = $('iaModelo').value;
  if (!chave) { iaErro = 'Informe a chave da API.'; renderKpis(); return; }
  gravarChave(p, chave); gravarLS(modeloLS(p), escolhido);
  iaOcupado = true; iaErro = ''; renderKpis();
  const espera = ms => new Promise(r => setTimeout(r, ms));
  try {
    const prompt = montarPrompt();
    if (!modelosCarregados[p]) { try { modelosIA[p] = [...P.reserva.filter(m => /-latest$/.test(m)), ...(await P.listar(chave)).filter(P.filtro)]; modelosCarregados[p] = true; } catch {} }
    const modelo = modelosIA[p].includes(escolhido) ? escolhido : modelosIA[p].find(m => P.reserva.includes(m)) || modelosIA[p][0];
    const modelos = [modelo, ...P.reserva.filter(m => m !== modelo && modelosIA[p].includes(m)), ...modelosIA[p].filter(m => m !== modelo && !P.reserva.includes(m))].slice(0, 6);
    let ultimoErro = null;
    for (const m of modelos) {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        iaOcupado = true; iaErro = `Tentando ${P.nome} · ${m}${tentativa ? ` (${tentativa + 1}ª tentativa)` : ''}…`; renderKpis();
        const res = await P.chamar(chave, m, prompt);
        if (res.ok) {
          iaTexto = res.texto || 'Resposta vazia.';
          iaErro = [m !== escolhido ? `Respondido por ${m} (o modelo escolhido estava indisponível); ele passou a ser o padrão.` : '', iaAviso].filter(Boolean).join(' ');
          gravarLS(modeloLS(p), m);
          return;
        }
        ultimoErro = res.erro || `Erro ${res.status}`;
        if (res.status === 503 || res.status === 429 || res.status >= 500) { await espera(2000 * (tentativa + 1)); continue; }
        if (res.status === 404 || res.status === 400 && /model/i.test(ultimoErro)) { modelosIA[p] = modelosIA[p].filter(x => x !== m); break; }
        throw new Error(ultimoErro);
      }
    }
    throw new Error(ultimoErro || 'Nenhum modelo respondeu.');
  } catch (err) {
    iaErro = err.message;
  } finally {
    iaOcupado = false; renderKpis();
  }
}
$('kpiGrid').addEventListener('click', e => { if (e.target.id === 'iaAnalisar') analisarTudo(); if (e.target.id === 'iaModelos') carregarModelos(); if (e.target.id === 'iaPdf') exportarPDF(); });

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
      const t = c.querySelector('h2')?.textContent.replace(/\s+/g, ' ').trim();
      const rows = [...c.querySelectorAll('tr')].map(tr => { const g = tr.closest('.motivos > div')?.querySelector('h3')?.textContent.trim(); return (g ? `${g} · ` : '') + [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join(': '); }).filter(Boolean);
      return rows.length ? `<h4>${esc(t)}</h4><ul class="mini">${rows.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    }).join('');
    return cards ? `<h3>${tab}</h3><div class="cols">${cards}</div>` : '';
  }).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise Chess.com — ${esc(nick)}</title>
  <style>
    body{font:12pt/1.45 Georgia,serif;color:#1c1a17;margin:0;padding:28px 34px}
    h1{font-size:20pt;margin:0 0 2px} .sub{color:#6b655b;margin:0 0 14px}
    .placar{display:flex;gap:18px;margin:0 0 18px;padding:10px 14px;border:1.5px solid #1c1a17}
    .placar b{font-size:16pt;display:block;line-height:1}.placar span{font-size:9pt;color:#6b655b}
    h2{font-size:14pt;border-bottom:1.5px solid #1c1a17;padding-bottom:3px;margin:20px 0 8px}
    h3{font-size:12pt;margin:14px 0 6px;color:#6b655b;text-transform:uppercase;letter-spacing:.05em}
    h4{font-size:10.5pt;margin:8px 0 2px}
    ul,ol{margin:4px 0 8px;padding-left:20px} li{margin:2px 0}
    .mini{font-size:9.5pt;columns:1;margin:0 0 6px} .cols{columns:2;column-gap:24px} .cols h4{break-after:avoid}
    .ia p{margin:4px 0} .ia h3{text-transform:none;letter-spacing:0;color:#1c1a17;font-size:12pt;margin:12px 0 4px}
    .rodape{margin-top:24px;font-size:9pt;color:#6b655b;border-top:1px solid #d9d2c2;padding-top:6px}
    @page{margin:14mm} @media print{.cols{columns:2}}
  </style></head><body>
  <h1>Análise de xadrez — ${esc(nick)}</h1>
  <p class="sub">Chess.com · ${esc(rotulo)} · modalidade: ${TIPO[aba]}</p>
  <div class="placar">
    <div><b>${$('nw').textContent}</b><span>vitórias</span></div>
    <div><b>${$('nd').textContent}</b><span>empates</span></div>
    <div><b>${$('nl').textContent}</b><span>derrotas</span></div>
    <div><b>${$('nr').textContent}</b><span>rating</span></div>
    <div><b>${esc($('rpct').textContent.replace(' de aproveitamento','') || '–')}</b><span>aproveitamento</span></div>
    <div style="align-self:center;color:#6b655b;font-size:10pt">${esc($('rating').textContent.trim())}</div>
  </div>
  ${iaTexto ? `<h2>Análise</h2><div class="ia">${mdParaHtml(iaTexto)}</div>` : ''}
  ${achados ? `<h2>Achados automáticos</h2><ul>${achados}</ul>` : ''}
  <h2>Indicadores</h2>${secoes}
  <p class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')} a partir da API pública do Chess.com.</p>
  <scr` + `ipt>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</scr` + `ipt>
  </body></html>`;
  const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
  const w = window.open(url, '_blank');
  if (!w) { iaErro = 'O navegador bloqueou a janela; libere pop-ups para este arquivo.'; renderKpis(); return; }
  iaErro = 'Na janela de impressão, escolha "Salvar como PDF" e desmarque "Cabeçalhos e rodapés" para um resultado limpo.'; renderKpis();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$('kpiGrid').addEventListener('change', e => {
  if (e.target.id === 'iaModelo') gravarLS(modeloLS(provAtual()), e.target.value);
  if (e.target.id === 'iaProv') { gravarChave(provAtual(), $('iaChave').value.trim()); gravarLS('placar-chesscom:provedor', e.target.value); iaErro = ''; renderKpis(); }
  if (e.target.id === 'iaLembrar') {
    gravarLS('placar-chesscom:lembrarChave', e.target.checked ? '1' : '0');
    if (e.target.checked) gravarChave(provAtual(), $('iaChave').value.trim()); else esquecerChaves();
    renderKpis();
  }
});
