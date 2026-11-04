// Cartões de crédito: limites, faturas, compras e pagamentos.
import {estado, achar, categoria, redesenhar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, vazio, barra, chipCategoria} from '../ui.js';
import * as F from '../formularios.js';

const ui = {cartao: null, fatura: null, aba: 'fatura'};
const ROT = {aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga', vencida: 'Vencida', vazia: 'Sem compras', futura: 'Futura'};

export function render(el){
  if(!estado.cartoes.length){
    el.innerHTML = `<div class="card">${vazio('credit-card', 'Nenhum cartão cadastrado', 'Cadastre o cartão com o dia de fechamento e de vencimento. As compras parceladas se espalham sozinhas pelas faturas, e o pagamento da fatura não conta a despesa duas vezes.', `<button class="btn primario" data-novo>${ic('plus')}Novo cartão</button>`)}</div>`;
    $('[data-novo]', el).onclick = () => F.formCartao();
    return;
  }
  if(!achar('cartoes', ui.cartao)) ui.cartao = estado.cartoes[0].id;
  const c = achar('cartoes', ui.cartao), faturas = C.faturasDoCartao(c), atualKey = C.faturaAtualKey(c);
  if(!faturas.some(f => f.key === ui.fatura)) ui.fatura = atualKey;
  const f = faturas.find(x => x.key === ui.fatura);
  const totalLim = estado.cartoes.reduce((s, x) => s + x.limite, 0), usado = estado.cartoes.reduce((s, x) => s + C.limiteUsado(x), 0);

  el.innerHTML = `<div class="filtros"><button class="btn primario" data-compra>${ic('plus')}Compra no cartão</button><button class="btn" data-novo>${ic('credit-card')}Novo cartão</button>
      <span class="cresce"></span><span class="txt-fraco" style="font-size:12.5px">Limite livre em todos: <b class="txt-mut">${brl(totalLim - usado)}</b> de ${brl(totalLim)}</span></div>
    <div class="ccs">${estado.cartoes.map(x => {
      const u = C.limiteUsado(x), fa = C.fatura(x, C.faturaAtualKey(x));
      return `<div class="cc ${x.id === c.id ? 'sel' : ''}" style="--cor:${x.cor}" data-sel="${x.id}" role="button" tabindex="0" aria-pressed="${x.id === c.id}">
        <div class="cc-nome">${esc(x.nome)}</div><div class="cc-banco">${esc(x.banco || '')} · fecha dia ${x.diaFechamento} · vence dia ${x.diaVencimento}</div>
        <div class="cc-meio"><div class="cc-linha"><span>Fatura atual</span><b>${brl(fa.total)}</b></div>
          ${barra(x.limite ? u / x.limite * 100 : 0)}
          <div class="cc-linha"><span>Usado ${brl(u)}</span><span>Livre ${brl(Math.max(0, x.limite - u))}</span></div></div>
      </div>`; }).join('')}</div>
    <div class="card">
      <div class="card-cab"><h2>${ic('credit-card')}${esc(c.nome)}</h2><small>melhor dia de compra: ${c.diaFechamento}</small>
        <button class="icone-btn mini" data-ed title="Editar cartão">${ic('pencil')}</button><button class="icone-btn mini perigo" data-ex title="Excluir cartão">${ic('trash-2')}</button></div>
      <div class="abas" role="tablist">${[['fatura', 'Faturas'], ['proximas', 'Próximas'], ['anteriores', 'Anteriores'], ['parceladas', 'Compras parceladas'], ['pagamentos', 'Pagamentos']].map(([k, t]) => `<button role="tab" data-aba="${k}" class="${ui.aba === k ? 'ativo' : ''}" aria-selected="${ui.aba === k}">${t}</button>`).join('')}</div>
      ${aba(c, f, faturas, atualKey)}
    </div>`;

  el.onclick = e => {
    const b = e.target.closest('[data-sel],[data-aba],[data-fat],[data-acao],[data-pagar],[data-compra],[data-novo],[data-ed],[data-ex],[data-ir]'); if(!b) return;
    if(b.dataset.sel){ ui.cartao = b.dataset.sel; ui.fatura = null; redesenhar(); }
    else if(b.dataset.aba){ ui.aba = b.dataset.aba; redesenhar(); }
    else if(b.dataset.fat){ const i = faturas.findIndex(x => x.key === ui.fatura) + +b.dataset.fat; if(faturas[i]){ ui.fatura = faturas[i].key; redesenhar(); } }
    else if(b.dataset.ir){ ui.fatura = b.dataset.ir; ui.aba = 'fatura'; redesenhar(); }
    else if(b.dataset.pagar !== undefined) F.formPagarFatura(c, ui.fatura);
    else if(b.dataset.compra !== undefined) F.formCompra(null, c.id);
    else if(b.dataset.novo !== undefined) F.formCartao();
    else if(b.dataset.ed !== undefined) F.formCartao(c);
    else if(b.dataset.ex !== undefined) F.excluirCartao(c);
    else if(b.dataset.acao){
      const [a, id, x] = b.dataset.acao.split(':');
      if(a === 'compra'){ const cp = achar('compras', id); if(cp) x === 'x' ? F.excluirCompra(cp) : F.formCompra(cp); }
      if(a === 'pgfat'){ const p = achar('pagamentosFatura', id); if(p) F.excluirPagamentoFatura(p); }
    }
  };
  el.onkeydown = e => { if(e.key === 'Enter' && e.target.dataset.sel){ ui.cartao = e.target.dataset.sel; redesenhar(); } };
}

const linhaParcela = p => `<li class="linha">${chipCategoria(p.compra.categoriaId)}
  <div class="meio"><b>${esc(p.compra.descricao)}${p.total > 1 ? ` <span class="tag roxo">${p.n}/${p.total}</span>` : ''}</b><small>comprado em ${data(p.compra.data)} · ${esc(categoria(p.compra.categoriaId).nome)}${p.total > 1 ? ' · total ' + brl(p.compra.valor) : ''}</small></div>
  <span class="valor">${brl(p.valor)}</span>
  <span class="acoes"><button class="icone-btn mini" data-acao="compra:${p.compra.id}" title="Editar compra">${ic('pencil')}</button><button class="icone-btn mini perigo" data-acao="compra:${p.compra.id}:x" title="Excluir compra">${ic('trash-2')}</button></span></li>`;

function aba(c, f, faturas, atualKey){
  if(ui.aba === 'fatura'){
    const i = faturas.findIndex(x => x.key === f.key);
    return `<div class="filtros" style="padding:14px 18px 0; margin:0">
        <div class="pilulas"><button type="button" data-fat="-1" ${i <= 0 ? 'disabled' : ''} aria-label="Fatura anterior">${ic('chevron-left')}</button><button type="button" class="ativo">${C.nomeMes(f.key)}</button><button type="button" data-fat="1" ${i >= faturas.length - 1 ? 'disabled' : ''} aria-label="Próxima fatura">${ic('chevron-right')}</button></div>
        <span class="tag ${f.status}">${ROT[f.status]}</span>${f.key === atualKey ? '<span class="tag roxo">fatura atual</span>' : ''}
        <span class="cresce"></span>${f.restante <= 0 ? '' : f.status === 'aberta' ? `<button class="btn pequeno" data-pagar>${ic('banknote')}Adiantar pagamento</button>` : `<button class="btn primario pequeno" data-pagar>${ic('banknote')}Pagar fatura</button>`}
      </div>
      <div class="fat-resumo">
        <div><small>Total</small><b>${brl(f.total)}</b></div><div><small>Pago</small><b class="txt-pos">${brl(f.pago)}</b></div>
        <div><small>Falta</small><b class="${f.restante && f.status === 'vencida' ? 'txt-neg' : ''}">${brl(f.restante)}</b></div>
        <div><small>Fecha · vence</small><b style="font-size:14px">${data(f.fechamento, true)} · ${data(f.vencimento, true)}</b></div>
      </div>
      ${f.itens.length ? `<ul class="lista">${f.itens.map(linhaParcela).join('')}</ul>` : vazio('receipt', 'Nenhuma compra nesta fatura', 'Compras feitas até o dia do fechamento entram aqui.', `<button class="btn primario" data-compra>${ic('plus')}Compra no cartão</button>`)}`;
  }
  if(ui.aba === 'proximas' || ui.aba === 'anteriores'){
    const lista = faturas.filter(x => ui.aba === 'proximas' ? x.key > atualKey : x.key < atualKey);
    if(ui.aba === 'anteriores') lista.reverse();
    return lista.length ? `<ul class="lista">${lista.map(x => `<li class="linha"><span class="cat-ic" style="--c:${c.cor}">${ic('receipt')}</span>
        <div class="meio"><b>${C.nomeMes(x.key)}</b><small>vence ${data(x.vencimento)} · ${x.itens.length} ${x.itens.length === 1 ? 'item' : 'itens'} <span class="tag ${x.status}">${ROT[x.status]}</span></small></div>
        <span class="valor">${brl(x.total)}</span><span class="acoes"><button class="btn pequeno" data-ir="${x.key}">Abrir</button></span></li>`).join('')}</ul>`
      : vazio('calendar', ui.aba === 'proximas' ? 'Nenhuma fatura futura' : 'Nenhuma fatura anterior', ui.aba === 'proximas' ? 'Compras parceladas criam as próximas faturas sozinhas.' : 'As faturas passadas ficam aqui com o status de pagamento.');
  }
  if(ui.aba === 'parceladas'){
    const ps = estado.compras.filter(x => x.cartaoId === c.id && x.parcelas > 1).sort((a, b) => b.data.localeCompare(a.data));
    return ps.length ? `<ul class="lista">${ps.map(cp => {
      const pp = C.parcelasDaCompra(cp), faltam = pp.filter(p => p.fatura >= atualKey), ja = cp.parcelas - faltam.length;
      return `<li class="linha">${chipCategoria(cp.categoriaId)}<div class="meio"><b>${esc(cp.descricao)}</b><small>${cp.parcelas}x de ${brl(pp[pp.length - 1].valor)} · ${ja} de ${cp.parcelas} já faturadas · última em ${C.nomeMes(pp[pp.length - 1].fatura, true)}</small>${barra(ja / cp.parcelas * 100, c.cor)}</div>
        <span class="valor">${brl(cp.valor)}</span><span class="acoes"><button class="icone-btn mini" data-acao="compra:${cp.id}" title="Editar">${ic('pencil')}</button><button class="icone-btn mini perigo" data-acao="compra:${cp.id}:x" title="Excluir">${ic('trash-2')}</button></span></li>`; }).join('')}</ul>`
      : vazio('layers', 'Nenhuma compra parcelada', 'Ao lançar uma compra em várias vezes, cada parcela vai para a fatura certa.');
  }
  const pg = estado.pagamentosFatura.filter(p => p.cartaoId === c.id).sort((a, b) => b.data.localeCompare(a.data));
  return pg.length ? `<ul class="lista">${pg.map(p => `<li class="linha"><span class="cat-ic" style="--c:var(--pos)">${ic('banknote')}</span>
      <div class="meio"><b>Fatura de ${C.nomeMes(p.fatura)}</b><small>${data(p.data)} · ${esc((achar('contas', p.contaId) || {}).nome || '—')}</small></div>
      <span class="valor">${brl(p.valor)}</span><span class="acoes"><button class="icone-btn mini perigo" data-acao="pgfat:${p.id}" title="Excluir pagamento">${ic('trash-2')}</button></span></li>`).join('')}</ul>`
    : vazio('banknote', 'Nenhum pagamento ainda', 'Os pagamentos de fatura saem do saldo da conta escolhida e ficam registrados aqui.');
}
