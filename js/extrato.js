// Importar extrato do banco (OFX ou CSV, testado com o Inter).
// Lido só neste aparelho; vira lançamento apenas o que você aprovar na revisão.
// Cada linha ganha um id tirado de data + valor + nome: importar o mesmo período de novo (ou o CSV depois do OFX) não duplica.
import {estado, alterar, achar, categoria, uid} from './dados.js';
import {chaveMes, fatura, faturasDoCartao, proximaParcela, restanteDivida, saldoConta} from './calc.js';
import {$, $$, esc, ic, brl, data, abrirModal, toast} from './ui.js';

const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hashTxt = s => { let h = 2166136261; for(const ch of s){ h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const lerTexto = buf => { try{ return new TextDecoder('utf-8', {fatal: true}).decode(buf); }catch(e){ return new TextDecoder('windows-1252').decode(buf); } };
const centavos = v => Math.round(v * 100);

// cada linha: {data:'2026-10-17', valor (reais, negativo = saída), nome, hist}
export function lerOFX(txt){
  const linhas = [...txt.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)].map(([, b]) => {
    const tag = t => ((b.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i')) || [])[1] || '').trim();
    const d = tag('DTPOSTED'), memo = tag('MEMO');
    return {data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, valor: parseFloat(tag('TRNAMT').replace(',', '.')), nome: tag('NAME') || memo, hist: memo.split(':')[0]};
  });
  const saldo = (txt.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i) || [])[1];
  return {linhas, saldo: saldo != null ? parseFloat(saldo.replace(',', '.')) : null, banco: ((txt.match(/<ORG>([^<\r\n]+)/i) || [])[1] || '').trim()};
}
export function lerCSV(txt){
  const linhas = txt.split(/\r?\n/).map(l => l.split(';').map(c => c.trim()));
  const num = v => parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  const saldoLinha = linhas.find(l => /^saldo$/.test(semAcento(l[0] || '')));
  const ic = linhas.findIndex(l => l.some(c => /^data/.test(semAcento(c))) && l.some(c => /^valor/.test(semAcento(c))));
  if(ic < 0) return {linhas: [], saldo: null, banco: ''};
  const cab = linhas[ic].map(semAcento), col = re => cab.findIndex(c => re.test(c));
  const cData = col(/^data/), cValor = col(/^valor/), cDesc = col(/^descri/), cHist = col(/^histor/);
  return {banco: /inter/i.test(txt.slice(0, 200)) ? 'Inter' : '', saldo: saldoLinha ? num(saldoLinha[1]) : null,
    linhas: linhas.slice(ic + 1).filter(l => /^\d{2}\/\d{2}\/\d{4}$/.test(l[cData] || '')).map(l => {
      const [d, m, a] = l[cData].split('/');
      return {data: `${a}-${m}-${d}`, valor: num(l[cValor]), nome: l[cDesc >= 0 ? cDesc : cHist] || '', hist: cHist >= 0 ? l[cHist] : ''};
    })};
}

// categoria pelo nome do estabelecimento (só as que existem no seu Septim)
const REGRAS = [
  ['combustivel', /posto|combust|shell|ipiranga|petro/], ['transporte', /uber|\b99\b|estacion|pedagio|mecanic|oficina|pneu|auto pecas/],
  ['mercado', /supermerc|mercado|atacad|acougue|hortifrut|sacolao/], ['alimentacao', /padaria|panific|pan e conf|confeit|drive|lanch|pizz|burger|ifood|restaur|\bbar\b|dog|sorvet|acai|cafe|churras|sushi|supermerc|mercado/],
  ['saude', /farmac|drogar|droga|clinic|hospital|laborat|odonto|medic/], ['internet', /power net|internet|fibra/], ['energia', /copel|energia|celesc|cemig|enel/],
  ['agua', /sanepar|sabesp|agua/], ['assinaturas', /recarga|tim\b|vivo|claro|netflix|spotify/], ['educacao', /senai|escola|faculdade|curso/],
  ['lazer', /cinema|steam|playstation|xbox|ingresso|\bgames?\b/],
];
const catPara = h => { for(const [id, re] of REGRAS) if(re.test(h) && estado.categorias.some(c => c.id === id)) return id; return 'outros-desp'; };
const palavras = s => semAcento(s).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
const pareceNome = (nome, txt) => palavras(nome).some(w => semAcento(txt).includes(w));
const nomeLimpo = (nome, hist) => { const n = String(nome).split(/\s{2,}/)[0].trim(), h = semAcento(hist); return /^pix/.test(h) ? 'Pix · ' + n : /recarga/.test(h) ? 'Recarga ' + n : n; };

// monta as linhas com a sugestão do que cada uma vira
function montar(brutas, contaId){
  const vistos = {}, usados = new Set(), h = s => semAcento(s);
  const itens = brutas.filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.data) && Number.isFinite(b.valor) && b.valor).map(b => {
    const base = b.data + '|' + Math.round(b.valor * 100) + '|' + h(b.nome).replace(/\s+/g, ' ').trim();
    vistos[base] = (vistos[base] || 0) + 1;
    const id = 'bx' + hashTxt(base) + (vistos[base] > 1 ? '-' + vistos[base] : ''), v = centavos(Math.abs(b.valor));
    // já veio antes: virou lançamento com este id, ou marcou algo como pago com este mesmo id de origem
    const ja = !!estado.apagados[id] || estado.transacoes.some(t => t.id === id || t.origemExtrato === id)
      || estado.pagamentosFatura.some(p => p.origemExtrato === id) || estado.dividas.some(d => (d.pagamentos || []).some(p => p.origemExtrato === id));
    return {...b, id, v, ja, desc: nomeLimpo(b.nome, b.hist), acao: 'x', motivo: ''};
  });
  itens.forEach(it => {
    const t = h(it.hist + ' ' + it.nome), k = chaveMes(it.data), pr = (acao, motivo = '') => { it.acao = acao; it.motivo = motivo; };
    // lançamento pendente do mesmo mês com o mesmo valor ou nome: marcar como pago em vez de criar outro
    const pendente = estado.transacoes.find(x => !x.pagoEm && x.tipo === (it.valor > 0 ? 'receita' : 'despesa') && chaveMes(x.data) === k && !usados.has(x.id)
      && (Math.abs(x.valor - it.v) < 1 || (pareceNome(x.descricao, it.nome) && Math.abs(x.valor - it.v) <= x.valor * .3)));
    // já lançado e pago no mesmo mês com o mesmo valor (ex.: conta fixa marcada como paga): só liga, não lança de novo
    const jaPago = !pendente && estado.transacoes.find(x => x.pagoEm && !x.origemExtrato && x.tipo === (it.valor > 0 ? 'receita' : 'despesa') && chaveMes(x.data) === k && !usados.has(x.id) && Math.abs(x.valor - it.v) < 1 && !x.id.startsWith('bx'));
    if(jaPago){ usados.add(jaPago.id); return pr('j:' + jaPago.id, 'já está lançado como ' + jaPago.descricao); }
    if(it.valor > 0){
      if(pendente){ usados.add(pendente.id); return pr('p:' + pendente.id, 'marca como recebida: ' + pendente.descricao); }
      if(/resgate|rendimento|evento b3|credito liberado|devolvid|estorno/.test(t)) return pr('x', 'não é renda: volta de investimento, crédito ou devolução');
      return pr('x', 'entrada: escolha uma categoria de receita se for renda');
    }
    if(/aplicac|investim|poupanca|porquinho/.test(t)) return pr('x', 'foi para investimento');
    if(pendente){ usados.add(pendente.id); return pr('p:' + pendente.id, 'marca como paga: ' + pendente.descricao); }
    const div = estado.dividas.find(d => restanteDivida(d) > 0 && !usados.has(d.id) && (pareceNome(d.credor, it.nome) || Math.abs(d.valorParcela - it.v) < 1));
    if(div){ usados.add(div.id); return pr('d:' + div.id, 'parcela de ' + div.credor); }
    if(/fatura/.test(t)){ const c = estado.cartoes.find(x => pareceNome(x.nome + ' ' + (x.banco || ''), it.nome + ' ' + it.hist)) || estado.cartoes[0];
      return c ? pr('f:' + c.id, 'pagamento de fatura não vira despesa de novo') : pr('g:outros-desp', 'cadastre o cartão para registrar como pagamento de fatura'); }
    pr('g:' + catPara(t));
  });
  // Pix que voltou: a ida e a volta se anulam
  itens.filter(it => it.valor > 0 && /devolvid|estorno/.test(h(it.hist))).forEach(volta => {
    const ida = itens.find(o => o.valor === -volta.valor && h(o.nome) === h(volta.nome) && o.acao !== 'x' && o.data <= volta.data);
    if(ida){ ida.acao = 'x'; ida.motivo = `voltou em ${data(volta.data, true)} (devolvido)`; }
  });
  return itens;
}

