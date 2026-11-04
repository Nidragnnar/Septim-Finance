// Converte os dados do painel antigo (um mês por vez, valores em reais) para o formato novo.
// Os ids saem sempre iguais para os mesmos dados: dois aparelhos convertendo o mesmo arquivo chegam ao mesmo resultado,
// e a sincronização não duplica nada.

const MES_OK = /^\d{4}-\d{2}$/;
const n0 = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const cent = v => Math.round(n0(v) * 100);
const lista = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && x.id != null) : [];
const p2 = n => String(n).padStart(2, '0');
const diasNoMes = (a, m) => new Date(a, m, 0).getDate();
const somaMes = (k, n) => { const [a, m] = k.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; };
const dataDe = (k, dia) => { const [a, m] = k.split('-').map(Number); return `${k}-${p2(Math.min(Math.max(1, dia | 0 || 1), diasNoMes(a, m)))}`; };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

export const ehAntigo = e => !!e && typeof e === 'object' && !Array.isArray(e.transacoes) && (e.meses || e.renda != null || Array.isArray(e.contas) && e.contas.some(c => c && c.dia != null && c.saldoInicial == null));

// categorias do painel antigo → novo
const CAT = {mercado: 'mercado', comidafora: 'comida-fora', transporte: 'transporte', casa: 'moradia', saude: 'saude', lazer: 'lazer', outros: 'outros-desp'};
const EXTRAS_CAT = [
  {id: 'mercado', nome: 'Mercado', tipo: 'despesa', cor: '#3E8E74', icone: 'shopping-basket', sistema: false},
  {id: 'comida-fora', nome: 'Comida fora', tipo: 'despesa', cor: '#D29A3A', icone: 'pizza', sistema: false},
];
// categoria de uma conta fixa pelo nome
function catDaConta(nome){
  const n = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return /alug|condom|moradia|casa/.test(n) ? 'moradia' : /luz|energia|copel|celesc|cemig|enel/.test(n) ? 'energia' : /agua|sanepar|sabesp/.test(n) ? 'agua'
    : /internet|net\b|wifi|fibra/.test(n) ? 'internet' : /celular|tim|vivo|claro|oi\b/.test(n) ? 'assinaturas' : /escola|faculdade|curso|senai/.test(n) ? 'educacao'
    : /netflix|spotify|prime|disney|assinatura|streaming/.test(n) ? 'assinaturas' : /academia|plano de saude|unimed/.test(n) ? 'saude' : 'outros-desp';
}

