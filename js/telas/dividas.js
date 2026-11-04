// Dívidas e empréstimos: quanto falta, parcelas e progresso de quitação.
import {estado, achar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, pct, vazio, barra, abrirModal} from '../ui.js';
import * as F from '../formularios.js';

export function render(el){
  const ds = estado.dividas, h = C.hoje();
  const ativas = ds.filter(d => C.restanteDivida(d) > 0);
  const total = ds.reduce((s, d) => s + C.totalDivida(d), 0), pago = ds.reduce((s, d) => s + C.pagoDivida(d), 0), falta = ds.reduce((s, d) => s + C.restanteDivida(d), 0);
  const juros = ds.reduce((s, d) => s + Math.max(0, C.totalDivida(d) - d.valorOriginal), 0);
  const mensal = ativas.reduce((s, d) => s + d.valorParcela, 0);
  el.innerHTML = `<div class="filtros"><button class="btn primario" data-nova>${ic('plus')}Nova dívida</button></div>
    ${ds.length ? `<div class="kpis">
      <div class="kpi destaque"><div class="kpi-cab"><span class="kpi-ic">${ic('hand-coins')}</span>Falta quitar</div><div class="kpi-v num">${brl(falta)}</div><div class="kpi-s">${ativas.length} ${ativas.length === 1 ? 'dívida ativa' : 'dívidas ativas'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic pos-bg">${ic('circle-check-big')}</span>Já pago</div><div class="kpi-v num">${brl(pago)}</div><div class="kpi-s">${pct(total ? pago / total * 100 : 0)} do total</div>${barra(total ? pago / total * 100 : 0, 'var(--pos)')}</div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic warn-bg">${ic('calendar')}</span>Parcelas por mês</div><div class="kpi-v num">${brl(mensal)}</div><div class="kpi-s">somando as ativas</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic neg-bg">${ic('percent')}</span>Juros no total</div><div class="kpi-v num">${brl(juros)}</div><div class="kpi-s">parcelas menos valor original</div></div>
    </div>
    <div class="mini-cards">${ds.map(d => {
      const t = C.totalDivida(d), p = C.pagoDivida(d), r = C.restanteDivida(d), prox = C.proximaParcela(d), n = (d.pagamentos || []).length;
      const atras = prox && prox.vencimento < h;
      return `<div class="card mc">
        <div class="mc-cab"><span class="cat-ic" style="--c:${r ? '#A63D33' : 'var(--pos)'}">${ic(r ? 'hand-coins' : 'circle-check-big')}</span><div class="meio"><b>${esc(d.credor)}</b><small>${esc(d.descricao || 'Dívida')}${d.juros ? ' · ' + String(d.juros).replace('.', ',') + '% a.m.' : ''}</small></div>
          <button class="icone-btn mini" data-ed="${d.id}" title="Editar">${ic('pencil')}</button><button class="icone-btn mini perigo" data-ex="${d.id}" title="Excluir">${ic('trash-2')}</button></div>
        <div class="mc-nums"><span>Falta<br><b>${brl(r)}</b></span><span style="text-align:right">Original<br><b>${brl(d.valorOriginal)}</b></span></div>
        ${barra(t ? p / t * 100 : 0, 'var(--pos)')}
        <div class="mc-nums" style="font-size:12.5px"><span>${n} de ${d.parcelas} parcelas · ${pct(t ? p / t * 100 : 0)}</span><span>${r ? `${brl(d.valorParcela)}/mês` : '<span class="txt-pos">quitada!</span>'}</span></div>
        ${prox ? `<div class="nota ${atras ? 'alerta' : ''}" style="margin:0">Próxima: parcela ${prox.n} · ${atras ? 'atrasada desde' : 'vence'} ${data(prox.vencimento)}</div>` : ''}
        <div class="mc-acoes">${r ? `<button class="btn pequeno primario" data-pagar="${d.id}">${ic('banknote')}Pagar parcela</button>` : ''}<button class="btn pequeno" data-hist="${d.id}">${ic('list')}Parcelas e pagamentos</button></div>
      </div>`; }).join('')}</div>`
    : `<div class="card">${vazio('hand-coins', 'Nenhuma dívida cadastrada', 'Empréstimos, financiamentos, acordos… Cadastre com o valor das parcelas e acompanhe quanto falta para quitar. Cada pagamento sai da conta e entra nas despesas do mês.', `<button class="btn primario" data-nova>${ic('plus')}Nova dívida</button>`)}</div>`}`;
  el.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.nova !== undefined) return F.formDivida();
    const d = achar('dividas', b.dataset.ed || b.dataset.ex || b.dataset.pagar || b.dataset.hist); if(!d) return;
    if(b.dataset.ed) F.formDivida(d);
    if(b.dataset.ex) F.excluirDivida(d);
    if(b.dataset.pagar) F.formPagarDivida(d);
    if(b.dataset.hist) historico(d);
  };
}

function historico(d){
  const ps = C.parcelasDivida(d);
  abrirModal({
    titulo: d.credor + ' · parcelas', larga: true,
    corpo: `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>#</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${ps.map((p, i) => { const pg = (d.pagamentos || [])[i]; return `<tr><td>${p.n}</td><td>${data(p.vencimento)}</td><td class="num">${brl(pg ? pg.valor : p.valor)}</td>
        <td>${pg ? `<span class="tag pago">Paga ${data(pg.data, true)}</span>${pg.anterior ? ' <span class="txt-fraco">antes do Septim</span>' : ''}` : p.atrasada ? '<span class="tag atrasado">Atrasada</span>' : '<span class="tag pendente">Pendente</span>'}</td>
        <td>${pg ? `<button type="button" class="icone-btn mini perigo" data-del="${pg.id}" title="Excluir pagamento">${ic('trash-2')}</button>` : ''}</td></tr>`; }).join('')}
      ${(d.pagamentos || []).slice(ps.length).map(pg => `<tr><td>extra</td><td></td><td class="num">${brl(pg.valor)}</td><td><span class="tag pago">Pago ${data(pg.data, true)}</span></td><td><button type="button" class="icone-btn mini perigo" data-del="${pg.id}">${ic('trash-2')}</button></td></tr>`).join('')}
    </tbody></table></div>`,
    aoAbrir: f => f.addEventListener('click', e => {
      const b = e.target.closest('[data-del]'); if(!b) return;
      F.excluirPagamentoDivida(d, d.pagamentos.find(p => p.id === b.dataset.del));
    }),
  });
}
