// Estado do app: tudo em centavos (inteiros) e datas 'AAAA-MM-DD'.
// Salvo neste aparelho a cada alteração; cada mudança entra no histórico e pode ser desfeita.
import {ehAntigo, migrar} from './migracao.js';

export const CHAVE = 'septim-v2';
export const CHAVE_ANTIGA = 'painel-financas-v1';      // painel antigo: fica guardado como estava, de reserva
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// categorias iniciais; 'sistema' não pode ser apagada (usada pelos pagamentos de dívida)
const CAT = (id, nome, tipo, cor, icone, sistema = false) => ({id, nome, tipo, cor, icone, sistema});
export const CATEGORIAS_PADRAO = [
  CAT('salario', 'Salário', 'receita', '#5FBF92', 'briefcase'),
  CAT('freelance', 'Freelance', 'receita', '#7FB3E6', 'laptop'),
  CAT('vendas', 'Vendas', 'receita', '#E0B44C', 'shopping-bag'),
  CAT('rendimentos', 'Rendimentos', 'receita', '#9B7BDA', 'trending-up'),
  CAT('aluguel-rec', 'Aluguel recebido', 'receita', '#56C2C9', 'key-round'),
  CAT('outros-rec', 'Outros', 'receita', '#8E87A3', 'circle-plus'),
  CAT('alimentacao', 'Alimentação', 'despesa', '#E0B44C', 'utensils'),
  CAT('moradia', 'Moradia', 'despesa', '#9B7BDA', 'house'),
  CAT('agua', 'Água', 'despesa', '#56A6E0', 'droplet'),
  CAT('energia', 'Energia', 'despesa', '#F2C94C', 'zap'),
  CAT('internet', 'Internet', 'despesa', '#7C8CF0', 'wifi'),
  CAT('transporte', 'Transporte', 'despesa', '#4F74C8', 'bus'),
  CAT('combustivel', 'Combustível', 'despesa', '#D9822B', 'fuel'),
  CAT('saude', 'Saúde', 'despesa', '#E06C8A', 'heart-pulse'),
  CAT('educacao', 'Educação', 'despesa', '#5FBF92', 'graduation-cap'),
  CAT('lazer', 'Lazer', 'despesa', '#56C2C9', 'gamepad-2'),
  CAT('compras', 'Compras', 'despesa', '#C77DDB', 'shopping-cart'),
  CAT('assinaturas', 'Assinaturas', 'despesa', '#B794F4', 'repeat'),
  CAT('impostos', 'Impostos', 'despesa', '#C0574B', 'landmark'),
  CAT('dividas', 'Dívidas', 'despesa', '#A63D33', 'hand-coins', true),
  CAT('outros-desp', 'Outros', 'despesa', '#8E87A3', 'circle-ellipsis'),
];

export const COLECOES = ['categorias', 'contas', 'transacoes', 'transferencias', 'recorrencias', 'cartoes', 'compras',
  'pagamentosFatura', 'metas', 'investimentos', 'dividas'];
// listas dentro de cada item que também têm id (depósitos de meta, pagamentos de dívida…)
export const SUBLISTAS = ['depositos', 'pagamentos', 'movimentos', 'atualizacoes'];

export function novoEstado(){
  return {
    versao: 2,
    config: {nome: '', foto: '', tema: 'auto', formatoData: 'dd/mm/aaaa', ocultarValores: false, diasAviso: 3,
      avisos: {vencimento: true, atrasadas: true, faturas: true, limite: true, orcamento: true, metas: true, receitas: true}},
    categorias: CATEGORIAS_PADRAO.map(c => ({...c})),
    contas: [], transacoes: [], transferencias: [], recorrencias: [], cartoes: [], compras: [], pagamentosFatura: [],
    orcamento: {total: 0, limites: {}},
    metas: [], investimentos: [], dividas: [],
    historico: [], lidas: {}, apagados: {}, atualizadoEm: 0,
  };
}

// junta o que veio (arquivo, Drive, versão antiga) com os campos que faltarem, sem confiar no formato
export function completar(e){
  if(ehAntigo(e)) e = migrar(e, novoEstado);
  const base = novoEstado();
  if(!e || typeof e !== 'object') return base;
  const out = {...base, ...e, versao: 2, config: {...base.config, ...(e.config || {}), avisos: {...base.config.avisos, ...((e.config || {}).avisos || {})}}};
  COLECOES.forEach(k => { out[k] = Array.isArray(e[k]) ? e[k].filter(x => x && typeof x === 'object' && x.id) : base[k]; });
  if(!out.categorias.length) out.categorias = base.categorias;
  // garante a categoria de sistema
  if(!out.categorias.some(c => c.id === 'dividas')) out.categorias.push({...CATEGORIAS_PADRAO.find(c => c.id === 'dividas')});
  out.orcamento = {total: inteiro(e.orcamento && e.orcamento.total), limites: {...((e.orcamento && e.orcamento.limites) || {})}};
  out.historico = Array.isArray(e.historico) ? e.historico.slice(0, 500) : [];
  out.lidas = e.lidas && typeof e.lidas === 'object' ? e.lidas : {};
  out.apagados = e.apagados && typeof e.apagados === 'object' ? e.apagados : {};
  out.atualizadoEm = Number(e.atualizadoEm) || 0;
  return out;
}
const inteiro = v => Number.isFinite(+v) ? Math.round(+v) : 0;
export const vazio = e => !COLECOES.filter(k => k !== 'categorias').some(k => e[k].length);

