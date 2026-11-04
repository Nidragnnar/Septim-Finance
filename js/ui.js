// Peças de interface: formatação, ícones, janelas, avisos, campos e gráficos em SVG.
import {estado, restaurar, categoria} from './dados.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/* ================= números e datas ================= */
const fmt = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
export const oculto = () => estado.config.ocultarValores;
export const brl = c => oculto() ? 'R$ •••••' : fmt.format((c || 0) / 100);
export const brlSinal = c => (c > 0 ? '+' : c < 0 ? '−' : '') + brl(Math.abs(c));
export const brlCurto = c => {
  if(oculto()) return '•••';
  const v = Math.abs(c) / 100, s = c < 0 ? '−' : '';
  return v >= 1e6 ? s + (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 ? s + (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace('.', ',') + ' mil' : s + Math.round(v);
};
// '1.234,56' ou '1234.56' → centavos; NaN se não for número
export function lerValor(t){
  let s = String(t ?? '').trim().replace(/[R$\s]/g, '');
  if(!s) return NaN;
  if(s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // 3.000 ou 1.250.000: ponto de milhar
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
}
export const valorCampo = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
export function data(iso, curta = false){
  if(!iso) return '';
  const [a, m, d] = iso.split('-');
  if(curta) return `${d}/${m}`;
  return estado.config.formatoData === 'aaaa-mm-dd' ? iso : estado.config.formatoData === 'mm/dd/aaaa' ? `${m}/${d}/${a}` : `${d}/${m}/${a}`;
}
export const pct = v => (Math.round(v * 10) / 10).toString().replace('.', ',') + '%';

/* ================= ícones (Lucide) ================= */
export const ic = (nome, cls = '') => `<i data-lucide="${nome}" class="ic ${cls}"></i>`;
export const desenharIcones = () => { try{ window.lucide && window.lucide.createIcons(); }catch(e){} desenharGraficos(); };

/* ================= aviso com desfazer ================= */
let timerToast;
export function toast(texto, foto){
  const t = $('#toast');
  t.innerHTML = `<span>${esc(texto)}</span>` + (foto ? '<button type="button">Desfazer</button>' : '');
  t.hidden = false; t.classList.remove('saindo');
  // só desfaz se nada mudou depois; senão a alteração mais nova se perderia junto
  const marca = (estado.historico[0] || {}).id;
  if(foto) $('button', t).onclick = () => {
    fecharToast();
    if((estado.historico[0] || {}).id !== marca) return setTimeout(() => toast('Houve outra alteração depois desta; não dá mais para desfazer por aqui'), 250);
    restaurar(foto, 'Desfeito: ' + texto);
  };
  clearTimeout(timerToast); timerToast = setTimeout(fecharToast, foto ? 7000 : 2500);
}
function fecharToast(){ const t = $('#toast'); t.classList.add('saindo'); setTimeout(() => { t.hidden = true; }, 200); }

/* ================= janela (formulários) ================= */
// aoSalvar(dados, form) devolve um texto de erro ou nada; sem erro, a janela fecha
// aoFechar(salvou) roda em qualquer saída (botão, Esc ou salvar), sem depender do evento "close"
let fecharAtual = null;
export function abrirModal({titulo, corpo, botao = 'Salvar', aoSalvar, aoAbrir, aoFechar, larga = false, rodape = ''}){
  const d = $('#modal');
  if(fecharAtual) fecharAtual(false);           // outra janela aberta por cima: a anterior conta como cancelada
  let fechada = false;
  const fechar = salvou => { if(fechada) return; fechada = true; fecharAtual = null; if(d.open) d.close(); if(aoFechar) aoFechar(salvou); };
  fecharAtual = fechar;
  d.className = larga ? 'larga' : '';
  d.innerHTML = `<form method="dialog" novalidate>
    <header><h2>${esc(titulo)}</h2><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic('x')}</button></header>
    <div class="modal-corpo">${corpo}</div>
    <p class="erro" role="alert" hidden></p>
    <footer>${rodape}<span class="cresce"></span><button type="button" class="btn ghost" data-fechar>${aoSalvar ? 'Cancelar' : 'Fechar'}</button>${aoSalvar ? `<button class="btn primario" type="submit">${esc(botao)}</button>` : ''}</footer>
  </form>`;
  const form = $('form', d);
  $$('[data-fechar]', d).forEach(b => b.onclick = () => fechar(false));
  d.oncancel = e => { e.preventDefault(); fechar(false); };
  form.onsubmit = async e => {
    e.preventDefault();
    if(!aoSalvar) return fechar(false);
    const dados = Object.fromEntries(new FormData(form));
    $$('input[type=checkbox]', form).forEach(c => { dados[c.name] = c.checked; });
    let erro;
    try{ erro = await aoSalvar(dados, form); }catch(err){ console.error(err); erro = 'Algo deu errado: ' + err.message; }
    if(erro){ const p = $('.erro', d); p.textContent = erro; p.hidden = false; return; }
    fechar(true);
  };
  desenharIcones();
  d.showModal();
  if(aoAbrir) aoAbrir(form);
  const primeiro = $('input:not([type=hidden]):not([type=checkbox]), select, textarea', form);
  if(primeiro && matchMedia('(pointer:fine)').matches) primeiro.focus();
  return form;
}
export const fecharModal = () => { if(fecharAtual) fecharAtual(false); else $('#modal').close(); };

export function confirmar(texto, botao = 'Excluir'){
  return new Promise(res => {
    abrirModal({titulo: 'Confirmar', corpo: `<p class="confirma">${texto}</p>`, botao, aoSalvar: () => {}, aoFechar: res});
    $('#modal button[type=submit]').classList.add('perigo');
  });
}

/* ================= campos de formulário ================= */
export function campo(tipo, nome, rotulo, valor = '', extra = {}){
  const id = 'f-' + nome, req = extra.obrigatorio ? 'required' : '', dica = extra.dica ? `<small class="dica">${extra.dica}</small>` : '';
  const largo = extra.largo ? ' largo' : '';
  let input;
  switch(tipo){
    case 'valor': input = `<div class="com-prefixo"><span>R$</span><input id="${id}" name="${nome}" inputmode="decimal" placeholder="0,00" value="${esc(valor)}" ${req} autocomplete="off"></div>`; break;
    case 'select': input = `<select id="${id}" name="${nome}" ${req}>${extra.opcoes.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`; break;
    case 'area': input = `<textarea id="${id}" name="${nome}" rows="2">${esc(valor)}</textarea>`; break;
    case 'check': return `<label class="check-linha${largo}"><input type="checkbox" name="${nome}" ${valor ? 'checked' : ''}><span>${rotulo}</span></label>`;
    case 'cor': input = `<input id="${id}" name="${nome}" type="color" value="${esc(valor || '#6A3FBF')}">`; break;
    case 'arquivo': input = `<input id="${id}" name="${nome}" type="file" accept="${extra.aceita || 'image/*,application/pdf'}">`; break;
    default: input = `<input id="${id}" name="${nome}" type="${tipo}" value="${esc(valor)}" ${extra.min != null ? `min="${extra.min}"` : ''} ${extra.max != null ? `max="${extra.max}"` : ''} ${extra.placeholder ? `placeholder="${esc(extra.placeholder)}"` : ''} ${req} autocomplete="off">`;
  }
  return `<label class="campo${largo}" for="${id}"><span>${rotulo}</span>${input}${dica}</label>`;
}
export const opcoesContas = (vazio) => [...(vazio ? [['', vazio]] : []), ...estado.contas.filter(c => !c.arquivada).map(c => [c.id, c.nome])];
export const opcoesCategorias = tipo => estado.categorias.filter(c => c.tipo === tipo && !(tipo === 'despesa' && c.sistema)).map(c => [c.id, c.nome]);
export const opcoesCartoes = () => estado.cartoes.map(c => [c.id, c.nome]);
export const FORMAS = [['pix', 'Pix'], ['debito', 'Cartão de débito'], ['credito', 'Cartão de crédito'], ['dinheiro', 'Dinheiro'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['debito-auto', 'Débito automático']];

/* ================= blocos ================= */
export const vazio = (icone, titulo, texto, acao = '') => `<div class="vazio">
  <div class="vazio-ic">${ic(icone)}</div><h3>${titulo}</h3><p>${texto}</p>${acao}</div>`;
export const chipCategoria = id => { const c = categoria(id); return `<span class="cat-ic" style="--c:${c.cor}">${ic(c.icone || 'circle')}</span>`; };
export const barra = (pctV, cor) => `<div class="trilho"><i style="width:${Math.max(0, Math.min(100, pctV)).toFixed(1)}%;${cor ? 'background:' + cor : ''}"></i></div>`;

/* ================= gráficos ================= */
// dica que segue o ponteiro: qualquer elemento com data-tip
export function iniciarDicas(){
  const tip = $('#tip');
  const mostrar = (alvo, x, y) => {
    tip.innerHTML = alvo.dataset.tip; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + 'px';
    tip.style.top = Math.max(8, y - r.height - 12) + 'px';
  };
  document.addEventListener('pointermove', e => { const a = e.target.closest('[data-tip]'); if(a) mostrar(a, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener('pointerdown', e => { const a = e.target.closest('[data-tip]'); if(a && e.pointerType !== 'mouse') mostrar(a, e.clientX, e.clientY); });
  document.addEventListener('scroll', () => { tip.hidden = true; }, true);
}
const teto = v => { if(v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
export const legenda = series => `<div class="legenda">${series.map(s => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
export const semDados = (texto = 'Sem dados neste período') => `<div class="graf-vazio">${ic('chart-no-axes-column')}<span>${texto}</span></div>`;

// barras e linhas são desenhadas depois de entrar na página, na largura real do cartão (e de novo se a largura mudar)
const graficos = new Map(); let nGraf = 0;
const lugar = (fn, args) => { const id = 'g' + (++nGraf); graficos.set(id, {fn, args}); return `<div class="graf" data-g="${id}"></div>`; };
export function desenharGraficos(){
  const vivos = new Set();
  $$('.graf[data-g]').forEach(el => {
    const g = graficos.get(el.dataset.g); if(!g) return;
    vivos.add(el.dataset.g);
    const w = Math.floor(el.clientWidth); if(!w || +el.dataset.w === w) return;
    el.dataset.w = w; el.innerHTML = g.fn(g.args, w);
  });
  // esquece os gráficos de telas que já saíram
  graficos.forEach((_, id) => { if(!vivos.has(id) && +id.slice(1) < nGraf - 40) graficos.delete(id); });
}
let timerGraf; addEventListener('resize', () => { clearTimeout(timerGraf); timerGraf = setTimeout(desenharGraficos, 120); });

// barras agrupadas (ou empilhadas) por rótulo
export function graficoBarras(args){
  const {rotulos, series, empilhar = false} = args;
  const totais = rotulos.map((_, i) => empilhar ? series.reduce((s, x) => s + Math.max(0, x.valores[i]), 0) : Math.max(...series.map(x => x.valores[i])));
  return totais.some(v => v > 0) ? lugar(barrasSVG, args) : semDados();
}
function barrasSVG({rotulos, series, altura = 220, empilhar = false}, largura){
  const totais = rotulos.map((_, i) => empilhar ? series.reduce((s, x) => s + Math.max(0, x.valores[i]), 0) : Math.max(...series.map(x => x.valores[i])));
  const W = Math.max(largura, rotulos.length * 44), H = altura, esq = 46, base = H - 24, alto = base - 10, max = teto(Math.max(...totais));
  const larg = (W - esq - 8) / rotulos.length, gb = empilhar ? 1 : series.length, bw = Math.min(26, (larg * .7) / gb);
  let g = '';
  for(let i = 0; i <= 4; i++){ const y = base - alto * i / 4; g += `<line x1="${esq}" x2="${W - 4}" y1="${y}" y2="${y}" class="grade"/><text x="${esq - 6}" y="${y + 4}" text-anchor="end" class="eixo">${brlCurto(max * i / 4)}</text>`; }
  rotulos.forEach((r, i) => {
    const cx = esq + larg * i + larg / 2;
    let acum = 0;
    series.forEach((s, j) => {
      const v = Math.max(0, s.valores[i] || 0), h = v / max * alto;
      const x = empilhar ? cx - bw / 2 : cx - (bw * gb) / 2 + j * bw, y = empilhar ? base - acum - h : base - h;
      if(v > 0) g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - (empilhar ? 0 : 2)).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="3" fill="${s.cor}" class="barra-anim" style="animation-delay:${i * 30}ms" data-tip="<b>${esc(r)}</b><br>${esc(s.nome)}: ${brl(v)}"/>`;
      acum += h;
    });
    g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="eixo">${esc(r.length > 12 && larg < 90 ? r.slice(0, 10) + '…' : r)}</text>`;
  });
  return `<div class="graf-rolar"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="grafico" role="img">${g}</svg></div>${legenda(series)}`;
}

// linhas (com área opcional) por rótulo; aceita valores negativos
export function graficoLinha(args){
  const todos = args.series.flatMap(s => s.valores);
  return !todos.length || todos.every(v => !v) ? semDados() : lugar(linhaSVG, args);
}
function linhaSVG({rotulos, series, altura = 220}, largura){
  const todos = series.flatMap(s => s.valores);
  const W = Math.max(largura, rotulos.length * 30), H = altura, esq = 50, base = H - 24, topo = 12;
  const maxV = teto(Math.max(0, ...todos)), minV = Math.min(0, ...todos) < 0 ? -teto(-Math.min(...todos)) : 0;
  const y = v => base - (v - minV) / (maxV - minV) * (base - topo);
  const x = i => rotulos.length === 1 ? (esq + W) / 2 : esq + (W - esq - 12) * i / (rotulos.length - 1);
  let g = '';
  for(let i = 0; i <= 4; i++){ const v = minV + (maxV - minV) * i / 4, yy = y(v); g += `<line x1="${esq}" x2="${W - 4}" y1="${yy}" y2="${yy}" class="grade ${v === 0 && minV < 0 ? 'zero' : ''}"/><text x="${esq - 6}" y="${yy + 4}" text-anchor="end" class="eixo">${brlCurto(v)}</text>`; }
  series.forEach(s => {
    const pts = s.valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    if(s.area) g += `<path d="M${x(0)},${y(Math.max(0, minV))} L${pts.join(' L')} L${x(s.valores.length - 1)},${y(Math.max(0, minV))} Z" fill="${s.cor}" opacity=".14"/>`;
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="linha-anim" ${s.tracejada ? 'stroke-dasharray="6 5"' : ''}/>`;
    s.valores.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.cor}" class="ponto" data-tip="<b>${esc(rotulos[i])}</b><br>${esc(s.nome)}: ${brl(v)}"/>`; });
  });
  const passo = Math.ceil(rotulos.length / Math.max(2, Math.floor((W - esq) / 46)));
  rotulos.forEach((r, i) => { if(i % passo === 0) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="eixo">${esc(r)}</text>`; });
  return `<div class="graf-rolar"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="grafico" role="img">${g}</svg></div>${series.length > 1 ? legenda(series) : ''}`;
}

// rosca com lista ao lado
export function graficoRosca({itens, centro = '', sub = '', max = 7}){
  itens = itens.filter(i => i.valor > 0);
  if(!itens.length) return semDados();
  if(itens.length > max){ const resto = itens.slice(max - 1); itens = [...itens.slice(0, max - 1), {nome: 'Outras', valor: resto.reduce((s, i) => s + i.valor, 0), cor: '#8E87A3'}]; }
  const total = itens.reduce((s, i) => s + i.valor, 0), R = 52, volta = 2 * Math.PI * R;
  let ja = 0;
  const fatias = itens.map(i => { const t = i.valor / total * volta; const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${i.cor}" stroke-width="20" stroke-dasharray="${Math.max(0, t - 1.5).toFixed(2)} ${volta.toFixed(2)}" stroke-dashoffset="${(-ja).toFixed(2)}" class="fatia" data-tip="<b>${esc(i.nome)}</b><br>${brl(i.valor)} · ${pct(i.valor / total * 100)}"/>`; ja += t; return s; }).join('');
  return `<div class="rosca-wrap">
    <svg viewBox="0 0 140 140" class="rosca" role="img"><g transform="rotate(-90 70 70)"><circle cx="70" cy="70" r="${R}" fill="none" class="rosca-trilho" stroke-width="20"/>${fatias}</g>
      <text x="70" y="66" text-anchor="middle" class="rosca-sub">${esc(sub)}</text><text x="70" y="84" text-anchor="middle" class="rosca-centro">${esc(centro || brlCurto(total))}</text></svg>
    <ul class="rosca-lista">${itens.map(i => `<li><i style="background:${i.cor}"></i><span>${esc(i.nome)}</span><b>${brl(i.valor)}</b><small>${pct(i.valor / total * 100)}</small></li>`).join('')}</ul>
  </div>`;
}