function opcoes(it){
  const k = chaveMes(it.data), o = [], rec = it.valor > 0;
  estado.categorias.filter(c => c.tipo === (rec ? 'receita' : 'despesa') && !c.sistema).forEach(c => o.push(['g:' + c.id, (rec ? 'Receita · ' : 'Despesa · ') + c.nome]));
  estado.transacoes.filter(x => !x.pagoEm && x.tipo === (rec ? 'receita' : 'despesa') && chaveMes(x.data) === k).forEach(x => o.push(['p:' + x.id, (rec ? 'Recebi: ' : 'Paguei: ') + x.descricao + ' (' + brl(x.valor) + ')']));
  estado.transacoes.filter(x => x.pagoEm && !x.origemExtrato && x.tipo === (rec ? 'receita' : 'despesa') && chaveMes(x.data) === k && Math.abs(x.valor - it.v) < 1 && x.id !== it.id).forEach(x => o.push(['j:' + x.id, 'Já lançado: ' + x.descricao]));
  if(!rec){
    estado.dividas.filter(d => restanteDivida(d) > 0).forEach(d => o.push(['d:' + d.id, 'Parcela · ' + d.credor]));
    estado.cartoes.forEach(c => o.push(['f:' + c.id, 'Pagamento de fatura · ' + c.nome]));
  }
  o.push(['x', 'Ignorar']);
  return o.map(([v, t]) => `<option value="${esc(v)}" ${v === it.acao ? 'selected' : ''}>${esc(t)}</option>`).join('');
}

