// Carrega os scripts do app em Node, na ordem do index.html, sobre um DOM mínimo de mentira: o suficiente para o código
// que roda durante a carga (listeners, leituras de $('id')) não quebrar. O alvo dos testes são as funções puras —
// periodo, parsePGN, fenDaAbertura, montarPartidas, erros… — que não tocam a tela. Nada aqui é dependência: é node:test.
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..');

// elemento de mentira: aceita qualquer leitura/escrita e ignora listeners; um por id, para os testes poderem
// definir $('periodo').value e afins
const elementos = new Map();
const elemento = id => {
  if (!elementos.has(id)) elementos.set(id, {
    id, value: '', checked: false, hidden: false, disabled: false, textContent: '', innerHTML: '', title: '', className: '',
    style: {}, dataset: {}, children: [],
    classList: {toggle() {}, add() {}, remove() {}, contains() { return false; }},
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; },
    insertAdjacentHTML() {}, reportValidity() { return true; }, focus() {}, click() {}, getBoundingClientRect() { return {top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0}; },
  });
  return elementos.get(id);
};
const armazem = new Map();
// defineProperty porque alguns globais do Node (navigator) são só leitura
const globais = {
  window: globalThis,
  document: {getElementById: elemento, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: elemento('body'), documentElement: Object.assign(elemento('html'), {clientWidth: 1280}), createElement: () => elemento('_' + Math.random()), hidden: false},
  localStorage: {getItem: k => armazem.has(k) ? armazem.get(k) : null, setItem: (k, v) => armazem.set(k, String(v)), removeItem: k => armazem.delete(k)},
  location: {protocol: 'http:', href: 'http://localhost/index.html', search: ''},
  history: {replaceState() {}},
  navigator: {userAgent: 'node', clipboard: {writeText: async () => {}}},
  addEventListener() {}, getComputedStyle: () => ({getPropertyValue: () => ''}), innerWidth: 1280, innerHeight: 800, scrollY: 0,
  fetch: async () => { throw new Error('sem rede nos testes'); },
};
for (const [k, v] of Object.entries(globais)) Object.defineProperty(globalThis, k, {value: v, configurable: true, writable: true});

// os <script src> do index.html, na ordem — a mesma regra de carga do navegador
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(s => !s.startsWith('vendor/stockfish'));
for (const s of scripts) vm.runInThisContext(fs.readFileSync(path.join(raiz, s), 'utf8'), {filename: s});

module.exports = {elemento, armazem, scripts};
