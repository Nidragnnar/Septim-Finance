// Relatórios com filtro de período e exportação em CSV, Excel e PDF (impressão).
import {estado, achar, categoria} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, pct, toast, graficoBarras, graficoLinha, graficoRosca, desenharIcones} from '../ui.js';
import {filtroPeriodo, ligarPeriodo, refazer} from './lancamentos.js';
import {TIPOS_INVEST} from '../formularios.js';

const filtro = {per: 'mes', ini: '', fim: '', rel: 'categorias'};
const RELS = [['receitas', 'Receitas por período'], ['despesas', 'Despesas por período'], ['categorias', 'Gastos por categoria'], ['contas', 'Gastos por conta'], ['cartoes', 'Gastos por cartão'],
  ['patrimonio', 'Evolução do patrimônio'], ['mensal', 'Comparativo mensal'], ['investimentos', 'Investimentos'], ['dividas', 'Dívidas']];
const nomeConta = id => (achar('contas', id) || {}).nome || '—';

// cada relatório: colunas [nome, tipo], linhas de valores crus, gráfico e totais
function montar(rel, p){
  const desp = C.despesasEntre(p.ini, p.fim), meses = C.mesesDe(p);
  switch(rel){
    case 'receitas': {
      const l = C.receitasEntre(p.ini, p.fim).sort((a, b) => a.data.localeCompare(b.data));
      return {colunas: [['Data', 'data'], ['Descrição', 'txt'], ['Categoria', 'txt'], ['Conta', 'txt'], ['Situação', 'txt'], ['Valor', 'brl']],
        linhas: l.map(t => [t.data, t.descricao, categoria(t.categoriaId).nome, nomeConta(t.contaId), t.pagoEm ? 'Recebida' : 'Pendente', t.valor]),
        total: ['Total', '', '', '', '', C.soma(l)], grafico: graficoRosca({itens: C.porCategoria(l), sub: 'receitas'})};
    }
    case 'despesas': {
      const l = desp.sort((a, b) => a.data.localeCompare(b.data));
      return {colunas: [['Data', 'data'], ['Descrição', 'txt'], ['Categoria', 'txt'], ['Origem', 'txt'], ['Situação', 'txt'], ['Valor', 'brl']],
        linhas: l.map(d => [d.data, d.descricao, categoria(d.categoriaId).nome, d.origem === 'cartao' ? 'Cartão ' + ((achar('cartoes', d.cartaoId) || {}).nome || '') : d.origem === 'divida' ? 'Dívida' : nomeConta(d.contaId), d.tx ? (d.tx.pagoEm ? 'Paga' : C.statusTx(d.tx) === 'atrasado' ? 'Atrasada' : 'Pendente') : 'Paga', d.valor]),
        total: ['Total', '', '', '', '', C.soma(l)], grafico: graficoBarras({rotulos: meses.map(k => C.nomeMes(k, true)), series: [{nome: 'Despesas', cor: 'var(--neg)', valores: meses.map(k => C.soma(l.filter(d => C.chaveMes(d.data) === k)))}]})};
    }
    case 'categorias': {
      const cats = C.porCategoria(desp), t = C.soma(cats);
      return {colunas: [['Categoria', 'txt'], ['Lançamentos', 'num'], ['% do total', 'pct'], ['Valor', 'brl']],
        linhas: cats.map(c => [c.nome, desp.filter(d => d.categoriaId === c.id).length, t ? c.valor / t * 100 : 0, c.valor]),
        total: ['Total', desp.length, 100, t], grafico: graficoRosca({itens: cats, sub: 'despesas'})};
    }
    case 'contas': {
      const m = {};
      desp.filter(d => d.origem !== 'cartao').forEach(d => { const k = d.contaId || ''; m[k] = (m[k] || 0) + d.valor; });
      const l = Object.entries(m).map(([id, v]) => ({nome: id ? nomeConta(id) : 'Sem conta', valor: v, cor: (achar('contas', id) || {}).cor || '#8E87A3'})).sort((a, b) => b.valor - a.valor);
      return {colunas: [['Conta', 'txt'], ['Valor', 'brl']], linhas: l.map(x => [x.nome, x.valor]), total: ['Total', C.soma(l)], grafico: graficoRosca({itens: l, sub: 'pelas contas'}),
        nota: 'Despesas lançadas em contas e parcelas de dívida. Compras no cartão ficam no relatório por cartão.'};
    }
    case 'cartoes': {
      const l = estado.cartoes.map(c => ({nome: c.nome, cor: c.cor, valor: C.soma(desp.filter(d => d.cartaoId === c.id)), n: desp.filter(d => d.cartaoId === c.id).length})).filter(x => x.valor);
      return {colunas: [['Cartão', 'txt'], ['Parcelas no período', 'num'], ['Valor', 'brl']], linhas: l.map(x => [x.nome, x.n, x.valor]), total: ['Total', C.soma(l, x => x.n), C.soma(l)],
        grafico: graficoRosca({itens: l, sub: 'nos cartões'}), nota: 'Pelo vencimento da fatura em que cada parcela cai.'};
    }
    case 'patrimonio': {
      const pts = meses.map(k => ({k, ...C.patrimonio(k >= C.chaveMes(C.hoje()) ? C.hoje() : C.fimMes(k))}));
      return {colunas: [['Mês', 'txt'], ['Contas', 'brl'], ['Investimentos', 'brl'], ['Dívidas', 'brl'], ['Cartões em aberto', 'brl'], ['Patrimônio', 'brl']],
        linhas: pts.map(x => [C.nomeMes(x.k), x.contas, x.invest, -x.dividas, -x.cartoes, x.total]),
        grafico: graficoLinha({rotulos: pts.map(x => C.nomeMes(x.k, true)), series: [{nome: 'Patrimônio', cor: 'var(--roxo-2)', valores: pts.map(x => x.total), area: true}]})};
    }
    case 'mensal': {
      const l = meses.map(k => { const r = C.soma(C.receitasEntre(C.inicioMes(k), C.fimMes(k))), d = C.soma(C.despesasEntre(C.inicioMes(k), C.fimMes(k))); return {k, r, d}; });
      return {colunas: [['Mês', 'txt'], ['Receitas', 'brl'], ['Despesas', 'brl'], ['Resultado', 'brl']],
        linhas: l.map(x => [C.nomeMes(x.k), x.r, x.d, x.r - x.d]), total: ['Total', C.soma(l, x => x.r), C.soma(l, x => x.d), C.soma(l, x => x.r - x.d)],
        grafico: graficoBarras({rotulos: l.map(x => C.nomeMes(x.k, true)), series: [{nome: 'Receitas', cor: 'var(--pos)', valores: l.map(x => x.r)}, {nome: 'Despesas', cor: 'var(--neg)', valores: l.map(x => x.d)}]})};
    }
    case 'investimentos': {
      const tipos = Object.fromEntries(TIPOS_INVEST);
      const l = estado.investimentos.map(i => { const v = C.valorInvestimento(i, p.fim), a = C.aplicadoLiquido(i, p.fim); return [i.nome, tipos[i.tipo] || '', a, v, v - a, a ? (v - a) / a * 100 : 0]; });
      return {colunas: [['Investimento', 'txt'], ['Tipo', 'txt'], ['Aplicado', 'brl'], ['Valor atual', 'brl'], ['Lucro', 'brl'], ['Rentab.', 'pct']], linhas: l,
        total: ['Total', '', C.soma(l, x => x[2]), C.soma(l, x => x[3]), C.soma(l, x => x[4]), ''], grafico: graficoRosca({itens: estado.investimentos.map((i, n) => ({nome: i.nome, valor: C.valorInvestimento(i, p.fim), cor: ['#E0B44C', '#9B7BDA', '#5FBF92', '#56C2C9', '#4F74C8', '#C77DDB', '#D9822B'][n % 7]})), sub: 'valor'}), nota: 'Valores na data final do período.'};
    }
    case 'dividas': {
      const l = estado.dividas.map(d => [d.credor, d.valorOriginal, C.totalDivida(d), C.pagoDivida(d, p.fim), C.restanteDivida(d, p.fim), `${(d.pagamentos || []).filter(x => x.data <= p.fim).length}/${d.parcelas}`]);
      return {colunas: [['Credor', 'txt'], ['Original', 'brl'], ['Total c/ juros', 'brl'], ['Pago', 'brl'], ['Falta', 'brl'], ['Parcelas', 'txt']], linhas: l,
        total: ['Total', C.soma(l, x => x[1]), C.soma(l, x => x[2]), C.soma(l, x => x[3]), C.soma(l, x => x[4]), ''],
        grafico: graficoBarras({rotulos: l.map(x => x[0]), series: [{nome: 'Pago', cor: 'var(--pos)', valores: l.map(x => x[3])}, {nome: 'Falta', cor: 'var(--neg)', valores: l.map(x => x[4])}], empilhar: true}), nota: 'Situação na data final do período.'};
    }
  }
}