let imp = null;
export function importarExtrato(){
  if(!estado.contas.some(c => !c.arquivada)) return toast('Cadastre a conta do banco antes (menu Contas)');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ofx,.csv,.txt';
  inp.onchange = async () => {
    const f = inp.files[0]; if(!f) return;
    try{
      const txt = lerTexto(await f.arrayBuffer()), lido = /<OFX>/i.test(txt) ? lerOFX(txt) : lerCSV(txt);
      if(!lido.linhas.length) return toast('Não achei lançamentos: o arquivo precisa ser o extrato em OFX ou CSV');
      revisar(lido);
    }catch(e){ console.error(e); toast('Não consegui ler esse extrato'); }
  };
  inp.click();
}
export function revisar(lido){
  const ativas = estado.contas.filter(c => !c.arquivada);
  const conta = (lido.banco && ativas.find(c => semAcento(c.nome + ' ' + c.instituicao).includes(semAcento(lido.banco).split(' ').find(w => w.length > 3) || '¬'))) || ativas[0];
  imp = {lido, contaId: conta.id, itens: montar(lido.linhas, conta.id)};
  const novos = imp.itens.filter(i => !i.ja), velhos = imp.itens.length - novos.length, datas = imp.itens.map(i => i.data).sort();
  abrirModal({
    titulo: 'Importar extrato', larga: true, botao: 'Lançar',
    corpo: `<div class="grade-form"><label class="campo largo"><span>Conta deste extrato</span><select name="contaId">${ativas.map(c => `<option value="${c.id}" ${c.id === conta.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label></div>
      <p class="nota">${imp.itens.length} lançamentos de ${data(datas[0])} a ${data(datas[datas.length - 1])}${velhos ? ` · ${velhos} já ${velhos === 1 ? 'importado' : 'importados'} antes (escondidos)` : ''}.
        Confira o que cada um vira.${lido.saldo != null ? ` <br>Saldo no extrato: <b>${brl(centavos(lido.saldo))}</b> · no Septim: <b data-saldo-septim>${brl(saldoConta(conta))}</b>` : ''}</p>
      <ul class="lista ex-lista">${novos.map(it => `<li class="ex ${it.acao === 'x' ? 'ign' : ''}">
        <span class="ex-dia num">${data(it.data, true)}</span>
        <span class="ex-nome" title="${esc(it.nome)}">${esc(it.desc)}<small>${esc(it.hist)}</small></span>
        <span class="valor num ${it.valor > 0 ? 'txt-pos' : ''}">${it.valor > 0 ? '+' : '−'}${brl(it.v)}</span>
        <select data-ex="${esc(it.id)}" aria-label="O que fazer com ${esc(it.desc)}">${opcoes(it)}</select>
        ${it.motivo ? `<span class="ex-motivo">${esc(it.motivo)}</span>` : ''}</li>`).join('') || '<li class="vazio">Tudo deste arquivo já foi importado.</li>'}</ul>`,
    aoAbrir: f => {
      const contar = () => { const n = imp.itens.filter(i => !i.ja && i.acao !== 'x').length; const b = $('#modal button[type=submit]'); b.textContent = n ? `Lançar ${n}` : 'Nada para lançar'; b.disabled = !n; };
      f.addEventListener('change', e => {
        if(e.target.name === 'contaId'){ imp.contaId = e.target.value; const s = $('[data-saldo-septim]', f); if(s) s.textContent = brl(saldoConta(achar('contas', imp.contaId))); return; }
        const it = imp.itens.find(x => x.id === e.target.dataset.ex); if(!it) return;
        it.acao = e.target.value; e.target.closest('li').classList.toggle('ign', it.acao === 'x'); contar();
      });
      contar();
    },
    aoSalvar: () => aplicar(),
  });
}
function aplicar(){
  const usar = imp.itens.filter(i => !i.ja && i.acao !== 'x'), contaId = imp.contaId;
  if(!usar.length) return 'Nada para lançar.';
  toast(`Extrato: ${usar.length} ${usar.length === 1 ? 'lançamento' : 'lançamentos'}`, alterar('Extrato importado: ' + usar.length + ' lançamentos', e => usar.forEach((it, i) => {
    const p = it.acao.indexOf(':'), tipo = p < 0 ? it.acao : it.acao.slice(0, p), alvo = it.acao.slice(p + 1);   // o id pode ter dois-pontos
    if(tipo === 'g') e.transacoes.push({id: it.id, tipo: it.valor > 0 ? 'receita' : 'despesa', descricao: it.desc, valor: it.v, categoriaId: alvo, contaId, data: it.data, pagoEm: it.data, forma: '', origem: '', obs: 'Do extrato', criadoEm: Date.now() + i});
    else if(tipo === 'p'){ const x = e.transacoes.find(y => y.id === alvo); if(x && !x.pagoEm){ x.pagoEm = it.data; x.contaId = contaId; x.valor = it.v; x.origemExtrato = it.id; } }
    else if(tipo === 'j'){ const x = e.transacoes.find(y => y.id === alvo); if(x) x.origemExtrato = it.id; }
    else if(tipo === 'd'){ const d = e.dividas.find(y => y.id === alvo); if(d) d.pagamentos.push({id: uid(), valor: it.v, data: it.data, contaId, origemExtrato: it.id}); }
    else if(tipo === 'f'){
      // fatura que vence mais perto da data do pagamento e ainda tem saldo
      const c = e.cartoes.find(y => y.id === alvo); if(!c) return;
      const fs = faturasDoCartao(c).filter(f => f.restante > 0).sort((a, b) => Math.abs(new Date(a.vencimento) - new Date(it.data)) - Math.abs(new Date(b.vencimento) - new Date(it.data)));
      e.pagamentosFatura.push({id: uid(), cartaoId: c.id, fatura: (fs[0] || {key: chaveMes(it.data)}).key, valor: it.v, data: it.data, contaId, origemExtrato: it.id, criadoEm: Date.now()});
    }
  })));
}
