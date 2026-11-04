// Planejamento: orçamento do mês, limite por categoria e planejado x realizado.
import {estado, alterar, redesenhar, categoria} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, pct, vazio, barra, chipCategoria, abrirModal, campo, valorCampo, lerValor, toast, graficoBarras} from '../ui.js';

let mesVisto = null;

export function render(el){
  const k = mesVisto || C.chaveMes(C.hoje()), o = C.orcamentoDoMes(k), tem = o.linhas.length || estado.orcamento.total;
  const resta = o.total - o.gastoTotal;
  const diasFalta = k === C.chaveMes(C.hoje()) ? C.difDias(C.hoje(), C.fimMes(k)) + 1 : 0;
  el.innerHTML = `<div class="filtros">
      <div class="pilulas"><button type="button" data-m="-1" aria-label="Mês anterior">${ic('chevron-left')}</button><button type="button" class="ativo">${C.nomeMes(k)}</button><button type="button" data-m="1" aria-label="Próximo mês">${ic('chevron-right')}</button></div>
      <span class="cresce"></span><button class="btn primario" data-def>${ic('sliders-horizontal')}${tem ? 'Ajustar orçamento' : 'Definir orçamento'}</button></div>
    ${!tem ? `<div class="card">${vazio('chart-pie', 'Sem orçamento definido', 'Defina quanto quer gastar no mês e um limite para cada categoria. O Septim avisa quando chegar a 80% e quando passar.', `<button class="btn primario" data-def>${ic('sliders-horizontal')}Definir orçamento</button>`)}</div>` : `
    <div class="kpis">
      <div class="kpi destaque"><div class="kpi-cab"><span class="kpi-ic">${ic('wallet')}</span>Ainda pode gastar</div><div class="kpi-v num">${brl(Math.max(0, resta))}</div><div class="kpi-s">${resta < 0 ? 'passou ' + brl(-resta) : diasFalta ? brl(resta / diasFalta) + ' por dia, ' + diasFalta + ' dias' : 'do orçamento do mês'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic">${ic('target')}</span>Orçamento</div><div class="kpi-v num">${brl(o.total)}</div><div class="kpi-s">${estado.orcamento.total ? 'valor definido' : 'soma dos limites'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic neg-bg">${ic('arrow-up-right')}</span>Gasto</div><div class="kpi-v num">${brl(o.gastoTotal)}</div><div class="kpi-s">${pct(o.pct)} do orçamento</div>${barra(o.pct, o.pct >= 100 ? 'var(--neg)' : o.pct >= 80 ? 'var(--warn)' : '')}</div>
    </div>
    ${o.linhas.filter(l => l.pct >= 80).length || o.pct >= 80 ? `<div class="alertas">${o.pct > 100 ? `<div class="aviso-item nv-perigo"><span class="aviso-ic">${ic('triangle-alert')}</span><span>O orçamento do mês foi ultrapassado em <b>${brl(o.gastoTotal - o.total)}</b>.</span></div>` : o.pct >= 80 ? `<div class="aviso-item nv-atencao"><span class="aviso-ic">${ic('triangle-alert')}</span><span>Você já usou <b>${pct(o.pct)}</b> do orçamento do mês.</span></div>` : ''}
      ${o.linhas.filter(l => l.pct >= 80).map(l => `<div class="aviso-item ${l.pct > 100 ? 'nv-perigo' : 'nv-atencao'}"><span class="aviso-ic">${ic('chart-pie')}</span><span><b>${esc(l.nome)}</b> ${l.pct > 100 ? `passou do limite em ${brl(l.gasto - l.limite)}` : `chegou a ${pct(l.pct)} do limite`}.</span></div>`).join('')}</div>` : ''}
    <div class="grade g2">
      <div class="card"><div class="card-cab"><h2>${ic('list-checks')}Por categoria</h2><small>gasto / limite</small></div>
        ${o.linhas.length ? o.linhas.map(l => `<div class="orc-linha ${l.pct > 100 ? 'passou' : l.pct >= 80 ? 'quase' : ''}">${chipCategoria(l.id)}<b>${esc(l.nome)}</b><span class="num">${brl(l.gasto)} <span class="txt-fraco">/ ${brl(l.limite)}</span></span>
          ${barra(l.pct)}<div class="orc-txt"><span>${pct(l.pct)}</span><span>${l.limite - l.gasto >= 0 ? 'restam ' + brl(l.limite - l.gasto) : '<span class="txt-neg">passou ' + brl(l.gasto - l.limite) + '</span>'}</span></div></div>`).join('')
          : '<p class="txt-fraco" style="padding:16px 18px; margin:0">Nenhum limite por categoria. Defina em "Ajustar orçamento".</p>'}
        ${o.semLimite.length ? `<div class="dia-cab">Sem limite definido</div>${o.semLimite.map(g => `<div class="orc-linha">${chipCategoria(g.id)}<b>${esc(g.nome)}</b><span class="num">${brl(g.valor)}</span></div>`).join('')}` : ''}
      </div>
      <div class="card"><div class="card-cab"><h2>${ic('chart-column')}Planejado x realizado</h2></div><div class="card-corpo">
        ${graficoBarras({rotulos: o.linhas.map(l => l.nome), series: [{nome: 'Planejado', cor: 'var(--roxo-mut)', valores: o.linhas.map(l => l.limite)}, {nome: 'Realizado', cor: 'var(--roxo-2)', valores: o.linhas.map(l => l.gasto)}]})}
        <p class="txt-fraco" style="font-size:12px; margin:10px 0 0">Conta tudo que é despesa no mês: lançamentos, parcelas de cartão (no mês da fatura) e parcelas de dívida. O mesmo orçamento vale para todos os meses.</p></div></div>
    </div>`}`;
  $$('[data-def]', el).forEach(b => b.onclick = definir);
  $$('[data-m]', el).forEach(b => b.onclick = () => { mesVisto = C.chaveMes(C.somaMeses(k + '-01', +b.dataset.m)); redesenhar(); });
}

function definir(){
  const cats = estado.categorias.filter(c => c.tipo === 'despesa'), lim = estado.orcamento.limites || {};
  // sugestão: média dos últimos 3 meses de cada categoria
  const h = C.hoje(), ini = C.somaMeses(C.inicioMes(h), -3), fim = C.fimMes(C.somaMeses(C.inicioMes(h), -1));
  const media = Object.fromEntries(C.porCategoria(C.despesasEntre(ini, fim)).map(c => [c.id, Math.round(c.valor / 3)]));
  abrirModal({
    titulo: 'Orçamento mensal', larga: true, botao: 'Salvar orçamento',
    corpo: `<div class="grade-form">${campo('valor', 'total', 'Orçamento total do mês', valorCampo(estado.orcamento.total), {largo: true, dica: 'Deixe vazio para usar a soma dos limites por categoria.'})}</div>
      <p class="nota">Limite por categoria (deixe vazio para não limitar). Ao lado, a média dos últimos 3 meses como referência.</p>
      <div class="grade-form">${cats.map(c => campo('valor', 'c_' + c.id, `${esc(c.nome)}${media[c.id] ? ` <span class="txt-fraco">· média ${brl(media[c.id])}</span>` : ''}`, valorCampo(lim[c.id]))).join('')}</div>`,
    aoSalvar: d => {
      const total = d.total.trim() ? lerValor(d.total) : 0;
      if(!(total >= 0)) return 'Orçamento total inválido.';
      const limites = {};
      for(const c of cats){ const v = d['c_' + c.id].trim(); if(!v) continue; const n = lerValor(v); if(!(n >= 0)) return `Limite inválido em ${c.nome}.`; if(n) limites[c.id] = n; }
      toast('Orçamento salvo', alterar('Orçamento salvo', e => { e.orcamento = {total, limites}; }));
    },
  });
}
