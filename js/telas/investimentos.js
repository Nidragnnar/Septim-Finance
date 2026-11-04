// Investimentos: aplicado, valor atual informado por você, lucro e evolução.
import {estado, achar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, brlSinal, data, pct, vazio, abrirModal, graficoLinha, graficoRosca} from '../ui.js';
import * as F from '../formularios.js';

const TIPO = Object.fromEntries(F.TIPOS_INVEST);
const COR = {tesouro: '#5FBF92', cdb: '#9B7BDA', lci: '#56C2C9', acoes: '#4F74C8', fii: '#E0B44C', etf: '#C77DDB', cripto: '#D9822B', outro: '#8E87A3'};

export function render(el){
  const is = estado.investimentos, h = C.hoje();
  const atual = is.reduce((s, i) => s + C.valorInvestimento(i), 0), aplicado = is.reduce((s, i) => s + C.aplicadoLiquido(i, h), 0), lucro = atual - aplicado;
  const ult12 = Array.from({length: 12}, (_, n) => C.chaveMes(C.somaMeses(C.inicioMes(h), n - 11)));
  const fimDe = k => k === C.chaveMes(h) ? h : C.fimMes(k);
  const porTipo = Object.entries(is.reduce((m, i) => { m[i.tipo] = (m[i.tipo] || 0) + C.valorInvestimento(i); return m; }, {})).map(([t, v]) => ({nome: TIPO[t] || t, valor: v, cor: COR[t] || '#8E87A3'}));
  el.innerHTML = `<div class="filtros"><button class="btn primario" data-novo>${ic('plus')}Novo investimento</button></div>
    ${is.length ? `<div class="kpis">
      <div class="kpi destaque"><div class="kpi-cab"><span class="kpi-ic">${ic('gem')}</span>Valor atual</div><div class="kpi-v num">${brl(atual)}</div><div class="kpi-s">${is.length} ${is.length === 1 ? 'investimento' : 'investimentos'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic">${ic('arrow-down-to-line')}</span>Total aplicado</div><div class="kpi-v num">${brl(aplicado)}</div><div class="kpi-s">aplicações menos resgates</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic ${lucro >= 0 ? 'pos-bg' : 'neg-bg'}">${ic(lucro >= 0 ? 'trending-up' : 'trending-down')}</span>${lucro >= 0 ? 'Lucro' : 'Prejuízo'}</div><div class="kpi-v num ${lucro >= 0 ? 'txt-pos' : 'txt-neg'}">${brlSinal(lucro)}</div><div class="kpi-s">${aplicado ? pct(lucro / aplicado * 100) + ' sobre o aplicado' : ''}</div></div>
    </div>
    <div class="grade g-2-1">
      <div class="card"><div class="card-cab"><h2>${ic('chart-line')}Evolução</h2><small>últimos 12 meses</small></div><div class="card-corpo">
        ${graficoLinha({rotulos: ult12.map(k => C.nomeMes(k, true)), series: [{nome: 'Valor atual', cor: 'var(--ouro)', valores: ult12.map(k => is.reduce((s, i) => s + C.valorInvestimento(i, fimDe(k)), 0)), area: true}, {nome: 'Aplicado', cor: 'var(--roxo-mut)', valores: ult12.map(k => is.reduce((s, i) => s + C.aplicadoLiquido(i, fimDe(k)), 0)), tracejada: true}]})}
        <p class="txt-fraco" style="font-size:12px; margin:8px 0 0">O valor atual vem das atualizações que você registra. Sem atualização, vale o que foi aplicado.</p></div></div>
      <div class="card"><div class="card-cab"><h2>${ic('chart-pie')}Por tipo</h2></div><div class="card-corpo">${graficoRosca({itens: porTipo, sub: 'investido'})}</div></div>
    </div>
    <div class="card"><div class="card-cab"><h2>${ic('list')}Seus investimentos</h2></div><ul class="lista">${is.map(i => {
      const v = C.valorInvestimento(i), ap = C.aplicadoLiquido(i, h), l = v - ap, up = [...(i.atualizacoes || [])].sort((a, b) => b.data.localeCompare(a.data))[0];
      return `<li class="linha"><span class="cat-ic" style="--c:${COR[i.tipo] || '#8E87A3'}">${ic('trending-up')}</span>
        <div class="meio"><b>${esc(i.nome)}</b><small>${TIPO[i.tipo] || ''}${i.instituicao ? ' · ' + esc(i.instituicao) : ''}${i.rentabilidade ? ' · ' + esc(i.rentabilidade) : ''} · aplicado ${brl(ap)} · ${up ? 'atualizado em ' + data(up.data, true) : 'sem atualização'}</small></div>
        <span class="valor">${brl(v)}<br><small class="${l >= 0 ? 'txt-pos' : 'txt-neg'}" style="font-weight:500">${brlSinal(l)}</small></span>
        <span class="acoes"><button class="icone-btn mini" data-mov="aplicacao:${i.id}" title="Aplicar mais">${ic('plus')}</button><button class="icone-btn mini" data-mov="resgate:${i.id}" title="Resgatar">${ic('minus')}</button>
          <button class="icone-btn mini" data-mov="atualizar:${i.id}" title="Atualizar valor">${ic('refresh-cw')}</button><button class="icone-btn mini" data-hist="${i.id}" title="Histórico">${ic('history')}</button>
          <button class="icone-btn mini" data-ed="${i.id}" title="Editar">${ic('pencil')}</button><button class="icone-btn mini perigo" data-ex="${i.id}" title="Excluir">${ic('trash-2')}</button></span></li>`; }).join('')}</ul></div>`
    : `<div class="card">${vazio('trending-up', 'Nenhum investimento cadastrado', 'Tesouro, CDB, LCI, ações, fundos, cripto… Registre as aplicações e atualize o valor quando quiser: o Septim calcula lucro ou prejuízo, sem inventar cotações.', `<button class="btn primario" data-novo>${ic('plus')}Novo investimento</button>`)}</div>`}`;
  el.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.novo !== undefined) return F.formInvestimento();
    if(b.dataset.mov){ const [t, id] = b.dataset.mov.split(':'); const i = achar('investimentos', id); if(i) F.formMovInvest(i, t); return; }
    const i = achar('investimentos', b.dataset.ed || b.dataset.ex || b.dataset.hist); if(!i) return;
    if(b.dataset.ed) F.formInvestimento(i);
    if(b.dataset.ex) F.excluirInvestimento(i);
    if(b.dataset.hist) historico(i);
  };
}