// novoEstado e o id da conta vêm de quem chama, para não haver import circular
export function migrar(velho, novoEstado){
  const e = novoEstado(), h = hojeISO(), kHoje = h.slice(0, 7);
  const contaId = 'conta-principal';
  const meses = velho.meses && typeof velho.meses === 'object' ? velho.meses : {};
  const chaves = Object.keys(meses).filter(k => MES_OK.test(k)).sort();
  const contas = lista(velho.contas), dividas = lista(velho.dividas);
  // começa no primeiro mês em que você registrou algo (contas fixas antes disso apareceriam como atrasadas à toa)
  const primeiro = chaves[0] || [...contas.map(c => c.desde)].filter(k => MES_OK.test(k || '')).sort()[0] || kHoje;
  const ate = kHoje;                                           // gera até o mês atual; as repetições cuidam do resto
  const mesesAte = fim => { const out = []; for(let k = primeiro; k <= fim && out.length < 600; k = somaMes(k, 1)) out.push(k); return out; };
  const m = k => meses[k] || {};
  const usadas = new Set();

  e.config.tema = velho.tema === 'claro' || velho.tema === 'escuro' ? velho.tema : 'auto';
  e.config.migradoEm = Date.now();
  e.contas.push({id: contaId, nome: 'Conta principal', instituicao: '', tipo: 'corrente', saldoInicial: 0, cor: '#6A3FBF', arquivada: false, criadoEm: Date.now()});

  // renda fixa do mês → salário que repete todo mês (recebido nos meses que já passaram)
  const renda = cent(velho.renda);
  if(renda > 0){
    const r = {id: 'rec-renda', tipo: 'receita', descricao: 'Salário', valor: renda, categoriaId: 'salario', contaId, forma: '', origem: '', obs: '',
      frequencia: 'mensal', inicio: primeiro + '-01', dia: 1, fim: '', ativa: true, gerados: []};
    mesesAte(ate).forEach(k => {
      r.gerados.push(k);
      e.transacoes.push({id: `${r.id}:${k}`, tipo: 'receita', descricao: 'Salário', valor: renda, categoriaId: 'salario', contaId, data: k + '-01', pagoEm: k + '-01', forma: '', origem: '', recorrenciaId: r.id, criadoEm: 0});
    });
    e.recorrencias.push(r);
  }
  // entradas extras de cada mês → receitas recebidas
  chaves.forEach(k => lista(m(k).extras).forEach(x => {
    if(cent(x.valor) <= 0) return;
    e.transacoes.push({id: String(x.id), tipo: 'receita', descricao: String(x.nome || 'Entrada extra'), valor: cent(x.valor), categoriaId: 'outros-rec', contaId, data: k + '-01', pagoEm: k + '-01', forma: '', origem: '', criadoEm: 0});
  }));
  // contas fixas → despesas que repetem todo mês, com o valor e o pagamento de cada mês
  contas.forEach(c => {
    const ini = MES_OK.test(c.desde || '') ? c.desde : primeiro, fim = MES_OK.test(c.ate || '') ? c.ate : '';
    const dia = Math.min(31, Math.max(1, c.dia | 0 || 1)), cat = catDaConta(c.nome);
    const r = {id: 'rec-' + c.id, tipo: 'despesa', descricao: String(c.nome || 'Conta fixa'), valor: cent(c.valor), categoriaId: cat, contaId, forma: '', origem: '', obs: '',
      frequencia: 'mensal', inicio: dataDe(ini, dia), dia, fim: fim ? dataDe(fim, 31) : '', ativa: !fim || fim >= kHoje, gerados: []};
    mesesAte(ate).filter(k => k >= ini && (!fim || k <= fim)).forEach(k => {
      const mm = m(k), valores = mm.valores || {}, pagas = Array.isArray(mm.pagas) ? mm.pagas.map(String) : [], pagoEm = mm.pagoEm || {};
      r.gerados.push(k);
      e.transacoes.push({id: `${r.id}:${k}`, tipo: 'despesa', descricao: r.descricao, valor: valores[c.id] != null ? cent(valores[c.id]) : r.valor, categoriaId: cat, contaId,
        data: dataDe(k, dia), pagoEm: pagas.includes(String(c.id)) ? dataDe(k, pagoEm[c.id] || dia) : null, forma: '', origem: '', recorrenciaId: r.id, criadoEm: 0});
    });
    e.recorrencias.push(r);
  });
  // dívidas → dívidas com parcelas; as já pagas antes do app entram no histórico sem mexer no saldo
  dividas.forEach(d => {
    const total = Math.max(1, d.total | 0), antes = Math.min(total, Math.max(0, d.pagas | 0)), dia = 10;
    const marcadas = [];
    chaves.forEach(k => { const q = Math.max(0, (m(k).parcelas || {})[d.id] | 0); for(let i = 0; i < q && antes + marcadas.length < total; i++){
      const dt = dataDe(k, dia);
      marcadas.push({id: `pg-${d.id}-${k}-${i}`, valor: cent(d.valor), data: dt > h ? h : dt, contaId});
    } });
    // o painel antigo não sabia o mês da 1ª parcela: considera que você está em dia (a próxima vence este mês, ou no próximo se já pagou este)
    const p = antes + marcadas.length, pagouEste = marcadas.some(x => x.data.slice(0, 7) === kHoje);
    const inicio = somaMes(kHoje, -(pagouEste ? p - 1 : p));
    const pagamentos = [...Array.from({length: antes}, (_, i) => ({id: `pg-${d.id}-a${i}`, valor: cent(d.valor), data: dataDe(somaMes(inicio, i), dia), contaId: '', anterior: true})), ...marcadas];
    e.dividas.push({id: String(d.id), credor: String(d.nome || 'Dívida'), descricao: '', valorOriginal: cent(d.valor) * total, juros: 0, parcelas: total, valorParcela: cent(d.valor),
      inicio, diaVencimento: dia, pagamentos, criadoEm: 0});
  });
  // gastos do dia a dia → despesas pagas (os ids do extrato importado continuam os mesmos)
  chaves.forEach(k => lista(m(k).gastos).forEach(g => {
    if(cent(g.valor) <= 0) return;
    const cat = CAT[g.cat] || 'outros-desp';
    if(cat === 'mercado' || cat === 'comida-fora') usadas.add(cat);
    const dt = dataDe(k, g.dia);
    e.transacoes.push({id: String(g.id), tipo: 'despesa', descricao: String(g.desc || 'Gasto'), valor: cent(g.valor), categoriaId: cat, contaId, data: dt, pagoEm: dt, forma: '', origem: '', criadoEm: n0(g.ordem)});
  }));
  EXTRAS_CAT.filter(c => usadas.has(c.id)).forEach(c => e.categorias.push({...c}));
  // quanto queria guardar por mês: vira limite total do orçamento (renda − guardar), só como ponto de partida
  if(cent(velho.guardar) > 0 && renda > cent(velho.guardar)) e.orcamento = {total: renda - cent(velho.guardar), limites: {}};
  e.historico = [{id: 'migracao', quando: Date.now(), texto: 'Dados trazidos do painel antigo'}];
  e.atualizadoEm = n0(velho.atualizadoEm);
  return e;
}
