// Assinaturas: cobranças que repetem sozinhas, no cartão (entram em cada fatura) ou na conta.
import {estado, achar, redesenhar} from '../dados.js';
import * as C from '../calc.js';
import {$, esc, ic, brl, data, vazio, chipCategoria} from '../ui.js';
import * as F from '../formularios.js';

let verEncerradas = false;
// próxima cobrança a partir de hoje
export function proximaCobranca(r){
  const h = C.hoje(), lim = C.somaMeses(h, r.frequencia === 'anual' ? 13 : 2);
  return C.ocorrencias(r, lim).find(d => d >= h);
}
const porMes = r => r.frequencia === 'anual' ? Math.round(r.valor / 12) : r.valor;
const onde = r => r.cartaoId ? 'Cartão ' + ((achar('cartoes', r.cartaoId) || {}).nome || '—') : 'Conta ' + ((achar('contas', r.contaId) || {}).nome || '—');

export function render(el){
  const todas = estado.recorrencias.filter(r => r.assinatura), ativas = todas.filter(r => r.ativa !== false), encerradas = todas.filter(r => r.ativa === false);
  const mes = ativas.reduce((s, r) => s + porMes(r), 0);
  const noCartao = ativas.filter(r => r.cartaoId).reduce((s, r) => s + porMes(r), 0);
  const lista = (verEncerradas ? encerradas : ativas).map(r => ({r, prox: proximaCobranca(r)})).sort((a, b) => (a.prox || '9').localeCompare(b.prox || '9'));
  el.innerHTML = `<div class="filtros"><button class="btn primario" data-nova>${ic('plus')}Nova assinatura</button><span class="cresce"></span>
      ${encerradas.length ? `<button class="btn ghost pequeno" data-enc>${verEncerradas ? 'Ver ativas' : `Encerradas (${encerradas.length})`}</button>` : ''}</div>
    ${todas.length ? `<div class="kpis">
      <div class="kpi destaque"><div class="kpi-cab"><span class="kpi-ic">${ic('repeat')}</span>Por mês</div><div class="kpi-v num">${brl(mes)}</div><div class="kpi-s">${ativas.length} ${ativas.length === 1 ? 'assinatura ativa' : 'assinaturas ativas'}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic">${ic('calendar')}</span>Por ano</div><div class="kpi-v num">${brl(mes * 12)}</div><div class="kpi-s">se nada mudar</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic ouro-bg">${ic('credit-card')}</span>No cartão</div><div class="kpi-v num">${brl(noCartao)}</div><div class="kpi-s">por mês, entram nas faturas</div></div>
    </div>
    <div class="card">${lista.length ? `<ul class="lista">${lista.map(({r, prox}) => `<li class="linha">${chipCategoria(r.categoriaId)}
        <div class="meio"><b>${esc(r.descricao)}</b><small>${esc(onde(r))} · ${r.frequencia === 'anual' ? 'todo ano' : 'todo mês'}, dia ${r.dia}${r.ativa === false ? ' · encerrada em ' + data(r.fim) : prox ? ' · próxima ' + data(prox) : ''}</small></div>
        <span class="valor">${brl(r.valor)}<small class="txt-fraco" style="font-weight:400">${r.frequencia === 'anual' ? '/ano' : '/mês'}</small></span>
        <span class="acoes"><button class="icone-btn mini" data-ed="${r.id}" title="Editar">${ic('pencil')}</button>
          ${r.ativa === false ? `<button class="icone-btn mini" data-reativar="${r.id}" title="Reativar">${ic('rotate-ccw')}</button>` : `<button class="icone-btn mini perigo" data-enc-uma="${r.id}" title="Cancelar assinatura">${ic('circle-stop')}</button>`}</span></li>`).join('')}</ul>`
      : '<p class="txt-fraco" style="padding:18px; margin:0">Nenhuma assinatura aqui.</p>'}</div>`
    : `<div class="card">${vazio('repeat', 'Nenhuma assinatura cadastrada', 'Streaming, música, nuvem, academia, celular… Cadastre uma vez: no cartão, ela entra sozinha em cada fatura; na conta, aparece todo mês nas despesas.', `<button class="btn primario" data-nova>${ic('plus')}Nova assinatura</button>`)}</div>`}`;
  el.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.nova !== undefined) return F.formAssinatura();
    if(b.dataset.enc !== undefined){ verEncerradas = !verEncerradas; return redesenhar(); }
    const r = achar('recorrencias', b.dataset.ed || b.dataset.encUma || b.dataset.reativar); if(!r) return;
    if(b.dataset.ed) F.formAssinatura(r);
    if(b.dataset.encUma) F.encerrarRecorrencia(r);
    if(b.dataset.reativar) F.reativarAssinatura(r);
  };
}
