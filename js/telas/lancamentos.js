// Transações (tudo junto), Receitas e Despesas.
import {estado, achar, categoria} from '../dados.js';
import {hoje, statusTx, rotuloStatus, periodo, PERIODOS, entre, chaveMes, somaMeses, inicioMes, fimMes, nomeMes, soma} from '../calc.js';
import {$, $$, esc, ic, brl, data, vazio, chipCategoria, desenharIcones} from '../ui.js';
import * as F from '../formularios.js';
import {importarExtrato} from '../extrato.js';

/* ================= linha de lançamento (usada também no dashboard) ================= */
const nomeConta = id => (achar('contas', id) || {}).nome || '—';
export function linhaTx(t, {acoes = true} = {}){
  const c = categoria(t.categoriaId), s = statusTx(t), rec = t.tipo === 'receita';
  return `<li class="linha">
    ${chipCategoria(t.categoriaId)}
    <div class="meio"><b>${esc(t.descricao)}</b>
      <small>${data(t.data, true)} · ${esc(c.nome)} · ${esc(nomeConta(t.contaId))}
        <span class="tag ${s}">${rotuloStatus(t)}</span>
        ${t.recorrenciaId ? `<span title="Repete">${ic('repeat', 'mini')}</span>` : ''}
        ${t.anexo ? `<button class="icone-btn mini" data-acao="anexo|${t.id}" title="Ver comprovante">${ic('paperclip')}</button>` : ''}
      </small></div>
    <span class="valor ${rec ? 'txt-pos' : 'txt-neg'}">${rec ? '+' : '−'}${brl(t.valor)}</span>
    ${acoes ? `<span class="acoes">
      <button class="icone-btn mini" data-acao="pagar|${t.id}" title="${t.pagoEm ? 'Marcar como pendente' : rec ? 'Marcar como recebida' : 'Marcar como paga'}">${ic(t.pagoEm ? 'circle-check-big' : 'circle')}</button>
      <button class="icone-btn mini" data-acao="editar|${t.id}" title="Editar">${ic('pencil')}</button>
      <button class="icone-btn mini perigo" data-acao="excluir|${t.id}" title="Excluir">${ic('trash-2')}</button></span>` : '<span></span>'}
  </li>`;
}
// liga os botões das linhas (delegação)
export function ligarAcoes(el){
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-acao]'); if(!b) return;
    // separador | : os ids das repetições têm dois-pontos (repetição:mês)
    const [acao, id, extra] = b.dataset.acao.split('|');
    const t = achar('transacoes', id);
    if(acao === 'pagar' && t) F.alternarPago(t);
    if(acao === 'editar' && t) F.formTransacao(t.tipo, t);
    if(acao === 'excluir' && t) F.excluirTransacao(t);
    if(acao === 'anexo') F.verAnexo(id);
    if(acao === 'transf'){ const x = achar('transferencias', id); if(x) extra === 'x' ? F.excluirTransferencia(x) : F.formTransferencia(x); }
    if(acao === 'compra'){ const x = achar('compras', id); if(x) extra === 'x' ? F.excluirCompra(x) : F.formCompra(x); }
    if(acao === 'pgfat'){ const x = achar('pagamentosFatura', id); if(x) F.excluirPagamentoFatura(x); }
    if(acao === 'pgdiv'){ const d = estado.dividas.find(dv => (dv.pagamentos || []).some(p => p.id === id)); if(d) F.excluirPagamentoDivida(d, d.pagamentos.find(p => p.id === id)); }
    if(acao === 'movinv'){ const i = estado.investimentos.find(x => (x.movimentos || []).some(m => m.id === id)); if(i) F.excluirMovInvest(i, i.movimentos.find(m => m.id === id), 'movimentos'); }
    if(acao === 'rec'){ const r = achar('recorrencias', id); if(r) F.encerrarRecorrencia(r); }
  });
}