const formatar = (v, t) => v === '' || v == null ? '' : t === 'brl' ? brl(v) : t === 'data' ? data(v) : t === 'pct' ? pct(v) : esc(v);
// para arquivos: números como número, datas como texto legível
const cru = (v, t) => v === '' || v == null ? '' : t === 'brl' ? v / 100 : t === 'pct' ? Math.round(v * 10) / 10 : t === 'data' ? data(v) : v;

export function render(el){
  const p = C.periodo(filtro.per, filtro.ini, filtro.fim), r = montar(filtro.rel, p), titulo = RELS.find(x => x[0] === filtro.rel)[1];
  el.innerHTML = `<div class="filtros"><select data-rel aria-label="Relatório">${RELS.map(([k, t]) => `<option value="${k}" ${k === filtro.rel ? 'selected' : ''}>${t}</option>`).join('')}</select>${filtroPeriodo(filtro)}</div>
    <div class="filtros nao-imprime"><span class="txt-fraco" style="font-size:12.5px">${data(p.ini)} a ${data(p.fim)}</span><span class="cresce"></span>
      <button class="btn pequeno" data-exp="csv">${ic('file-text')}CSV</button><button class="btn pequeno" data-exp="xlsx">${ic('file-spreadsheet')}Excel</button><button class="btn pequeno" data-exp="pdf">${ic('printer')}PDF</button></div>
    <div class="grade g-2-1">
      <div class="card"><div class="card-cab"><h2>${ic('table')}${titulo}</h2><small>${r.linhas.length} ${r.linhas.length === 1 ? 'linha' : 'linhas'}</small></div>
        ${r.linhas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr>${r.colunas.map(([n, t]) => `<th class="${['brl', 'num', 'pct'].includes(t) ? 'num' : ''}">${n}</th>`).join('')}</tr></thead>
          <tbody>${r.linhas.map(l => `<tr>${l.map((v, i) => `<td class="${['brl', 'num', 'pct'].includes(r.colunas[i][1]) ? 'num' : ''} ${r.colunas[i][1] === 'brl' && v < 0 ? 'txt-neg' : ''}">${formatar(v, r.colunas[i][1])}</td>`).join('')}</tr>`).join('')}</tbody>
          ${r.total ? `<tfoot><tr>${r.total.map((v, i) => `<td class="${['brl', 'num', 'pct'].includes(r.colunas[i][1]) ? 'num' : ''}">${i === 0 ? esc(v) : formatar(v, r.colunas[i][1])}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`
          : '<p class="txt-fraco" style="padding:18px; margin:0">Nada neste período.</p>'}
        ${r.nota ? `<p class="txt-fraco" style="font-size:12px; padding:0 18px 14px; margin:0">${r.nota}</p>` : ''}</div>
      <div class="card"><div class="card-cab"><h2>${ic('chart-column')}Gráfico</h2></div><div class="card-corpo">${r.grafico}</div></div>
    </div>`;
  ligarPeriodo(el, filtro, () => { render(refazer(el)); desenharIcones(); });
  $('[data-rel]', el).onchange = e => { filtro.rel = e.target.value; render(refazer(el)); desenharIcones(); };
  $$('[data-exp]', el).forEach(b => b.onclick = () => exportar(b.dataset.exp, r, titulo, p));
}

async function exportar(tipo, r, titulo, p){
  if(tipo === 'pdf') return window.print();
  const nome = `septim-${filtro.rel}-${p.ini}-a-${p.fim}`;
  const linhas = [r.colunas.map(c => c[0]), ...r.linhas.map(l => l.map((v, i) => cru(v, r.colunas[i][1]))), ...(r.total ? [r.total.map((v, i) => i === 0 ? v : cru(v, r.colunas[i][1]))] : [])];
  if(tipo === 'csv'){
    // ponto e vírgula e vírgula decimal: abre direto no Excel em português
    const cel = v => { const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    baixar(new Blob(['﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}), nome + '.csv');
    return toast('CSV exportado');
  }
  try{
    if(!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const ws = window.XLSX.utils.aoa_to_sheet(linhas), wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31));
    window.XLSX.writeFile(wb, nome + '.xlsx');
    toast('Planilha exportada');
  }catch(e){ toast('Sem internet para gerar o Excel; use o CSV, que abre no Excel'); }
}
function baixar(blob, nome){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export {baixar};