function historico(i){
  const linhas = [...(i.movimentos || []).map(m => ({...m, lista: 'movimentos', txt: m.tipo === 'resgate' ? 'Resgate' : 'Aplicação'})), ...(i.atualizacoes || []).map(u => ({...u, lista: 'atualizacoes', txt: 'Valor atualizado'}))].sort((a, b) => b.data.localeCompare(a.data));
  abrirModal({
    titulo: 'Histórico · ' + i.nome,
    corpo: `<ul class="historico">${linhas.map(l => `<li><span>${data(l.data)} · ${l.txt}${l.contaId ? ' · ' + esc((achar('contas', l.contaId) || {}).nome || '') : ''}</span><span><b class="${l.tipo === 'resgate' ? 'txt-neg' : l.lista === 'movimentos' ? 'txt-pos' : ''}">${l.lista === 'atualizacoes' ? '= ' : l.tipo === 'resgate' ? '−' : '+'}${brl(l.valor)}</b> <button type="button" class="icone-btn mini perigo" data-del="${l.lista}:${l.id}" title="Excluir">${ic('trash-2')}</button></span></li>`).join('')}</ul>`,
    aoAbrir: f => f.addEventListener('click', e => {
      const b = e.target.closest('[data-del]'); if(!b) return;
      const [lista, id] = b.dataset.del.split(':');
      F.excluirMovInvest(i, i[lista].find(x => x.id === id), lista);
    }),
  });
}