/* ================= Transações: tudo junto ================= */
const filtro = {per: 'mes', ini: '', fim: '', tipo: 'todos', conta: '', cat: '', status: '', busca: ''};
function todosItens(ini, fim){
  const out = [];
  estado.transacoes.filter(t => entre(t.data, ini, fim)).forEach(t => out.push({tipo: t.tipo, data: t.data, valor: t.tipo === 'receita' ? t.valor : -t.valor, t, busca: t.descricao, contas: [t.contaId], cat: t.categoriaId, status: statusTx(t)}));
  estado.transferencias.filter(t => entre(t.data, ini, fim)).forEach(t => out.push({tipo: 'transferencia', data: t.data, valor: 0, x: t, busca: t.descricao + ' transferência', contas: [t.deId, t.paraId], status: 'pago'}));
  estado.compras.filter(c => entre(c.data, ini, fim)).forEach(c => out.push({tipo: 'cartao', data: c.data, valor: -c.valor, x: c, busca: c.descricao, contas: [], cat: c.categoriaId, status: 'pago'}));
  estado.pagamentosFatura.filter(p => entre(p.data, ini, fim)).forEach(p => out.push({tipo: 'outros', sub: 'fatura', data: p.data, valor: -p.valor, x: p, busca: 'fatura', contas: [p.contaId], status: 'pago'}));
  estado.dividas.forEach(d => (d.pagamentos || []).filter(p => entre(p.data, ini, fim)).forEach(p => out.push({tipo: 'outros', sub: 'divida', data: p.data, valor: -p.valor, x: p, d, busca: d.credor + ' dívida parcela', contas: [p.contaId], cat: 'dividas', status: 'pago'})));
  estado.investimentos.forEach(i => (i.movimentos || []).filter(m => entre(m.data, ini, fim)).forEach(m => out.push({tipo: 'outros', sub: 'invest', data: m.data, valor: m.tipo === 'resgate' ? m.valor : -m.valor, x: m, i, busca: i.nome + ' investimento', contas: [m.contaId], status: 'pago'})));
  return out.sort((a, b) => b.data.localeCompare(a.data));
}
function linhaItem(it){
  if(it.t) return linhaTx(it.t);
  const um = (icone, cor, titulo, sub, valor, acoes) => `<li class="linha"><span class="cat-ic" style="--c:${cor}">${ic(icone)}</span>
    <div class="meio"><b>${esc(titulo)}</b><small>${data(it.data, true)} · ${sub}</small></div>
    <span class="valor ${valor > 0 ? 'txt-pos' : valor < 0 ? 'txt-neg' : 'txt-mut'}">${valor ? (valor > 0 ? '+' : '−') + brl(Math.abs(valor)) : brl(it.x.valor)}</span><span class="acoes">${acoes}</span></li>`;
  const ed = (k, id) => `<button class="icone-btn mini" data-acao="${k}|${id}" title="Editar">${ic('pencil')}</button>`;
  const ex = (k, id, suf = '') => `<button class="icone-btn mini perigo" data-acao="${k}|${id}${suf}" title="Excluir">${ic('trash-2')}</button>`;
  if(it.tipo === 'transferencia') return um('arrow-left-right', 'var(--roxo-2)', it.x.descricao || 'Transferência', `${esc(nomeConta(it.x.deId))} → ${esc(nomeConta(it.x.paraId))}`, 0, ed('transf', it.x.id) + ex('transf', it.x.id, '|x'));
  if(it.tipo === 'cartao'){ const c = achar('cartoes', it.x.cartaoId) || {nome: 'Cartão', cor: '#6A3FBF'}; return um('credit-card', c.cor, it.x.descricao, `${esc(c.nome)} · ${it.x.parcelas > 1 ? it.x.parcelas + 'x' : 'à vista'} · ${esc(categoria(it.x.categoriaId).nome)}`, it.valor, ed('compra', it.x.id) + ex('compra', it.x.id, '|x')); }
  if(it.sub === 'fatura'){ const c = achar('cartoes', it.x.cartaoId) || {nome: 'cartão'}; return um('receipt', 'var(--ouro-txt)', 'Pagamento de fatura · ' + c.nome, `${esc(nomeConta(it.x.contaId))} · fatura de ${nomeMes(it.x.fatura, true)} · não conta como despesa`, it.valor, ex('pgfat', it.x.id)); }
  if(it.sub === 'divida') return um('hand-coins', '#A63D33', 'Parcela · ' + it.d.credor, esc(nomeConta(it.x.contaId)) || 'sem conta', it.valor, ex('pgdiv', it.x.id));
  return um('trending-up', 'var(--pos)', (it.x.tipo === 'resgate' ? 'Resgate · ' : 'Aplicação · ') + it.i.nome, esc(it.x.contaId ? nomeConta(it.x.contaId) : 'sem conta') + ' · investimento', it.valor, ex('movinv', it.x.id));
}
export function filtroPeriodo(f, aoMudar){
  return `<div class="pilulas" role="group" aria-label="Período">${PERIODOS.map(([k, t]) => `<button type="button" data-per="${k}" class="${f.per === k ? 'ativo' : ''}">${t}</button>`).join('')}</div>
    ${f.per === 'custom' ? `<input type="date" data-ini value="${f.ini}" aria-label="De"><input type="date" data-fim value="${f.fim}" aria-label="Até">` : ''}`;
}
export function ligarPeriodo(el, f, redesenhar){
  $$('[data-per]', el).forEach(b => b.onclick = () => { f.per = b.dataset.per; if(f.per === 'custom' && !f.ini){ f.ini = inicioMes(hoje()); f.fim = hoje(); } redesenhar(); });
  const i = $('[data-ini]', el), fi = $('[data-fim]', el);
  if(i) i.onchange = () => { f.ini = i.value; redesenhar(); };
  if(fi) fi.onchange = () => { f.fim = fi.value; redesenhar(); };
}
export function transacoes(el){
  const p = periodo(filtro.per, filtro.ini, filtro.fim);
  let itens = todosItens(p.ini, p.fim);
  const total = itens.length;
  if(filtro.tipo !== 'todos') itens = itens.filter(i => i.tipo === filtro.tipo);
  if(filtro.conta) itens = itens.filter(i => i.contas.includes(filtro.conta));
  if(filtro.cat) itens = itens.filter(i => i.cat === filtro.cat);
  if(filtro.status) itens = itens.filter(i => i.status === filtro.status);
  if(filtro.busca) { const q = filtro.busca.toLowerCase(); itens = itens.filter(i => i.busca.toLowerCase().includes(q)); }
  const entradas = soma(itens.filter(i => i.valor > 0), i => i.valor), saidas = -soma(itens.filter(i => i.valor < 0), i => i.valor);
  const sel = (nome, valor, ops) => `<select data-f="${nome}" aria-label="${nome}">${ops.map(([v, t]) => `<option value="${esc(v)}" ${v === valor ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="filtros">${filtroPeriodo(filtro)}<span class="cresce"></span><button class="btn" data-extrato>${ic('file-down')}Importar extrato</button></div>
    <div class="filtros">
      <input type="search" data-f="busca" placeholder="Buscar…" value="${esc(filtro.busca)}" aria-label="Buscar">
      ${sel('tipo', filtro.tipo, [['todos', 'Todos os tipos'], ['receita', 'Receitas'], ['despesa', 'Despesas'], ['cartao', 'Compras no cartão'], ['transferencia', 'Transferências'], ['outros', 'Faturas, dívidas e investimentos']])}
      ${sel('conta', filtro.conta, [['', 'Todas as contas'], ...estado.contas.map(c => [c.id, c.nome])])}
      ${sel('cat', filtro.cat, [['', 'Todas as categorias'], ...estado.categorias.map(c => [c.id, c.nome + (c.tipo === 'receita' ? ' (receita)' : '')])])}
      ${sel('status', filtro.status, [['', 'Qualquer status'], ['pago', 'Pago / recebido'], ['pendente', 'Pendente'], ['atrasado', 'Atrasado']])}
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic pos-bg">${ic('arrow-down-left')}</span>Entradas</div><div class="kpi-v txt-pos num">${brl(entradas)}</div><div class="kpi-s">${itens.length} de ${total} lançamentos</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic neg-bg">${ic('arrow-up-right')}</span>Saídas</div><div class="kpi-v txt-neg num">${brl(saidas)}</div><div class="kpi-s">pela data de cada lançamento</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic">${ic('scale')}</span>Resultado</div><div class="kpi-v num ${entradas - saidas < 0 ? 'txt-neg' : ''}">${brl(entradas - saidas)}</div><div class="kpi-s">transferências não entram</div></div>
    </div>
    <div class="card">${itens.length ? agrupar(itens, linhaItem) : vazio('search', total ? 'Nada com esses filtros' : 'Nenhuma movimentação no período', total ? 'Tente limpar a busca ou trocar os filtros.' : 'Use o botão Novo para registrar receitas, despesas, transferências e compras no cartão.', '<button class="btn primario" data-novo>' + ic('plus') + 'Novo lançamento</button>')}</div>`;
  const novo = $('[data-novo]', el); if(novo) novo.onclick = F.acaoRapida;
  $('[data-extrato]', el).onclick = importarExtrato;
  ligarPeriodo(el, filtro, () => transacoes(refazer(el)));
  $$('[data-f]', el).forEach(c => c[c.tagName === 'INPUT' ? 'oninput' : 'onchange'] = () => {
    filtro[c.dataset.f] = c.value;
    const pos = c.selectionStart; transacoes(refazer(el));
    if(c.tagName === 'INPUT'){ const n = $('[data-f=busca]', el); n.focus(); n.setSelectionRange(pos, pos); }
  });
  ligarAcoes(el); desenharIcones();
}
// redesenho local sem perder os ouvintes antigos: troca o elemento
export function refazer(el){ const n = el.cloneNode(false); el.replaceWith(n); return n; }
export function agrupar(itens, fn){
  let html = '<ul class="lista">', dia = '';
  itens.forEach(i => {
    if(i.data !== dia){ dia = i.data; const t = new Date(dia + 'T12:00').toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'}); html += `<li class="dia-cab">${t[0].toUpperCase() + t.slice(1)}</li>`; }
    html += fn(i);
  });
  return html + '</ul>';
}

/* ================= Receitas / Despesas ================= */
const mesTipo = {receita: null, despesa: null};
export function porTipo(el, tipo){
  const k = mesTipo[tipo] || chaveMes(hoje()), rec = tipo === 'receita';
  const lista = estado.transacoes.filter(t => t.tipo === tipo && chaveMes(t.data) === k).sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0));
  const feito = soma(lista.filter(t => t.pagoEm)), pend = soma(lista.filter(t => statusTx(t) === 'pendente')), atr = soma(lista.filter(t => statusTx(t) === 'atrasado'));
  const recs = estado.recorrencias.filter(r => r.tipo === tipo && r.ativa !== false);
  const compras = !rec ? estado.compras.length : 0;
  el.innerHTML = `<div class="filtros">
      <div class="pilulas"><button type="button" data-m="-1" aria-label="Mês anterior">${ic('chevron-left')}</button><button type="button" class="ativo">${nomeMes(k)}</button><button type="button" data-m="1" aria-label="Próximo mês">${ic('chevron-right')}</button></div>
      ${k !== chaveMes(hoje()) ? '<button class="btn ghost pequeno" data-m="0">Voltar para hoje</button>' : ''}
      <span class="cresce"></span>
      <button class="btn primario" data-novo>${ic('plus')}Nova ${rec ? 'receita' : 'despesa'}</button>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic ${rec ? 'pos-bg' : 'neg-bg'}">${ic(rec ? 'arrow-down-left' : 'arrow-up-right')}</span>Total do mês</div><div class="kpi-v num ${rec ? 'txt-pos' : 'txt-neg'}">${brl(soma(lista))}</div><div class="kpi-s">${lista.length} ${lista.length === 1 ? 'lançamento' : 'lançamentos'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic pos-bg">${ic('circle-check-big')}</span>${rec ? 'Recebido' : 'Pago'}</div><div class="kpi-v num">${brl(feito)}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic warn-bg">${ic('clock')}</span>${rec ? 'A receber' : 'A pagar'}</div><div class="kpi-v num">${brl(pend)}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic neg-bg">${ic('triangle-alert')}</span>Atrasado</div><div class="kpi-v num ${atr ? 'txt-neg' : ''}">${brl(atr)}</div></div>
    </div>
    <div class="grade g-2-1">
      <div class="card"><div class="card-cab"><h2>${ic(rec ? 'arrow-down-left' : 'arrow-up-right')}${rec ? 'Receitas' : 'Despesas'} de ${nomeMes(k, true)}</h2></div>
        ${lista.length ? `<ul class="lista">${lista.map(t => linhaTx(t)).join('')}</ul>` : vazio(rec ? 'piggy-bank' : 'receipt', `Nenhuma ${rec ? 'receita' : 'despesa'} neste mês`, rec ? 'Cadastre salário, freelas e vendas. Marque como recebida quando o dinheiro cair.' : 'Cadastre contas, compras e gastos. Dá para dividir em parcelas, repetir todo mês e anexar o comprovante.', `<button class="btn primario" data-novo>${ic('plus')}Nova ${rec ? 'receita' : 'despesa'}</button>`)}
        ${compras ? `<a class="mais" href="#/cartoes">Compras no cartão ficam em Cartões e entram nas despesas no mês da fatura ${ic('arrow-right')}</a>` : ''}
      </div>
      <div class="card"><div class="card-cab"><h2>${ic('repeat')}Repetições</h2><small>${recs.length}</small></div>
        ${recs.length ? `<ul class="lista">${recs.map(r => `<li class="linha">${chipCategoria(r.categoriaId)}<div class="meio"><b>${esc(r.descricao)}</b><small>${r.frequencia === 'anual' ? 'todo ano' : 'todo mês'}, dia ${r.dia}${r.fim ? ' · até ' + data(r.fim) : ''}</small></div><span class="valor">${brl(r.valor)}</span><span class="acoes"><button class="icone-btn mini perigo" data-acao="rec|${r.id}" title="Parar de repetir">${ic('circle-stop')}</button></span></li>`).join('')}</ul>`
          : `<p class="txt-fraco" style="padding:16px 18px; margin:0; font-size:13px">Ao cadastrar, escolha "Repetir: todo mês" para ${rec ? 'salário e rendas fixas' : 'aluguel, internet e assinaturas'}. O Septim cria cada mês sozinho.</p>`}
      </div>
    </div>`;
  $$('[data-novo]', el).forEach(b => b.onclick = () => F.formTransacao(tipo));
  $$('[data-m]', el).forEach(b => b.onclick = () => { const n = +b.dataset.m; mesTipo[tipo] = n ? chaveMes(somaMeses(k + '-01', n)) : null; porTipo(refazer(el), tipo); });
  ligarAcoes(el); desenharIcones();
}
