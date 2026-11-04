// Metas financeiras: objetivo, progresso e depósitos.
import {estado, achar, alterar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, pct, vazio, barra, abrirModal, confirmar, toast} from '../ui.js';
import * as F from '../formularios.js';

export function render(el){
  const ms = estado.metas, h = C.hoje();
  const guardado = ms.reduce((s, m) => s + C.acumuladoMeta(m), 0), alvo = ms.reduce((s, m) => s + m.alvo, 0);
  el.innerHTML = `<div class="filtros"><button class="btn primario" data-nova>${ic('plus')}Nova meta</button></div>
    ${ms.length ? `<div class="kpis">
      <div class="kpi destaque emblema-grifo"><div class="kpi-cab"><span class="kpi-ic">${ic('piggy-bank')}</span>Guardado nas metas</div><div class="kpi-v num">${brl(guardado)}</div><div class="kpi-s">de ${brl(alvo)} · ${pct(alvo ? guardado / alvo * 100 : 0)}</div></div>
      <div class="kpi"><div class="kpi-cab"><span class="kpi-ic pos-bg">${ic('trophy')}</span>Atingidas</div><div class="kpi-v num">${ms.filter(m => C.acumuladoMeta(m) >= m.alvo).length} de ${ms.length}</div></div>
    </div>
    <div class="mini-cards">${ms.map(m => {
      const a = C.acumuladoMeta(m), p = C.pctMeta(m), falta = Math.max(0, m.alvo - a);
      const meses = m.dataPrevista && m.dataPrevista > h ? Math.max(1, (C.partes(m.dataPrevista)[0] - C.partes(h)[0]) * 12 + C.partes(m.dataPrevista)[1] - C.partes(h)[1]) : 0;
      const atrasada = m.dataPrevista && m.dataPrevista < h && falta > 0;
      return `<div class="card mc">
        <div class="mc-cab"><span class="cat-ic" style="--c:${m.cor}">${ic(p >= 100 ? 'trophy' : 'target')}</span><div class="meio"><b>${esc(m.nome)}</b><small>${m.dataPrevista ? (atrasada ? '<span class="txt-neg">prazo passou: ' + data(m.dataPrevista) + '</span>' : 'até ' + data(m.dataPrevista)) : 'sem prazo'}</small></div>
          <button class="icone-btn mini" data-ed="${m.id}" title="Editar">${ic('pencil')}</button><button class="icone-btn mini perigo" data-ex="${m.id}" title="Excluir">${ic('trash-2')}</button></div>
        <div class="mc-nums"><span>Guardado<br><b>${brl(a)}</b></span><span style="text-align:right">Objetivo<br><b>${brl(m.alvo)}</b></span></div>
        ${barra(p, m.cor)}
        <div class="mc-nums" style="font-size:12.5px"><span>${pct(p)}</span><span>${falta ? `faltam ${brl(falta)}${meses ? ` · ${brl(Math.ceil(falta / meses))}/mês` : ''}` : '<span class="txt-pos">meta atingida!</span>'}</span></div>
        <div class="mc-acoes"><button class="btn pequeno primario" data-dep="${m.id}">${ic('plus')}Depositar</button><button class="btn pequeno" data-hist="${m.id}">${ic('history')}Histórico (${(m.depositos || []).length})</button></div>
      </div>`; }).join('')}</div>`
    : `<div class="card">${vazio('target', 'Nenhuma meta ainda', 'Reserva de emergência, viagem, carro, computador… Defina o valor e a data, e acompanhe o progresso a cada depósito.', `<button class="btn primario" data-nova>${ic('plus')}Criar primeira meta</button>`, 'grifo')}</div>`}`;
  el.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.nova !== undefined) return F.formMeta();
    const m = achar('metas', b.dataset.ed || b.dataset.ex || b.dataset.dep || b.dataset.hist); if(!m) return;
    if(b.dataset.ed) F.formMeta(m);
    if(b.dataset.ex) F.excluirMeta(m);
    if(b.dataset.dep) F.formDeposito(m);
    if(b.dataset.hist) historico(m);
  };
}

function historico(m){
  const ds = [...(m.depositos || [])].sort((a, b) => b.data.localeCompare(a.data));
  abrirModal({
    titulo: 'Histórico · ' + m.nome,
    corpo: ds.length ? `<ul class="historico">${ds.map(d => `<li><span>${data(d.data)}${d.obs ? ' · ' + esc(d.obs) : ''}</span><span><b class="${d.valor < 0 ? 'txt-neg' : 'txt-pos'}">${d.valor < 0 ? '−' : '+'}${brl(Math.abs(d.valor))}</b> <button type="button" class="icone-btn mini perigo" data-del="${d.id}" title="Excluir">${ic('trash-2')}</button></span></li>`).join('')}</ul>`
      : '<p class="nota">Nenhum depósito ainda.</p>',
    aoAbrir: f => f.addEventListener('click', async e => {
      const b = e.target.closest('[data-del]'); if(!b) return;
      const id = b.dataset.del;
      if(!await confirmar('Excluir este registro?')) return;
      toast('Registro excluído', alterar('Registro de meta excluído', st => { const x = st.metas.find(y => y.id === m.id); x.depositos = x.depositos.filter(d => d.id !== id); }));
    }),
  });
}
