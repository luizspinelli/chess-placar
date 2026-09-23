// Armazém local: IndexedDB com espelho em memória. Três coleções — buscas (chave = chaveBusca), evals (chave = url da
// partida) e relatorios (chave = "nick|modalidade"). As leituras são síncronas, do espelho, para que kpis(), evalsDe() e
// render() continuem simples; as escritas atualizam o espelho na hora e o IndexedDB em segundo plano. Sem IndexedDB
// (navegador antigo, modo privado que o bloqueia, Node dos testes) o espelho vive só em memória e `armazem.falhou` avisa.
// Preferências pequenas (tema, chaves, profundidade…) continuam no localStorage, síncrono e suficiente para elas.
const ARMAZEM_BD = 'placar-chesscom', ARMAZEM_COLECOES = ['buscas', 'evals', 'relatorios'];
const armazem = {
  dados: {buscas: {}, evals: {}, relatorios: {}},
  bd: null, falhou: false, erro: '', pronto: null,
  ler(colecao, chave){ return this.dados[colecao][chave]; },
  todos(colecao){ return this.dados[colecao]; },
  gravar(colecao, chave, valor){ this.dados[colecao][chave] = valor; return this._op(colecao, s => s.put(valor, chave)); },
  apagar(colecao, chave){ delete this.dados[colecao][chave]; return this._op(colecao, s => s.delete(chave)); },
  // mantém só as N entradas mais recentes por `quando` (ou `t`), apagando as demais
  podar(colecao, n){ const d = this.dados[colecao], chaves = Object.keys(d); if (chaves.length <= n) return; for (const k of chaves.sort((a, b) => (d[b].quando ?? d[b].t ?? 0) - (d[a].quando ?? d[a].t ?? 0)).slice(n)) this.apagar(colecao, k); },
  async _op(colecao, fn){
    await this.pronto;
    if (!this.bd) return false;
    try {
      await new Promise((res, rej) => { const tx = this.bd.transaction(colecao, 'readwrite'); fn(tx.objectStore(colecao)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('transação abortada')); });
      return true;
    } catch (e) { this.falhou = true; this.erro = e?.message || String(e); return false; }
  },
};
armazem.pronto = (async () => {
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error('IndexedDB indisponível');
    armazem.bd = await new Promise((res, rej) => {
      const req = indexedDB.open(ARMAZEM_BD, 1);
      req.onupgradeneeded = () => { for (const c of ARMAZEM_COLECOES) if (!req.result.objectStoreNames.contains(c)) req.result.createObjectStore(c); };
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error || new Error('não abriu')); req.onblocked = () => rej(new Error('bloqueado por outra aba'));
    });
    for (const c of ARMAZEM_COLECOES) armazem.dados[c] = await new Promise((res, rej) => {
      const tx = armazem.bd.transaction(c, 'readonly'), st = tx.objectStore(c), chaves = st.getAllKeys(), valores = st.getAll(), out = {};
      tx.oncomplete = () => { chaves.result.forEach((k, i) => { out[k] = valores.result[i]; }); res(out); }; tx.onerror = () => rej(tx.error);
    });
    // migração: versões anteriores guardavam as avaliações e a última busca no localStorage
    const bdPronto = armazem.bd; armazem.bd = null;   // as gravações abaixo vão direto ao espelho; o IndexedDB recebe em lote
    let evalsLS = null, ultimaLS = null;
    try { evalsLS = JSON.parse(localStorage.getItem('placar-chesscom:evals') || 'null'); ultimaLS = JSON.parse(localStorage.getItem('placar-chesscom:ultima') || 'null'); } catch {}
    armazem.bd = bdPronto;
    if (evalsLS && typeof evalsLS === 'object') { for (const [url, rec] of Object.entries(evalsLS)) if (!armazem.dados.evals[url]) armazem.gravar('evals', url, rec); try { localStorage.removeItem('placar-chesscom:evals'); } catch {} }
    if (ultimaLS?.chave && ultimaLS.estado) { if (!armazem.dados.buscas[ultimaLS.chave]) armazem.gravar('buscas', ultimaLS.chave, {quando: ultimaLS.quando, estado: ultimaLS.estado, versao: 1}); try { localStorage.removeItem('placar-chesscom:ultima'); } catch {} }
  } catch (e) { armazem.falhou = true; armazem.erro = e?.message || String(e); armazem.bd = null; }
})();
