// Cálculos: datas, saldos, faturas, dívidas, investimentos, orçamento, recorrências e avisos.
// Nada aqui grava; só lê o estado.
import {estado, uid, categoria} from './dados.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ================= datas ================= */
const p2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => window.__hoje || iso(new Date());
export const diasNoMes = (a, m) => new Date(a, m, 0).getDate();               // m de 1 a 12
// dia que não existe no mês (31 em abril) cai no último dia
export const dataDe = (a, m, d) => { const x = new Date(a, m - 1, 1); return iso(new Date(x.getFullYear(), x.getMonth(), Math.min(d, diasNoMes(x.getFullYear(), x.getMonth() + 1)))); };
export const partes = s => s.split('-').map(Number);
export const somaMeses = (s, n, dia) => { const [a, m, d] = partes(s); return dataDe(a, m + n, dia || d || 1); };
export const somaDias = (s, n) => { const [a, m, d] = partes(s); return iso(new Date(a, m - 1, d + n)); };
export const chaveMes = s => s.slice(0, 7);
export const inicioMes = k => k.slice(0, 7) + '-01';
export const fimMes = k => { const [a, m] = partes(k); return dataDe(a, m, 31); };
export const difDias = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
export const nomeMes = (k, curto = false) => { const [a, m] = partes(k); const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', {month: curto ? 'short' : 'long'}).replace('.', ''); return curto ? t : t[0].toUpperCase() + t.slice(1) + ' de ' + a; };
export const entre = (d, ini, fim) => d >= ini && d <= fim;

// filtros de período do dashboard e dos relatórios
export const PERIODOS = [['hoje', 'Hoje'], ['7d', 'Últimos 7 dias'], ['mes', 'Este mês'], ['mesAnt', 'Mês anterior'], ['3m', 'Últimos 3 meses'], ['6m', 'Últimos 6 meses'], ['ano', 'Este ano'], ['custom', 'Personalizado']];
export function periodo(tipo, ini, fim){
  const h = hoje(), k = chaveMes(h);
  switch(tipo){
    case 'hoje': return {ini: h, fim: h};
    case '7d': return {ini: somaDias(h, -6), fim: h};
    case 'mesAnt': { const a = somaMeses(inicioMes(k), -1); return {ini: a, fim: fimMes(a)}; }
    case '3m': return {ini: somaMeses(inicioMes(k), -2), fim: fimMes(k)};
    case '6m': return {ini: somaMeses(inicioMes(k), -5), fim: fimMes(k)};
    case 'ano': return {ini: h.slice(0, 4) + '-01-01', fim: h.slice(0, 4) + '-12-31'};
    case 'custom': if(ini && fim && ini <= fim) return {ini, fim};
    // sem datas válidas, cai no mês
    default: return {ini: inicioMes(k), fim: fimMes(k)};
  }
}
// período anterior de mesmo tamanho, para comparar
export function periodoAnterior({ini, fim}){
  if(ini.slice(8) === '01' && fim === fimMes(fim)){
    const meses = (partes(fim)[0] - partes(ini)[0]) * 12 + partes(fim)[1] - partes(ini)[1] + 1;
    const a = somaMeses(ini, -meses); return {ini: a, fim: fimMes(somaMeses(a, meses - 1))};
  }
  const n = difDias(ini, fim) + 1; return {ini: somaDias(ini, -n), fim: somaDias(ini, -1)};
}
// meses (AAAA-MM) que um período cobre
export function mesesDe({ini, fim}){
  const out = []; let k = chaveMes(ini);
  while(k <= chaveMes(fim) && out.length < 120){ out.push(k); k = chaveMes(somaMeses(k + '-01', 1)); }
  return out;
}

/* ================= transações ================= */
export const statusTx = t => t.pagoEm ? 'pago' : t.data < hoje() ? 'atrasado' : 'pendente';
export const rotuloStatus = t => { const s = statusTx(t); return s === 'pago' ? (t.tipo === 'receita' ? 'Recebido' : 'Pago') : s === 'atrasado' ? 'Atrasado' : 'Pendente'; };

/* ================= cartões e faturas ================= */
// a compra feita no dia do fechamento ou depois cai na fatura seguinte
function fechamentoDaCompra(c, data){
  const [a, m, d] = partes(data);
  return d >= c.diaFechamento ? dataDe(a, m + 1, c.diaFechamento) : dataDe(a, m, c.diaFechamento);
}
const vencDoFechamento = (c, fech) => { const [a, m] = partes(fech); return dataDe(a, m + (c.diaVencimento > c.diaFechamento ? 0 : 1), c.diaVencimento); };
// fatura identificada pelo mês do vencimento
export function parcelasDaCompra(compra){
  const c = estado.cartoes.find(x => x.id === compra.cartaoId); if(!c) return [];
  const n = Math.max(1, compra.parcelas | 0), base = Math.floor(compra.valor / n), resto = compra.valor - base * n;
  const f0 = fechamentoDaCompra(c, compra.data), [a, m] = partes(f0);
  return Array.from({length: n}, (_, i) => {
    const fech = dataDe(a, m + i, c.diaFechamento), venc = vencDoFechamento(c, fech);
    return {compra, n: i + 1, total: n, valor: base + (i === 0 ? resto : 0), fechamento: fech, vencimento: venc, fatura: chaveMes(venc)};
  });
}
export function fatura(c, key){
  const itens = estado.compras.filter(x => x.cartaoId === c.id).flatMap(parcelasDaCompra).filter(p => p.fatura === key)
    .sort((x, y) => y.compra.data.localeCompare(x.compra.data));
  const pagamentos = estado.pagamentosFatura.filter(p => p.cartaoId === c.id && p.fatura === key);
  const total = itens.reduce((s, p) => s + p.valor, 0), pago = pagamentos.reduce((s, p) => s + p.valor, 0);
  const [a, m] = partes(key);
  const vencimento = dataDe(a, m, c.diaVencimento);
  const fechamento = dataDe(a, m - (c.diaVencimento > c.diaFechamento ? 0 : 1), c.diaFechamento);
  const h = hoje();
  // futura: ainda não começou a receber compras (a atual é a primeira que fecha depois de hoje)
  const status = !total && !pago ? 'vazia' : key > faturaAtualKey(c) ? 'futura' : h < fechamento ? 'aberta' : pago >= total ? 'paga' : h > vencimento ? 'vencida' : 'fechada';
  return {cartao: c, key, itens, pagamentos, total, pago, restante: Math.max(0, total - pago), fechamento, vencimento, status};
}
export const faturaAtualKey = c => chaveMes(vencDoFechamento(c, fechamentoDaCompra(c, hoje())));
export function faturasDoCartao(c){
  const keys = new Set([faturaAtualKey(c)]);
  estado.compras.filter(x => x.cartaoId === c.id).flatMap(parcelasDaCompra).forEach(p => keys.add(p.fatura));
  estado.pagamentosFatura.filter(p => p.cartaoId === c.id).forEach(p => keys.add(p.fatura));
  return [...keys].sort().map(k => fatura(c, k));
}
// limite usado: tudo que foi comprado (todas as parcelas) menos o que já foi pago
export function limiteUsado(c, ate = hoje()){
  const comprado = estado.compras.filter(x => x.cartaoId === c.id && x.data <= ate).reduce((s, x) => s + x.valor, 0);
  const pago = estado.pagamentosFatura.filter(p => p.cartaoId === c.id && p.data <= ate).reduce((s, p) => s + p.valor, 0);
  return Math.max(0, comprado - pago);
}

/* ================= dívidas ================= */
export const totalDivida = d => d.parcelas && d.valorParcela ? d.parcelas * d.valorParcela : d.valorOriginal;
export const pagoDivida = (d, ate) => (d.pagamentos || []).filter(p => !ate || p.data <= ate).reduce((s, p) => s + p.valor, 0);
export const restanteDivida = (d, ate) => (ate && ate < d.inicio + '-01') ? 0 : Math.max(0, totalDivida(d) - pagoDivida(d, ate));
export function parcelasDivida(d){
  const n = d.parcelas || 0, pagos = (d.pagamentos || []).length;
  return Array.from({length: n}, (_, i) => {
    const [a, m] = partes(d.inicio);
    const venc = dataDe(a, m + i, d.diaVencimento || 1);
    const pag = (d.pagamentos || [])[i];
    return {n: i + 1, vencimento: venc, valor: d.valorParcela, pago: !!pag, pagoEm: pag && pag.data, atrasada: !pag && i >= pagos && venc < hoje()};
  });
}
export const proximaParcela = d => parcelasDivida(d).find(p => !p.pago);

/* ================= investimentos ================= */
export const aplicadoLiquido = (inv, ate) => (inv.movimentos || []).filter(m => !ate || m.data <= ate).reduce((s, m) => s + (m.tipo === 'resgate' ? -m.valor : m.valor), 0);
export function valorInvestimento(inv, ate = hoje()){
  const ups = (inv.atualizacoes || []).filter(u => u.data <= ate).sort((a, b) => a.data.localeCompare(b.data));
  const u = ups[ups.length - 1];
  if(!u) return Math.max(0, aplicadoLiquido(inv, ate));
  // aplicações e resgates depois da última atualização entram por cima do valor informado
  const depois = (inv.movimentos || []).filter(m => m.data > u.data && m.data <= ate).reduce((s, m) => s + (m.tipo === 'resgate' ? -m.valor : m.valor), 0);
  return Math.max(0, u.valor + depois);
}
export const lucroInvestimento = inv => valorInvestimento(inv) - aplicadoLiquido(inv, hoje());

/* ================= metas ================= */
export const acumuladoMeta = m => (m.depositos || []).reduce((s, d) => s + d.valor, 0);
export const pctMeta = m => m.alvo ? Math.min(100, Math.max(0, acumuladoMeta(m) / m.alvo * 100)) : 0;

/* ================= contas: movimentações e saldo ================= */
// tudo que entra e sai de uma conta, com sinal
export function movimentos(contaId){
  const out = [], add = (data, valor, descricao, tipo, ref) => out.push({data, valor, descricao, tipo, ref});
  estado.transacoes.filter(t => t.contaId === contaId && t.pagoEm).forEach(t => add(t.pagoEm, t.tipo === 'receita' ? t.valor : -t.valor, t.descricao, t.tipo, t.id));
  estado.transferencias.forEach(t => {
    if(t.deId === contaId) add(t.data, -t.valor, t.descricao || 'Transferência enviada', 'transferencia', t.id);
    if(t.paraId === contaId) add(t.data, t.valor, t.descricao || 'Transferência recebida', 'transferencia', t.id);
  });
  estado.pagamentosFatura.filter(p => p.contaId === contaId).forEach(p => { const c = estado.cartoes.find(x => x.id === p.cartaoId); add(p.data, -p.valor, 'Fatura ' + (c ? c.nome : 'cartão') + ' · ' + nomeMes(p.fatura, true), 'fatura', p.id); });
  estado.dividas.forEach(d => (d.pagamentos || []).filter(p => p.contaId === contaId).forEach(p => add(p.data, -p.valor, 'Parcela · ' + d.credor, 'divida', p.id)));
  estado.investimentos.forEach(i => (i.movimentos || []).filter(m => m.contaId === contaId).forEach(m => add(m.data, m.tipo === 'resgate' ? m.valor : -m.valor, (m.tipo === 'resgate' ? 'Resgate · ' : 'Aplicação · ') + i.nome, 'investimento', m.id)));
  return out.sort((a, b) => b.data.localeCompare(a.data));
}
export function saldoConta(c, ate){
  return c.saldoInicial + movimentos(c.id).filter(m => !ate || m.data <= ate).reduce((s, m) => s + m.valor, 0);
}
export const saldoTotal = ate => estado.contas.filter(c => !c.arquivada).reduce((s, c) => s + saldoConta(c, ate), 0);

/* ================= receitas e despesas por período ================= */
// despesas por competência: lançamentos pelo vencimento, compras no cartão pelo vencimento da fatura, parcelas de dívida pelo pagamento.
// pagamento de fatura não entra aqui: as compras já contaram.
export function despesasEntre(ini, fim){
  const out = [];
  estado.transacoes.filter(t => t.tipo === 'despesa' && entre(t.data, ini, fim)).forEach(t => out.push({data: t.data, valor: t.valor, categoriaId: t.categoriaId, descricao: t.descricao, origem: 'conta', contaId: t.contaId, tx: t}));
  estado.compras.forEach(c => parcelasDaCompra(c).filter(p => entre(p.vencimento, ini, fim)).forEach(p =>
    out.push({data: p.vencimento, valor: p.valor, categoriaId: c.categoriaId, descricao: c.descricao + (p.total > 1 ? ` (${p.n}/${p.total})` : ''), origem: 'cartao', cartaoId: c.cartaoId, compra: c})));
  estado.dividas.forEach(d => (d.pagamentos || []).filter(p => !p.anterior && entre(p.data, ini, fim)).forEach(p =>
    out.push({data: p.data, valor: p.valor, categoriaId: 'dividas', descricao: 'Parcela · ' + d.credor, origem: 'divida', contaId: p.contaId})));
  return out;
}
export const receitasEntre = (ini, fim) => estado.transacoes.filter(t => t.tipo === 'receita' && entre(t.data, ini, fim));
export const soma = (l, f = x => x.valor) => l.reduce((s, x) => s + f(x), 0);
export function porCategoria(itens){
  const m = {};
  itens.forEach(i => { m[i.categoriaId] = (m[i.categoriaId] || 0) + i.valor; });
  return Object.entries(m).map(([id, valor]) => ({...categoria(id), valor})).sort((a, b) => b.valor - a.valor);
}

// primeiro mês com algum dado: os gráficos de evolução começam nele
export function primeiroMes(){
  const datas = [
    ...estado.contas.map(c => c.criadoEm ? iso(new Date(c.criadoEm)) : hoje()),
    ...estado.transacoes.map(t => t.data), ...estado.transferencias.map(t => t.data), ...estado.compras.map(c => c.data),
    ...estado.dividas.map(d => d.inicio + '-01'), ...estado.investimentos.flatMap(i => (i.movimentos || []).map(m => m.data)),
  ].filter(d => d && d <= hoje());
  return chaveMes(datas.length ? datas.sort()[0] : hoje());
}

/* ================= patrimônio ================= */
export function patrimonio(ate = hoje()){
  const contas = saldoTotal(ate);
  const invest = estado.investimentos.reduce((s, i) => s + valorInvestimento(i, ate), 0);
  const dividas = estado.dividas.reduce((s, d) => s + restanteDivida(d, ate), 0);
  const cartoes = estado.cartoes.reduce((s, c) => s + limiteUsado(c, ate), 0);
  return {contas, invest, dividas, cartoes, total: contas + invest - dividas - cartoes};
}

/* ================= orçamento ================= */
export function orcamentoDoMes(k){
  const gastos = porCategoria(despesasEntre(inicioMes(k), fimMes(k)));
  const lim = estado.orcamento.limites || {};
  const linhas = Object.entries(lim).filter(([, v]) => v > 0).map(([id, limite]) => {
    const gasto = (gastos.find(g => g.id === id) || {}).valor || 0;
    return {...categoria(id), limite, gasto, pct: gasto / limite * 100};
  }).sort((a, b) => b.pct - a.pct);
  const gastoTotal = soma(gastos), total = estado.orcamento.total || linhas.reduce((s, l) => s + l.limite, 0);
  return {linhas, total, gastoTotal, pct: total ? gastoTotal / total * 100 : 0, semLimite: gastos.filter(g => !lim[g.id])};
}

/* ================= recorrências ================= */
// gera os lançamentos até o fim do mês que vem; cada ocorrência só nasce uma vez (mesmo se você apagar)
export function ocorrencias(r, ate){
  const out = [], [a, m] = partes(r.inicio);
  for(let i = 0; i < 600; i++){
    const d = r.frequencia === 'anual' ? dataDe(a + i, m, r.dia) : dataDe(a, m + i, r.dia);
    if(d > ate || (r.fim && d > r.fim)) break;
    if(d >= r.inicio) out.push(d);
  }
  return out;
}
export const limiteRecorrencia = () => fimMes(somaMeses(inicioMes(hoje()), 1));
export function gerarRecorrencias(e){
  let n = 0;
  const ate = limiteRecorrencia();
  e.recorrencias.filter(r => r.ativa !== false).forEach(r => {
    r.gerados = r.gerados || [];
    ocorrencias(r, ate).forEach(d => {
      const key = r.frequencia === 'anual' ? d.slice(0, 4) : chaveMes(d);
      // id fixo por repetição e mês: dois aparelhos gerando o mesmo mês não duplicam, e o que você apagou continua apagado
      const id = `${r.id}:${key}`;
      if(r.gerados.includes(key) || (e.apagados && e.apagados[id]) || e.transacoes.some(t => t.id === id) || e.compras.some(c => c.id === id)){ if(!r.gerados.includes(key)) r.gerados.push(key); return; }
      r.gerados.push(key); n++;
      if(r.cartaoId){ e.compras.push({id, cartaoId: r.cartaoId, descricao: r.descricao, valor: r.valor, parcelas: 1, data: d, categoriaId: r.categoriaId, recorrenciaId: r.id, criadoEm: Date.now()}); return; }
      e.transacoes.push({id, tipo: r.tipo, descricao: r.descricao, valor: r.valor, categoriaId: r.categoriaId, contaId: r.contaId,
        data: d, pagoEm: null, forma: r.forma || '', origem: r.origem || '', recorrenciaId: r.id, criadoEm: Date.now()});
    });
  });
  return n;
}
// previsões além do que já foi gerado (para o calendário)
export function previstasEntre(ini, fim){
  const lim = limiteRecorrencia();
  if(fim <= lim) return [];
  return estado.recorrencias.filter(r => r.ativa !== false).flatMap(r => ocorrencias(r, fim).filter(d => d > lim && d >= ini).map(d => ({r, data: d})));
}

/* ================= avisos ================= */
export function avisos(){
  const cfg = estado.config.avisos, n = estado.config.diasAviso || 3, h = hoje(), lim = somaDias(h, n), out = [];
  const add = (id, nivel, icone, texto, link) => out.push({id, nivel, icone, texto, link});
  const quando = d => d === h ? 'hoje' : d === somaDias(h, 1) ? 'amanhã' : 'em ' + difDias(h, d) + ' dias';
  estado.transacoes.filter(t => !t.pagoEm).forEach(t => {
    if(t.tipo === 'despesa'){
      if(cfg.atrasadas && t.data < h) add('atr:' + t.id, 'perigo', 'alert-triangle', `<b>${esc(t.descricao)}</b> está atrasada desde ${t.data.split('-').reverse().slice(0, 2).join('/')}`, 'despesas');
      else if(cfg.vencimento && entre(t.data, h, lim)) add('ven:' + t.id, 'atencao', 'clock', `<b>${esc(t.descricao)}</b> vence ${quando(t.data)}`, 'despesas');
    } else if(cfg.receitas && entre(t.data, h, lim)) add('rec:' + t.id, 'info', 'arrow-down-left', `Receita prevista: <b>${esc(t.descricao)}</b> ${quando(t.data)}`, 'receitas');
  });
  estado.cartoes.forEach(c => {
    if(cfg.faturas) faturasDoCartao(c).filter(f => f.restante > 0 && f.status !== 'aberta' && f.vencimento <= lim).forEach(f =>
      add('fat:' + c.id + f.key, f.status === 'vencida' ? 'perigo' : 'atencao', 'credit-card', `Fatura <b>${esc(c.nome)}</b> ${f.status === 'vencida' ? 'vencida' : 'vence ' + quando(f.vencimento)}`, 'cartoes'));
    const usado = limiteUsado(c);
    if(cfg.limite && c.limite && usado / c.limite >= .8) add('lim:' + c.id + ':' + (usado >= c.limite ? 100 : 80), usado >= c.limite ? 'perigo' : 'atencao', 'gauge', `Cartão <b>${esc(c.nome)}</b> usou ${Math.round(usado / c.limite * 100)}% do limite`, 'cartoes');
  });
  estado.dividas.forEach(d => { const p = proximaParcela(d); if(p && cfg.vencimento && p.vencimento <= lim) add('div:' + d.id + p.n, p.vencimento < h ? 'perigo' : 'atencao', 'hand-coins', `Parcela ${p.n} de <b>${esc(d.credor)}</b> ${p.vencimento < h ? 'atrasada' : 'vence ' + quando(p.vencimento)}`, 'dividas'); });
  if(cfg.orcamento){
    const o = orcamentoDoMes(chaveMes(h)), k = chaveMes(h);
    o.linhas.filter(l => l.pct >= 80).forEach(l => add(`orc:${k}:${l.id}:${l.pct > 100 ? 100 : 80}`, l.pct > 100 ? 'perigo' : 'atencao', 'chart-pie', l.pct > 100 ? `Orçamento de <b>${esc(l.nome)}</b> ultrapassado (${Math.round(l.pct)}%)` : `<b>${esc(l.nome)}</b> chegou a ${Math.round(l.pct)}% do orçamento`, 'planejamento'));
    if(o.total && o.pct >= 80) add(`orct:${k}:${o.pct > 100 ? 100 : 80}`, o.pct > 100 ? 'perigo' : 'atencao', 'chart-pie', o.pct > 100 ? 'Orçamento do mês ultrapassado' : `Você já usou ${Math.round(o.pct)}% do orçamento do mês`, 'planejamento');
  }
  if(cfg.metas) estado.metas.filter(m => m.alvo && acumuladoMeta(m) >= m.alvo).forEach(m => add('meta:' + m.id, 'bom', 'trophy', `Meta <b>${esc(m.nome)}</b> atingida!`, 'metas'));
  const ordem = {perigo: 0, atencao: 1, info: 2, bom: 3};
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