/* ================= neste aparelho ================= */
let LS = null;
try{ LS = window.localStorage; LS.setItem('__t', '1'); LS.removeItem('__t'); }catch(e){ LS = null; }
export const loc = {
  get(k){ try{ return LS ? LS.getItem(k) : null; }catch(e){ return null; } },
  set(k, v){ try{ if(LS) LS.setItem(k, v); return !!LS; }catch(e){ return false; } },
  del(k){ try{ if(LS) LS.removeItem(k); }catch(e){} },
};
export const temArmazenamento = () => !!LS;

// primeiro abre o formato novo; se só houver o painel antigo, converte (o antigo fica guardado como estava)
function carregar(){
  try{
    const novo = loc.get(CHAVE);
    if(novo) return completar(JSON.parse(novo));
    const antigo = loc.get(CHAVE_ANTIGA);
    if(antigo){ const e = completar(JSON.parse(antigo)); loc.set(CHAVE, JSON.stringify(e)); return e; }
  }catch(e){ console.warn('dados ilegíveis', e); }
  return novoEstado();
}

export let estado = carregar();
const ouvintes = [];
// origem: 'local' (você mexeu) ou 'nuvem' (veio do Drive, não precisa subir de novo)
export const aoMudar = fn => ouvintes.push(fn);
const avisar = origem => ouvintes.forEach(fn => fn(origem));

export function salvar(){
  try{ localStorage.setItem(CHAVE, JSON.stringify(estado)); return true; }catch(e){ console.warn('não foi possível salvar', e); return false; }
}

// todos os ids, inclusive os de dentro dos itens: o que some vira "apagado" para a sincronização respeitar
function ids(e){
  const s = new Set();
  COLECOES.forEach(k => e[k].forEach(x => { s.add(x.id); SUBLISTAS.forEach(n => (x[n] || []).forEach(y => y && y.id && s.add(y.id))); }));
  return s;
}
function registrarApagados(antes, depois){
  const agora = Date.now();
  antes.forEach(id => { if(!depois.has(id)) estado.apagados[id] = agora; });
  depois.forEach(id => { if(estado.apagados[id]) delete estado.apagados[id]; });
}
function marcar(texto){
  estado.historico.unshift({id: uid(), quando: Date.now(), texto});
  estado.historico.length = Math.min(estado.historico.length, 500);
  estado.atualizadoEm = Date.now();
}

// toda operação passa por aqui: guarda a foto para desfazer, registra no histórico, salva e redesenha
export function alterar(texto, fn){
  const foto = JSON.stringify(estado), antes = ids(estado);
  fn(estado);
  registrarApagados(antes, ids(estado));
  marcar(texto); salvar(); avisar('local');
  return foto;
}
export function restaurar(foto, texto = 'Desfeito'){
  const hist = estado.historico, apag = estado.apagados, antes = ids(estado);
  estado = completar(JSON.parse(foto));
  estado.historico = hist; estado.apagados = {...apag, ...estado.apagados};
  registrarApagados(antes, ids(estado));
  marcar(texto); salvar(); avisar('local');
}
export function substituir(novo, texto){
  const antes = ids(estado), apag = estado.apagados;
  estado = completar(novo);
  estado.apagados = {...apag, ...estado.apagados};
  registrarApagados(antes, ids(estado));
  marcar(texto); salvar(); avisar('local');
}
// estado vindo do Drive (já juntado): troca sem registrar como alteração sua
export function definirRemoto(novo){
  estado = completar(novo); salvar(); avisar('nuvem');
}
export const redesenhar = () => avisar('tela');

// achar por id em qualquer coleção
export const achar = (colecao, id) => estado[colecao].find(x => x.id === id);
export const categoria = id => achar('categorias', id) || {id, nome: 'Sem categoria', cor: '#8E87A3', icone: 'circle', tipo: 'despesa'};

/* ================= juntar duas versões (sincronização) =================
   nada lançado se perde; o que foi apagado em qualquer lado continua apagado;
   o mesmo item alterado nos dois lados fica com a versão mais recente, somando os registros internos (depósitos, pagamentos…) */
export function mesclar(a, b){
  a = completar(a); b = completar(b);
  const novo = a.atualizadoEm >= b.atualizadoEm ? a : b, velho = novo === a ? b : a;
  const apag = {...b.apagados, ...a.apagados}, vivo = x => x && !apag[x.id];
  const uniao = (ln, lv) => { const m = new Map(); (lv || []).forEach(x => m.set(x.id, x)); (ln || []).forEach(x => m.set(x.id, x)); return [...m.values()].filter(vivo); };
  const r = {...novo, apagados: apag, atualizadoEm: Math.max(a.atualizadoEm, b.atualizadoEm)};
  COLECOES.forEach(k => {
    const doVelho = new Map(velho[k].map(x => [x.id, x]));
    r[k] = uniao(novo[k], velho[k]).map(x => {
      const v = doVelho.get(x.id); if(!v || v === x) return x;
      const y = {...x};
      SUBLISTAS.forEach(n => { if(Array.isArray(x[n]) || Array.isArray(v[n])) y[n] = uniao(x[n], v[n]).sort((p, q) => String(p.data || '').localeCompare(String(q.data || ''))); });
      if(Array.isArray(x.gerados) || Array.isArray(v.gerados)) y.gerados = [...new Set([...(x.gerados || []), ...(v.gerados || [])])];
      return y;
    });
  });
  r.lidas = {...velho.lidas, ...novo.lidas};
  const hist = new Map([...velho.historico, ...novo.historico].map(h => [h.id, h]));
  r.historico = [...hist.values()].sort((p, q) => q.quando - p.quando).slice(0, 500);
  return r;
}
