// Constantes, helpers de formatação e de HTML, acesso à API (getJSON) e o estado global compartilhado pelos outros módulos.
const API = 'https://api.chess.com/pub/player/';
const $ = id => document.getElementById(id);
const BOT = /bot|coach|engine|computer|komodo|stockfish|maia/i;
const ehBot = (g, nick) => { const adv = g.white.username.toLowerCase() === nick ? g.black : g.white; return BOT.test(adv.username) || !adv.uuid; };
const DRAWS = new Set(['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient']);
const TIPO = {bullet:'bullet', blitz:'blitz', rapid:'rápida', daily:'diária'};
const MOTIVO = {checkmated:'mate', resigned:'desistência', timeout:'tempo', abandoned:'abandono', lose:'derrota',
  agreed:'acordo', repetition:'repetição', stalemate:'afogamento', insufficient:'material insuficiente', '50move':'50 lances', timevsinsufficient:'tempo × material'};
const fmt = new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'});
const fmtDia = new Intl.DateTimeFormat('pt-BR', {dateStyle:'short'});
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', {day:'2-digit', month:'2-digit'});
const hora = () => new Intl.DateTimeFormat('pt-BR', {timeStyle:'medium'}).format(new Date());
const sinal = n => n > 0 ? `+${n}` : `${n}`;
const escHtml = s => String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const cls = n => n > 0 ? 'w' : n < 0 ? 'l' : '';
const controle = tc => {
  if (tc.includes('/')) return `${Math.round(tc.split('/')[1] / 86400)} dia(s)/lance`;
  const [base, inc] = tc.split('+').map(Number);
  if (isNaN(base)) return tc;
  const min = base % 60 ? (base / 60).toFixed(1) : base / 60;
  return inc ? `${min}+${inc}` : `${min} min`;
};
const cache = new Map();
let ocupado = false, timer = null, tick = null, pagina = 1, jogosAtuais = [], nickAtual = '', aba = 'rapid', falhou = false;
let estado = null;

const cor = nome => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

async function getJSON(url, tentativa = 0){
  const c = cache.get(url);
  let r;
  try { r = await fetch(url, {headers: c?.etag ? {'If-None-Match': c.etag} : {}}); }
  catch (e) { if (tentativa < 3) { await new Promise(x => setTimeout(x, 1000 * 2 ** tentativa)); return getJSON(url, tentativa + 1); } throw new Error('Sem conexão com a API do Chess.com.'); }
  if ((r.status === 429 || r.status >= 500) && tentativa < 3) { await new Promise(x => setTimeout(x, 1500 * 2 ** tentativa)); return getJSON(url, tentativa + 1); }
  if (r.status === 304 && c) return c.data;
  // o Chess.com responde 404 também quando bloqueia o navegador por excesso de requisições;
  // quem chama distingue pelo status, já que só ele sabe se o nick já funcionou antes
  if (!r.ok) throw Object.assign(new Error(
    r.status === 404 ? 'Nick não encontrado.' :
    r.status === 429 ? 'Muitas requisições. Aguarde e tente de novo.' : `Erro ${r.status} na API.`), {status: r.status});
  const data = await r.json();
  cache.set(url, {etag: r.headers.get('ETag'), data});
  return data;
}

const linha = (label, s) => {
  const n = s.w + s.d + s.l, ap = n ? (s.w + s.d/2) / n * 100 : 0;
  return `<tr><td>${label}</td><td><span class="pct"><i style="width:${ap}%"></i></span><b>${Math.round(ap)}%</b> <small>${s.w}-${s.d}-${s.l}</small></td></tr>`;
};
const conta = (obj, k, r) => { (obj[k] ??= {w:0,d:0,l:0})[r]++; };
const ajuda = titulo => { const chave = Object.keys(GLOSSARIO).find(k => titulo.replace(/<[^>]+>/g, '').trim().startsWith(k)); return chave ? `<span class="ajuda" title="${GLOSSARIO[chave].replace(/"/g, '&quot;')}">?</span>` : ''; };
const card = (titulo, corpo, extra='') => `<div class="kpi box ${extra}"><h2>${titulo}${ajuda(titulo)}</h2>${corpo}</div>`;
const grupo = t => `<div class="grupo">${t}</div>`;
const tabela = rows => `<table>${rows}</table>`;
const kv = (k, v) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`;
const media = arr => arr.length ? (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1) : '–';
const n0 = obj => Object.keys(obj).map(k => linha(k, obj[k])).join('');
const ordem = (obj, keys) => keys.filter(k => obj[k]).map(k => linha(k, obj[k])).join('');
const vazio = '<small>Sem dados</small>';
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const DIA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const chaveMes = d => `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
const chaveDia = d => d.toLocaleDateString('pt-BR');
const SESSAO = 30 * 60;
const numerar = san => san.map((mv, i) => (i % 2 ? '' : `${i/2 + 1}.`) + mv).join(' ');
const seg = t => t == null ? '–' : t >= 3600 ? `${Math.floor(t/3600)}h${String(Math.floor(t%3600/60)).padStart(2,'0')}` : `${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`;

let kpiData = null, abaKpi = 'Análise', iaTexto = '', iaErro = '', iaOcupado = false, iaMeta = null, curvaDados = {}, modalTc = null;
// versão do esquema de `estado` gravado no armazém: mudar quando um campo passar a ser obrigatório para render(); busca salva com
// versão diferente é ignorada (refaz da API) em vez de ser lida com defaults improvisados
const VERSAO_ESTADO = 2;
const lerLS = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
// quantas partidas recentes vão linha a linha para a IA e entram na fila do motor (motor.js e ia.js leem daqui)
const N_DOSSIE = 100, TAMANHOS_DOSSIE = [100, 200, 300];
const nDossie = () => { const n = +lerLS('placar-chesscom:nDossie', N_DOSSIE); return TAMANHOS_DOSSIE.includes(n) ? n : N_DOSSIE; };
