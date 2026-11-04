// Calendário financeiro: o que vence e o que entra em cada dia do mês.
import {estado, achar, redesenhar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, abrirModal} from '../ui.js';
import * as F from '../formularios.js';

let mesVisto = null;
const TIPOS = {
  receita: {nome: 'Receitas', cor: 'var(--pos)'},
  despesa: {nome: 'Despesas', cor: 'var(--neg)'},
  fatura: {nome: 'Faturas de cartão', cor: 'var(--ouro-txt)'},
  divida: {nome: 'Parcelas de dívida', cor: '#D9822B'},
  prevista: {nome: 'Previstas (repetições)', cor: 'var(--roxo-2)'},
};

// eventos de um intervalo, por dia
export function eventos(ini, fim){
  const ev = [];
  estado.transacoes.filter(t => C.entre(t.data, ini, fim)).forEach(t => ev.push({data: t.data, tipo: t.tipo, nome: t.descricao, valor: t.valor, feito: !!t.pagoEm, t}));
  C.previstasEntre(ini, fim).forEach(({r, data: d}) => ev.push({data: d, tipo: 'prevista', nome: r.descricao, valor: r.valor, sinal: r.tipo}));
  estado.cartoes.forEach(c => C.faturasDoCartao(c).filter(f => f.total > 0 && C.entre(f.vencimento, ini, fim)).forEach(f => ev.push({data: f.vencimento, tipo: 'fatura', nome: 'Fatura ' + c.nome, valor: f.total, feito: f.restante <= 0, c, f})));
  estado.dividas.forEach(d => C.parcelasDivida(d).filter(p => C.entre(p.vencimento, ini, fim)).forEach(p => ev.push({data: p.vencimento, tipo: 'divida', nome: `${d.credor} ${p.n}/${d.parcelas}`, valor: p.valor, feito: p.pago, d})));
  return ev;
}

export function render(el){
  const h = C.hoje(), k = mesVisto || C.chaveMes(h), ini = C.inicioMes(k), fim = C.fimMes(k);
  const [a, m] = C.partes(ini), primeiroDia = new Date(a, m - 1, 1).getDay(), n = C.diasNoMes(a, m);
  const gIni = C.somaDias(ini, -primeiroDia), total = Math.ceil((primeiroDia + n) / 7) * 7, gFim = C.somaDias(gIni, total - 1);
  const ev = eventos(gIni, gFim), porDia = {};
  ev.forEach(e => (porDia[e.data] = porDia[e.data] || []).push(e));
  const doMes = ev.filter(e => C.entre(e.data, ini, fim));
  const entra = doMes.filter(e => e.tipo === 'receita' || (e.tipo === 'prevista' && e.sinal === 'receita')).reduce((s, e) => s + e.valor, 0);
  const sai = doMes.filter(e => ['despesa', 'fatura', 'divida'].includes(e.tipo) || (e.tipo === 'prevista' && e.sinal === 'despesa')).reduce((s, e) => s + e.valor, 0);
  el.innerHTML = `<div class="filtros">
      <div class="pilulas"><button type="button" data-m="-1" aria-label="Mês anterior">${ic('chevron-left')}</button><button type="button" class="ativo">${C.nomeMes(k)}</button><button type="button" data-m="1" aria-label="Próximo mês">${ic('chevron-right')}</button></div>
      ${k !== C.chaveMes(h) ? '<button class="btn ghost pequeno" data-m="0">Hoje</button>' : ''}
      <span class="cresce"></span><span style="font-size:13px">Entra <b class="txt-pos">${brl(entra)}</b> · sai <b class="txt-neg">${brl(sai)}</b></span></div>
    <div class="card" style="overflow:hidden">
      <div class="cal">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-sem">${d}</div>`).join('')}
        ${Array.from({length: total}, (_, i) => {
          const d = C.somaDias(gIni, i), es = (porDia[d] || []).sort((x, y) => x.tipo.localeCompare(y.tipo));
          return `<div class="cal-dia ${C.chaveMes(d) !== k ? 'fora' : ''} ${d === h ? 'hoje' : ''}" data-dia="${d}" role="button" tabindex="0" aria-label="${data(d)}: ${es.length} ${es.length === 1 ? 'item' : 'itens'}">
            <span class="cal-n">${+d.slice(8)}</span>
            ${es.slice(0, 3).map(e => `<span class="cal-ev ${e.feito ? 'feito' : ''}" style="--c:${TIPOS[e.tipo].cor}" title="${esc(e.nome)} · ${brl(e.valor)}">${esc(e.nome)}</span>`).join('')}
            ${es.length > 3 ? `<span class="cal-mais">+${es.length - 3}</span>` : ''}</div>`;
        }).join('')}</div>
      <div class="cores-cal">${Object.values(TIPOS).map(t => `<span style="--c:${t.cor}"><i></i>${t.nome}</span>`).join('')}<span class="txt-fraco">riscado = pago</span></div>
    </div>`;
  $$('[data-m]', el).forEach(b => b.onclick = () => { const x = +b.dataset.m; mesVisto = x ? C.chaveMes(C.somaMeses(ini, x)) : null; redesenhar(); });
  const abrir = d => dia(d, porDia[d] || []);
  el.onclick = e => { const c = e.target.closest('[data-dia]'); if(c) abrir(c.dataset.dia); };
  el.onkeydown = e => { const c = e.target.closest('[data-dia]'); if(c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); abrir(c.dataset.dia); } };
}

function dia(d, es){
  abrirModal({
    titulo: (t => t[0].toUpperCase() + t.slice(1))(new Date(d + 'T12:00').toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'})),
    corpo: es.length ? `<ul class="historico">${es.map((e, i) => `<li><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${TIPOS[e.tipo].cor};margin-right:6px"></i>${esc(e.nome)}${e.feito ? ' <span class="tag pago">pago</span>' : ''}</span>
        <span><b>${brl(e.valor)}</b>${e.t ? ` <button type="button" class="btn pequeno" data-i="${i}">${e.feito ? 'Desfazer' : e.tipo === 'receita' ? 'Recebi' : 'Paguei'}</button>` : e.tipo === 'fatura' && !e.feito ? ` <button type="button" class="btn pequeno" data-i="${i}">Pagar</button>` : e.tipo === 'divida' && !e.feito ? ` <button type="button" class="btn pequeno" data-i="${i}">Pagar</button>` : ''}</span></li>`).join('')}</ul>`
      : '<p class="nota">Nada neste dia.</p>',
    rodape: `<button type="button" class="btn ghost" data-novo>${ic('plus')}Lançar neste dia</button>`,
    aoAbrir: f => f.addEventListener('click', e => {
      const b = e.target.closest('[data-i],[data-novo]'); if(!b) return;
      $('#modal').close();
      if(b.dataset.novo !== undefined) return setTimeout(() => { F.formTransacao('despesa'); const c = $('#modal [name=data]'); if(c) c.value = d; }, 30);
      const ev = es[+b.dataset.i];
      setTimeout(() => ev.t ? F.alternarPago(ev.t) : ev.tipo === 'fatura' ? F.formPagarFatura(ev.c, ev.f.key) : F.formPagarDivida(ev.d), 30);
    }),
  });
}
