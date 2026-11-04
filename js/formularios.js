// Formulários de cadastro e edição. Toda gravação passa por alterar(), que guarda histórico e permite desfazer.
import {estado, uid, alterar, achar, categoria} from './dados.js';
import {saldoConta, hoje, gerarRecorrencias, somaMeses, parcelasDaCompra, nomeMes, fatura, faturaAtualKey, partes, totalDivida, pagoDivida, proximaParcela, acumuladoMeta, valorInvestimento, chaveMes, limiteUsado} from './calc.js';
import {$, esc, brl, lerValor, valorCampo, data, campo, abrirModal, confirmar, toast, opcoesContas, opcoesCategorias, opcoesCartoes, FORMAS, ic} from './ui.js';

const ok = (texto, fn) => toast(texto, alterar(texto, fn));
const dataValida = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const precisaConta = () => estado.contas.some(c => !c.arquivada) ? '' : 'Cadastre uma conta antes (menu Contas): é nela que o dinheiro entra e sai.';

/* ================= anexos: ficam só neste aparelho (IndexedDB) ================= */
const banco = () => new Promise((res, rej) => { const r = indexedDB.open('septim-anexos', 1); r.onupgradeneeded = () => r.result.createObjectStore('anexos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function anexoOp(modo, fn){ const db = await banco(); return new Promise((res, rej) => { const t = db.transaction('anexos', modo), q = fn(t.objectStore('anexos')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); }
export const guardarAnexo = (id, arquivo) => anexoOp('readwrite', s => s.put(arquivo, id));
export const lerAnexo = id => anexoOp('readonly', s => s.get(id));
export const apagarAnexo = id => anexoOp('readwrite', s => s.delete(id)).catch(() => {});
export async function verAnexo(id){
  const f = await lerAnexo(id).catch(() => null);
  if(!f) return toast('Comprovante não está neste aparelho');
  window.open(URL.createObjectURL(f), '_blank');
}

/* ================= receitas e despesas ================= */
export function formTransacao(tipo, t = null){
  const falta = precisaConta();
  const despesa = tipo === 'despesa', novo = !t;
  const v = t || {descricao: '', valor: 0, categoriaId: despesa ? 'alimentacao' : 'salario', contaId: (estado.contas.find(c => !c.arquivada) || {}).id, data: hoje(), pagoEm: null, forma: 'pix', origem: '', obs: ''};
  const corpo = `<div class="grade-form">
    ${campo('text', 'descricao', 'Descrição', v.descricao, {obrigatorio: true, largo: true, placeholder: despesa ? 'Ex.: Mercado, Aluguel' : 'Ex.: Salário da empresa'})}
    ${campo('valor', 'valor', novo ? 'Valor' : 'Valor', valorCampo(v.valor), {obrigatorio: true})}
    ${campo('select', 'categoriaId', 'Categoria', v.categoriaId, {opcoes: opcoesCategorias(tipo)})}
    ${despesa ? campo('select', 'forma', 'Forma de pagamento', v.forma, {opcoes: novo ? FORMAS : FORMAS.filter(f => f[0] !== 'credito')}) : campo('text', 'origem', 'Origem', v.origem, {placeholder: 'Empresa, cliente…'})}
    <div class="so-conta contents">${campo('select', 'contaId', despesa ? 'Conta usada' : 'Conta de destino', v.contaId, {opcoes: opcoesContas(estado.contas.length ? '' : 'Nenhuma conta cadastrada')})}</div>
    <div class="so-credito contents" hidden>
      ${campo('select', 'cartaoId', 'Cartão', '', {opcoes: opcoesCartoes().length ? opcoesCartoes() : [['', 'Nenhum cartão cadastrado']]})}
      ${campo('number', 'parcelasCartao', 'Parcelas', 1, {min: 1, max: 48})}
    </div>
    ${campo('date', 'data', despesa ? 'Vencimento' : 'Data de recebimento', v.data, {obrigatorio: true})}
    <div class="so-conta contents">
      ${campo('check', 'pago', despesa ? 'Já foi paga' : 'Já foi recebida', !!v.pagoEm)}
      ${campo('date', 'pagoEm', despesa ? 'Data do pagamento' : 'Recebida em', v.pagoEm || hoje())}
    </div>
    ${novo ? `<div class="so-conta contents">${campo('select', 'repetir', 'Repetir', 'nao', {opcoes: [['nao', 'Não repete'], ...(despesa ? [['parcelar', 'Dividir em parcelas']] : []), ['mensal', 'Todo mês'], ['anual', 'Todo ano']]})}
      ${campo('number', 'nParcelas', 'Quantas parcelas', 2, {min: 2, max: 120})}
      ${campo('date', 'fim', 'Repetir até (opcional)', '')}</div>` : ''}
    ${despesa ? '<div class="so-conta contents">' + campo('arquivo', 'anexo', t && t.anexo ? 'Trocar comprovante' : 'Comprovante (opcional)', '', {dica: 'Fica guardado só neste aparelho.'}) + '</div>' : ''}
    ${campo('area', 'obs', 'Observação', v.obs || '', {largo: true})}
  </div>
  ${t && t.recorrenciaId ? '<p class="nota">Este lançamento faz parte de uma repetição: a alteração vale só para ele.</p>' : ''}
  ${t && t.grupo ? `<p class="nota">Parcela ${t.grupo.n} de ${t.grupo.total}: a alteração vale só para ela.</p>` : ''}
  ${falta ? `<p class="nota alerta">${falta}</p>` : ''}`;
  abrirModal({
    titulo: (novo ? 'Nova ' : 'Editar ') + (despesa ? 'despesa' : 'receita'), corpo, botao: novo ? 'Adicionar' : 'Salvar',
    aoAbrir: f => {
      const mostrar = () => {
        const credito = despesa && f.forma && f.forma.value === 'credito';
        f.querySelectorAll('.so-conta').forEach(e => e.hidden = credito);
        f.querySelectorAll('.so-credito').forEach(e => e.hidden = !credito);
        f.pagoEm.closest('.campo').hidden = credito || !f.pago.checked;
        if(f.repetir){ f.nParcelas.closest('.campo').hidden = f.repetir.value !== 'parcelar'; f.fim.closest('.campo').hidden = !['mensal', 'anual'].includes(f.repetir.value); }
        f.data.closest('.campo').querySelector('span').textContent = credito ? 'Data da compra' : despesa ? 'Vencimento' : 'Data de recebimento';
      };
      f.addEventListener('change', mostrar); mostrar();
    },
    aoSalvar: async (d, f) => {
      const valor = lerValor(d.valor), desc = d.descricao.trim();
      if(!desc) return 'Informe a descrição.';
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      if(despesa && d.forma === 'credito' && novo){
        if(!d.cartaoId) return 'Cadastre um cartão antes (menu Cartões).';
        const n = Math.round(+d.parcelasCartao);
        if(!(n >= 1 && n <= 48)) return 'Parcelas: de 1 a 48.';
        ok('Compra no cartão adicionada', e => e.compras.push({id: uid(), cartaoId: d.cartaoId, descricao: desc, valor, parcelas: n, data: d.data, categoriaId: d.categoriaId, criadoEm: Date.now()}));
        return;
      }
      if(!d.contaId) return precisaConta() || 'Escolha a conta.';
      const pagoEm = d.pago ? (dataValida(d.pagoEm) ? d.pagoEm : hoje()) : null;
      const arquivo = f.anexo && f.anexo.files[0];
      if(arquivo && arquivo.size > 5e6) return 'Comprovante muito grande (máximo 5 MB).';
      const base = {tipo, descricao: desc, valor, categoriaId: d.categoriaId, contaId: d.contaId, forma: d.forma || '', origem: (d.origem || '').trim(), obs: (d.obs || '').trim()};
      if(!novo){
        if(arquivo){ await guardarAnexo(t.id, arquivo); base.anexo = {nome: arquivo.name, tipo: arquivo.type}; }
        ok((despesa ? 'Despesa' : 'Receita') + ' atualizada', e => Object.assign(e.transacoes.find(x => x.id === t.id), base, {data: d.data, pagoEm}));
        return;
      }
      if(d.repetir === 'parcelar'){
        const n = Math.round(+d.nParcelas);
        if(!(n >= 2 && n <= 120)) return 'Parcelas: de 2 a 120.';
        const grupo = uid(), parte = Math.floor(valor / n), resto = valor - parte * n;
        ok(`Despesa dividida em ${n} parcelas`, e => { for(let i = 0; i < n; i++) e.transacoes.push({...base, id: uid(), descricao: `${desc} (${i + 1}/${n})`, valor: parte + (i === 0 ? resto : 0), data: somaMeses(d.data, i), pagoEm: i === 0 ? pagoEm : null, grupo: {id: grupo, n: i + 1, total: n}, criadoEm: Date.now()}); });
        return;
      }
      if(d.repetir === 'mensal' || d.repetir === 'anual'){
        if(d.fim && (!dataValida(d.fim) || d.fim < d.data)) return 'A data final precisa ser depois do início.';
        ok((despesa ? 'Despesa' : 'Receita') + ' recorrente criada', e => {
          const r = {...base, id: uid(), frequencia: d.repetir, inicio: d.data, dia: partes(d.data)[2], fim: d.fim || '', ativa: true, gerados: []};
          e.recorrencias.push(r); gerarRecorrencias(e);
          const primeira = e.transacoes.find(x => x.recorrenciaId === r.id && x.data === d.data);
          if(primeira) primeira.pagoEm = pagoEm;
        });
        return;
      }
      const id = uid();
      if(arquivo){ await guardarAnexo(id, arquivo); base.anexo = {nome: arquivo.name, tipo: arquivo.type}; }
      ok((despesa ? 'Despesa' : 'Receita') + ' adicionada', e => e.transacoes.push({...base, id, data: d.data, pagoEm, criadoEm: Date.now()}));
    },
  });
}
export function alternarPago(t){
  const texto = t.pagoEm ? (t.tipo === 'despesa' ? 'Marcada como pendente' : 'Marcada como pendente') : (t.tipo === 'despesa' ? 'Despesa paga' : 'Receita recebida');
  ok(texto, e => { const x = e.transacoes.find(y => y.id === t.id); x.pagoEm = x.pagoEm ? null : hoje(); });
}
export async function excluirTransacao(t){
  if(!await confirmar(`Excluir <b>${esc(t.descricao)}</b> (${brl(t.valor)})?` + (t.recorrenciaId ? '<br><small>A repetição continua nos próximos meses; para parar, encerre a repetição.</small>' : ''))) return;
  ok('Lançamento excluído', e => { e.transacoes = e.transacoes.filter(x => x.id !== t.id); });
  if(t.anexo) apagarAnexo(t.id);
}

/* ================= repetições ================= */
export async function encerrarRecorrencia(r){
  if(!await confirmar(`Parar de repetir <b>${esc(r.descricao)}</b>? Os lançamentos já criados continuam; os pendentes de meses futuros são removidos.`, 'Parar')) return;
  const h = hoje();
  ok('Repetição encerrada', e => {
    const x = e.recorrencias.find(y => y.id === r.id); x.ativa = false; x.fim = h;
    e.transacoes = e.transacoes.filter(t => !(t.recorrenciaId === r.id && !t.pagoEm && t.data > h));
  });
}

/* ================= transferências ================= */
export function formTransferencia(t = null){
  const ativas = estado.contas.filter(c => !c.arquivada);
  if(ativas.length < 2 && !t) return abrirModal({titulo: 'Transferência', corpo: '<p class="nota">Para transferir, cadastre pelo menos duas contas (menu Contas).</p>'});
  const v = t || {deId: ativas[0].id, paraId: ativas[1].id, valor: 0, data: hoje(), descricao: ''};
  abrirModal({
    titulo: t ? 'Editar transferência' : 'Nova transferência', botao: t ? 'Salvar' : 'Transferir',
    corpo: `<div class="grade-form">
      ${campo('select', 'deId', 'De', v.deId, {opcoes: opcoesContas()})}
      ${campo('select', 'paraId', 'Para', v.paraId, {opcoes: opcoesContas()})}
      ${campo('valor', 'valor', 'Valor', valorCampo(v.valor), {obrigatorio: true})}
      ${campo('date', 'data', 'Data', v.data)}
      ${campo('text', 'descricao', 'Descrição (opcional)', v.descricao, {largo: true})}
    </div><p class="nota">Transferência não conta como receita nem despesa: só muda o dinheiro de lugar.</p>`,
    aoSalvar: d => {
      const valor = lerValor(d.valor);
      if(d.deId === d.paraId) return 'Escolha contas diferentes.';
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      const dados = {deId: d.deId, paraId: d.paraId, valor, data: d.data, descricao: d.descricao.trim()};
      if(t) ok('Transferência atualizada', e => Object.assign(e.transferencias.find(x => x.id === t.id), dados));
      else ok('Transferência feita', e => e.transferencias.push({id: uid(), ...dados, criadoEm: Date.now()}));
    },
  });
}
export async function excluirTransferencia(t){
  if(!await confirmar(`Excluir a transferência de ${brl(t.valor)}?`)) return;
  ok('Transferência excluída', e => { e.transferencias = e.transferencias.filter(x => x.id !== t.id); });
}

/* ================= contas ================= */
export function formConta(c = null){
  const v = c || {nome: '', instituicao: '', tipo: 'corrente', saldoInicial: 0, cor: '#6A3FBF'};
  abrirModal({
    titulo: c ? 'Editar conta' : 'Nova conta', botao: c ? 'Salvar' : 'Adicionar',
    corpo: `<div class="grade-form">
      ${campo('text', 'nome', 'Nome', v.nome, {obrigatorio: true, placeholder: 'Ex.: Inter, Carteira'})}
      ${campo('text', 'instituicao', 'Instituição', v.instituicao, {placeholder: 'Banco Inter'})}
      ${campo('select', 'tipo', 'Tipo', v.tipo, {opcoes: TIPOS_CONTA})}
      ${c ? campo('text', 'saldoHoje', 'Saldo de hoje', valorCampo(saldoConta(c)) || '0,00', {dica: 'O que o banco mostra agora. O Septim ajusta o saldo inicial para bater. Pode ser negativo.'})
        : campo('text', 'saldoInicial', 'Saldo de hoje', '0,00', {dica: 'Quanto há na conta agora. Pode ser negativo.'})}
      ${campo('cor', 'cor', 'Cor', v.cor)}
    </div>`,
    aoSalvar: d => {
      const nome = d.nome.trim(), txt = (c ? d.saldoHoje : d.saldoInicial).trim(), lido = txt ? lerValor(txt.replace(/^−/, '-')) : 0;
      // editando: o saldo de hoje vira saldo inicial descontando o que já se moveu na conta
      const saldo = c ? lido - (saldoConta(c) - c.saldoInicial) : lido;
      if(!nome) return 'Informe o nome.';
      if(!Number.isFinite(saldo)) return 'Saldo inicial inválido.';
      const dados = {nome, instituicao: d.instituicao.trim(), tipo: d.tipo, saldoInicial: saldo, cor: d.cor};
      if(c) ok('Conta atualizada', e => Object.assign(e.contas.find(x => x.id === c.id), dados));
      else ok('Conta criada', e => e.contas.push({id: uid(), ...dados, arquivada: false, criadoEm: Date.now()}));
    },
  });
}
export const TIPOS_CONTA = [['corrente', 'Conta corrente'], ['poupanca', 'Poupança'], ['dinheiro', 'Dinheiro em espécie'], ['digital', 'Carteira digital'], ['outra', 'Outra']];
export async function excluirConta(c){
  const usada = estado.transacoes.some(t => t.contaId === c.id) || estado.transferencias.some(t => t.deId === c.id || t.paraId === c.id)
    || estado.pagamentosFatura.some(p => p.contaId === c.id) || estado.dividas.some(d => (d.pagamentos || []).some(p => p.contaId === c.id))
    || estado.investimentos.some(i => (i.movimentos || []).some(m => m.contaId === c.id));
  if(usada){
    if(!await confirmar(`<b>${esc(c.nome)}</b> tem movimentações. Ela será <b>arquivada</b>: some das listas e do saldo, mas o histórico continua.`, 'Arquivar')) return;
    ok('Conta arquivada', e => { e.contas.find(x => x.id === c.id).arquivada = true; });
  } else {
    if(!await confirmar(`Excluir a conta <b>${esc(c.nome)}</b>?`)) return;
    ok('Conta excluída', e => { e.contas = e.contas.filter(x => x.id !== c.id); });
  }
}

/* ================= cartões ================= */
export function formCartao(c = null){
  const v = c || {nome: '', banco: '', limite: 0, diaFechamento: 3, diaVencimento: 10, cor: '#6A3FBF', contaId: ''};
  abrirModal({
    titulo: c ? 'Editar cartão' : 'Novo cartão', botao: c ? 'Salvar' : 'Adicionar',
    corpo: `<div class="grade-form">
      ${campo('text', 'nome', 'Nome do cartão', v.nome, {obrigatorio: true, placeholder: 'Ex.: Inter Gold'})}
      ${campo('text', 'banco', 'Banco emissor', v.banco)}
      ${campo('valor', 'limite', 'Limite total', valorCampo(v.limite), {obrigatorio: true})}
      ${campo('cor', 'cor', 'Cor', v.cor)}
      ${campo('number', 'diaFechamento', 'Dia do fechamento', v.diaFechamento, {min: 1, max: 31})}
      ${campo('number', 'diaVencimento', 'Dia do vencimento', v.diaVencimento, {min: 1, max: 31})}
      ${campo('select', 'contaId', 'Conta que paga a fatura', v.contaId, {opcoes: opcoesContas('Escolher na hora'), largo: true})}
    </div><p class="nota">Melhor dia de compra: o dia do fechamento. Compras a partir dele caem na fatura seguinte.</p>`,
    aoSalvar: d => {
      const limite = lerValor(d.limite), f = Math.round(+d.diaFechamento), vv = Math.round(+d.diaVencimento);
      if(!d.nome.trim()) return 'Informe o nome.';
      if(!(limite > 0)) return 'Informe o limite.';
      if(!(f >= 1 && f <= 31 && vv >= 1 && vv <= 31)) return 'Dias de fechamento e vencimento: de 1 a 31.';
      if(f === vv) return 'Fechamento e vencimento não podem cair no mesmo dia.';
      const dados = {nome: d.nome.trim(), banco: d.banco.trim(), limite, diaFechamento: f, diaVencimento: vv, cor: d.cor, contaId: d.contaId};
      if(c) ok('Cartão atualizado', e => Object.assign(e.cartoes.find(x => x.id === c.id), dados));
      else ok('Cartão criado', e => e.cartoes.push({id: uid(), ...dados, criadoEm: Date.now()}));
    },
  });
}
export async function excluirCartao(c){
  if(estado.compras.some(x => x.cartaoId === c.id) || estado.pagamentosFatura.some(p => p.cartaoId === c.id))
    return abrirModal({titulo: 'Excluir cartão', corpo: `<p class="nota">O cartão <b>${esc(c.nome)}</b> tem compras ou pagamentos. Exclua-os antes, para não perder o histórico sem querer.</p>`});
  if(!await confirmar(`Excluir o cartão <b>${esc(c.nome)}</b>?`)) return;
  ok('Cartão excluído', e => { e.cartoes = e.cartoes.filter(x => x.id !== c.id); });
}
export function formCompra(compra = null, cartaoId){
  if(!estado.cartoes.length) return abrirModal({titulo: 'Compra no cartão', corpo: '<p class="nota">Cadastre um cartão antes (menu Cartões).</p>'});
  const v = compra || {cartaoId: cartaoId || estado.cartoes[0].id, descricao: '', valor: 0, parcelas: 1, data: hoje(), categoriaId: 'compras'};
  abrirModal({
    titulo: compra ? 'Editar compra' : 'Compra no cartão', botao: compra ? 'Salvar' : 'Adicionar',
    corpo: `<div class="grade-form">
      ${campo('select', 'cartaoId', 'Cartão', v.cartaoId, {opcoes: opcoesCartoes()})}
      ${campo('text', 'descricao', 'Descrição', v.descricao, {obrigatorio: true})}
      ${campo('valor', 'valor', 'Valor total', valorCampo(v.valor), {obrigatorio: true})}
      ${campo('number', 'parcelas', 'Parcelas', v.parcelas, {min: 1, max: 48})}
      ${campo('date', 'data', 'Data da compra', v.data)}
      ${campo('select', 'categoriaId', 'Categoria', v.categoriaId, {opcoes: opcoesCategorias('despesa')})}
    </div><p class="nota" id="previaCompra"></p>`,
    aoAbrir: f => {
      const previa = () => {
        const valor = lerValor(f.valor.value), n = Math.max(1, Math.round(+f.parcelas.value) || 1), c = achar('cartoes', f.cartaoId.value);
        if(!c || !/^\d{4}-\d{2}-\d{2}$/.test(f.data.value)) return;
        const ps = parcelasDaCompra({cartaoId: c.id, valor: valor > 0 ? valor : 0, parcelas: n, data: f.data.value});
        const livre = c.limite - limiteUsado(c) + (compra && compra.cartaoId === c.id ? compra.valor : 0);
        $('#previaCompra').innerHTML = `${n > 1 ? `${n}× de ${brl(ps[ps.length - 1].valor)} · ` : ''}1ª parcela na fatura de <b>${nomeMes(ps[0].fatura)}</b> (vence ${data(ps[0].vencimento)})`
          + (valor > livre ? `<br><span class="txt-neg">Passa do limite disponível (${brl(Math.max(0, livre))}).</span>` : '');
      };
      f.addEventListener('input', previa); f.addEventListener('change', previa); previa();
    },
    aoSalvar: d => {
      const valor = lerValor(d.valor), n = Math.round(+d.parcelas);
      if(!d.descricao.trim()) return 'Informe a descrição.';
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(!(n >= 1 && n <= 48)) return 'Parcelas: de 1 a 48.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      if(valor < n) return 'Valor pequeno demais para tantas parcelas.';
      const dados = {cartaoId: d.cartaoId, descricao: d.descricao.trim(), valor, parcelas: n, data: d.data, categoriaId: d.categoriaId};
      if(compra) ok('Compra atualizada', e => Object.assign(e.compras.find(x => x.id === compra.id), dados));
      else ok('Compra adicionada', e => e.compras.push({id: uid(), ...dados, criadoEm: Date.now()}));
    },
  });
}
export async function excluirCompra(c){
  if(!await confirmar(`Excluir a compra <b>${esc(c.descricao)}</b> (${brl(c.valor)}${c.parcelas > 1 ? ' em ' + c.parcelas + 'x' : ''})? Todas as parcelas saem das faturas.`)) return;
  ok('Compra excluída', e => { e.compras = e.compras.filter(x => x.id !== c.id); });
}
export function formPagarFatura(c, key){
  const f = fatura(c, key || faturaAtualKey(c));
  abrirModal({
    titulo: `Pagar fatura · ${c.nome}`, botao: 'Registrar pagamento',
    corpo: `<p class="nota">Fatura de <b>${nomeMes(f.key)}</b> · total ${brl(f.total)} · falta ${brl(f.restante)}</p>
    <div class="grade-form">
      ${campo('valor', 'valor', 'Valor pago', valorCampo(f.restante), {obrigatorio: true})}
      ${campo('date', 'data', 'Data', hoje())}
      ${campo('select', 'contaId', 'Conta', c.contaId, {opcoes: opcoesContas(), largo: true})}
    </div><p class="nota">O pagamento sai do saldo da conta, mas não vira despesa de novo: as compras do cartão já contaram.</p>`,
    aoSalvar: d => {
      const valor = lerValor(d.valor);
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(!d.contaId) return precisaConta() || 'Escolha a conta.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      ok('Pagamento de fatura registrado', e => e.pagamentosFatura.push({id: uid(), cartaoId: c.id, fatura: f.key, valor, data: d.data, contaId: d.contaId, criadoEm: Date.now()}));
    },
  });
}
export async function excluirPagamentoFatura(p){
  if(!await confirmar(`Excluir o pagamento de ${brl(p.valor)}? O valor volta para o saldo da conta.`)) return;
  ok('Pagamento excluído', e => { e.pagamentosFatura = e.pagamentosFatura.filter(x => x.id !== p.id); });
}

/* ================= metas ================= */
export function formMeta(m = null){
  const v = m || {nome: '', alvo: 0, dataPrevista: '', cor: '#E0B44C'};
  abrirModal({
    titulo: m ? 'Editar meta' : 'Nova meta', botao: m ? 'Salvar' : 'Criar meta',
    corpo: `<div class="grade-form">
      ${campo('text', 'nome', 'Objetivo', v.nome, {obrigatorio: true, largo: true, placeholder: 'Reserva de emergência, viagem, computador…'})}
      ${campo('valor', 'alvo', 'Valor desejado', valorCampo(v.alvo), {obrigatorio: true})}
      ${campo('date', 'dataPrevista', 'Data prevista', v.dataPrevista)}
      ${m ? '' : campo('valor', 'inicial', 'Já tenho guardado (opcional)', '')}
      ${campo('cor', 'cor', 'Cor', v.cor)}
    </div>`,
    aoSalvar: d => {
      const alvo = lerValor(d.alvo), inicial = d.inicial ? lerValor(d.inicial) : 0;
      if(!d.nome.trim()) return 'Informe o objetivo.';
      if(!(alvo > 0)) return 'Informe o valor desejado.';
      if(d.inicial && !(inicial >= 0)) return 'Valor inicial inválido.';
      const dados = {nome: d.nome.trim(), alvo, dataPrevista: d.dataPrevista, cor: d.cor};
      if(m) ok('Meta atualizada', e => Object.assign(e.metas.find(x => x.id === m.id), dados));
      else ok('Meta criada', e => e.metas.push({id: uid(), ...dados, depositos: inicial > 0 ? [{id: uid(), valor: inicial, data: hoje(), obs: 'Valor inicial'}] : [], criadoEm: Date.now()}));
    },
  });
}
export function formDeposito(m){
  abrirModal({
    titulo: `Movimentar · ${m.nome}`, botao: 'Registrar',
    corpo: `<p class="nota">Guardado: ${brl(acumuladoMeta(m))} de ${brl(m.alvo)}</p><div class="grade-form">
      ${campo('select', 'tipo', 'Tipo', 'deposito', {opcoes: [['deposito', 'Depósito'], ['retirada', 'Retirada']]})}
      ${campo('valor', 'valor', 'Valor', '', {obrigatorio: true})}
      ${campo('date', 'data', 'Data', hoje())}
      ${campo('text', 'obs', 'Observação', '')}
    </div>`,
    aoSalvar: d => {
      const valor = lerValor(d.valor);
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(d.tipo === 'retirada' && valor > acumuladoMeta(m)) return 'A retirada passa do que está guardado.';
      ok(d.tipo === 'retirada' ? 'Retirada registrada' : 'Depósito registrado', e => e.metas.find(x => x.id === m.id).depositos.push({id: uid(), valor: d.tipo === 'retirada' ? -valor : valor, data: d.data || hoje(), obs: d.obs.trim()}));
    },
  });
}
export async function excluirMeta(m){
  if(!await confirmar(`Excluir a meta <b>${esc(m.nome)}</b> e o histórico dela?`)) return;
  ok('Meta excluída', e => { e.metas = e.metas.filter(x => x.id !== m.id); });
}

/* ================= investimentos ================= */
export const TIPOS_INVEST = [['tesouro', 'Tesouro Direto'], ['cdb', 'CDB'], ['lci', 'LCI e LCA'], ['acoes', 'Ações'], ['fii', 'Fundos imobiliários'], ['etf', 'ETFs'], ['cripto', 'Criptomoedas'], ['outro', 'Outros']];
export function formInvestimento(i = null){
  const v = i || {nome: '', tipo: 'cdb', instituicao: '', rentabilidade: ''};
  abrirModal({
    titulo: i ? 'Editar investimento' : 'Novo investimento', botao: i ? 'Salvar' : 'Adicionar',
    corpo: `<div class="grade-form">
      ${campo('text', 'nome', 'Nome', v.nome, {obrigatorio: true, placeholder: 'Ex.: CDB Inter 110% CDI, MXRF11'})}
      ${campo('select', 'tipo', 'Tipo', v.tipo, {opcoes: TIPOS_INVEST})}
      ${campo('text', 'instituicao', 'Instituição', v.instituicao)}
      ${campo('text', 'rentabilidade', 'Rentabilidade informada', v.rentabilidade, {placeholder: '110% do CDI, IPCA + 6%…'})}
      ${i ? '' : campo('valor', 'valor', 'Valor aplicado', '', {obrigatorio: true}) + campo('date', 'data', 'Data da aplicação', hoje()) + campo('select', 'contaId', 'Saiu da conta', '', {opcoes: opcoesContas('Não descontar de conta'), largo: true})}
    </div>`,
    aoSalvar: d => {
      if(!d.nome.trim()) return 'Informe o nome.';
      const dados = {nome: d.nome.trim(), tipo: d.tipo, instituicao: d.instituicao.trim(), rentabilidade: d.rentabilidade.trim()};
      if(i){ ok('Investimento atualizado', e => Object.assign(e.investimentos.find(x => x.id === i.id), dados)); return; }
      const valor = lerValor(d.valor);
      if(!(valor > 0)) return 'Informe o valor aplicado.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      ok('Investimento adicionado', e => e.investimentos.push({id: uid(), ...dados, movimentos: [{id: uid(), tipo: 'aplicacao', valor, data: d.data, contaId: d.contaId}], atualizacoes: [], criadoEm: Date.now()}));
    },
  });
}
export function formMovInvest(i, tipo){
  const atual = valorInvestimento(i);
  abrirModal({
    titulo: (tipo === 'atualizar' ? 'Atualizar valor · ' : tipo === 'resgate' ? 'Resgatar · ' : 'Aplicar mais · ') + i.nome,
    botao: 'Registrar',
    corpo: `<p class="nota">Valor atual: ${brl(atual)}</p><div class="grade-form">
      ${campo('valor', 'valor', tipo === 'atualizar' ? 'Valor atual do investimento' : 'Valor', '', {obrigatorio: true})}
      ${campo('date', 'data', 'Data', hoje())}
      ${tipo === 'atualizar' ? '' : campo('select', 'contaId', tipo === 'resgate' ? 'Entrou na conta' : 'Saiu da conta', '', {opcoes: opcoesContas('Nenhuma'), largo: true})}
    </div>${tipo === 'atualizar' ? '<p class="nota">Informe o valor que aparece no app do banco ou da corretora. O Septim não busca cotações.</p>' : ''}`,
    aoSalvar: d => {
      const valor = lerValor(d.valor);
      if(!(valor >= 0) || (tipo !== 'atualizar' && !valor)) return 'Informe um valor válido.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      if(tipo === 'resgate' && valor > valorInvestimento(i, d.data)) return 'O resgate passa do valor do investimento.';
      ok(tipo === 'atualizar' ? 'Valor atualizado' : tipo === 'resgate' ? 'Resgate registrado' : 'Aplicação registrada', e => {
        const x = e.investimentos.find(y => y.id === i.id);
        if(tipo === 'atualizar') x.atualizacoes.push({id: uid(), data: d.data, valor});
        else x.movimentos.push({id: uid(), tipo: tipo === 'resgate' ? 'resgate' : 'aplicacao', valor, data: d.data, contaId: d.contaId});
      });
    },
  });
}
export async function excluirInvestimento(i){
  if(!await confirmar(`Excluir <b>${esc(i.nome)}</b> e todo o histórico? As aplicações e resgates ligados a contas deixam de mexer no saldo delas.`)) return;
  ok('Investimento excluído', e => { e.investimentos = e.investimentos.filter(x => x.id !== i.id); });
}
export async function excluirMovInvest(i, m, lista){
  if(!await confirmar('Excluir este registro do histórico?')) return;
  ok('Registro excluído', e => { const x = e.investimentos.find(y => y.id === i.id); x[lista] = x[lista].filter(y => y.id !== m.id); });
}

/* ================= dívidas ================= */
export function formDivida(dv = null){
  const v = dv || {credor: '', descricao: '', valorOriginal: 0, juros: '', parcelas: 12, valorParcela: 0, diaVencimento: 10, inicio: chaveMes(hoje())};
  abrirModal({
    titulo: dv ? 'Editar dívida' : 'Nova dívida', botao: dv ? 'Salvar' : 'Adicionar',
    corpo: `<div class="grade-form">
      ${campo('text', 'credor', 'Credor', v.credor, {obrigatorio: true, placeholder: 'Banco, loja, pessoa…'})}
      ${campo('text', 'descricao', 'Descrição', v.descricao, {placeholder: 'Financiamento do carro'})}
      ${campo('valor', 'valorOriginal', 'Valor original', valorCampo(v.valorOriginal), {obrigatorio: true})}
      ${campo('text', 'juros', 'Juros (% ao mês)', v.juros === '' ? '' : String(v.juros).replace('.', ','), {placeholder: '1,99'})}
      ${campo('number', 'parcelas', 'Quantidade de parcelas', v.parcelas, {min: 1, max: 600})}
      ${campo('valor', 'valorParcela', 'Valor da parcela', valorCampo(v.valorParcela), {obrigatorio: true})}
      ${campo('month', 'inicio', '1ª parcela em', v.inicio)}
      ${campo('number', 'diaVencimento', 'Dia do vencimento', v.diaVencimento, {min: 1, max: 31})}
      ${dv ? '' : campo('number', 'jaPagas', 'Parcelas já pagas antes', 0, {min: 0, dica: 'Entram no histórico sem mexer no saldo das contas.'})}
    </div>`,
    aoSalvar: d => {
      const original = lerValor(d.valorOriginal), parcela = lerValor(d.valorParcela), n = Math.round(+d.parcelas), dia = Math.round(+d.diaVencimento);
      const juros = d.juros.trim() ? Number(d.juros.replace(',', '.')) : 0, ja = Math.round(+d.jaPagas || 0);
      if(!d.credor.trim()) return 'Informe o credor.';
      if(!(original > 0)) return 'Informe o valor original.';
      if(!(n >= 1 && n <= 600)) return 'Parcelas: de 1 a 600.';
      if(!(parcela > 0)) return 'Informe o valor da parcela.';
      if(!Number.isFinite(juros) || juros < 0) return 'Juros inválidos.';
      if(!/^\d{4}-\d{2}$/.test(d.inicio)) return 'Informe o mês da 1ª parcela.';
      if(!(dia >= 1 && dia <= 31)) return 'Dia do vencimento: de 1 a 31.';
      if(ja < 0 || ja > n) return 'Parcelas já pagas: de 0 até o total.';
      const dados = {credor: d.credor.trim(), descricao: d.descricao.trim(), valorOriginal: original, juros, parcelas: n, valorParcela: parcela, inicio: d.inicio, diaVencimento: dia};
      if(dv){
        if(n < (dv.pagamentos || []).length) return 'Já há mais pagamentos do que essa quantidade de parcelas.';
        ok('Dívida atualizada', e => Object.assign(e.dividas.find(x => x.id === dv.id), dados)); return;
      }
      const [a, m] = partes(d.inicio + '-01');
      const pagamentos = Array.from({length: ja}, (_, i) => ({id: uid(), valor: parcela, data: somaMeses(`${a}-${String(m).padStart(2, '0')}-01`, i, dia), contaId: '', anterior: true}));
      ok('Dívida adicionada', e => e.dividas.push({id: uid(), ...dados, pagamentos, criadoEm: Date.now()}));
    },
  });
}
export function formPagarDivida(dv){
  const p = proximaParcela(dv), falta = totalDivida(dv) - pagoDivida(dv);
  if(!p && falta <= 0) return toast('Esta dívida já está quitada');
  abrirModal({
    titulo: `Pagar parcela · ${dv.credor}`, botao: 'Registrar pagamento',
    corpo: `<p class="nota">${p ? `Parcela ${p.n} de ${dv.parcelas} · vence ${data(p.vencimento)}` : ''} · falta ${brl(falta)}</p><div class="grade-form">
      ${campo('valor', 'valor', 'Valor pago', valorCampo(Math.min(dv.valorParcela, falta)), {obrigatorio: true})}
      ${campo('date', 'data', 'Data', hoje())}
      ${campo('select', 'contaId', 'Conta', '', {opcoes: opcoesContas(), largo: true})}
    </div><p class="nota">O pagamento sai da conta e entra nas despesas do mês, na categoria Dívidas.</p>`,
    aoSalvar: d => {
      const valor = lerValor(d.valor);
      if(!(valor > 0)) return 'Informe um valor maior que zero.';
      if(!d.contaId) return precisaConta() || 'Escolha a conta.';
      if(!dataValida(d.data)) return 'Informe uma data válida.';
      ok('Parcela paga', e => e.dividas.find(x => x.id === dv.id).pagamentos.push({id: uid(), valor, data: d.data, contaId: d.contaId}));
    },
  });
}
export async function excluirDivida(dv){
  if(!await confirmar(`Excluir a dívida com <b>${esc(dv.credor)}</b> e o histórico de pagamentos? Os pagamentos deixam de contar no saldo das contas.`)) return;
  ok('Dívida excluída', e => { e.dividas = e.dividas.filter(x => x.id !== dv.id); });
}
export async function excluirPagamentoDivida(dv, p){
  if(!await confirmar(`Excluir o pagamento de ${brl(p.valor)} de ${data(p.data)}? O valor volta para a conta.`)) return;
  ok('Pagamento excluído', e => { const x = e.dividas.find(y => y.id === dv.id); x.pagamentos = x.pagamentos.filter(y => y.id !== p.id); });
}

/* ================= ação rápida ================= */
export function acaoRapida(){
  abrirModal({
    titulo: 'O que você quer registrar?',
    corpo: `<div class="rapida">
      <button type="button" data-r="receita" class="r-receita">${ic('arrow-down-left')}<b>Receita</b><small>Dinheiro que entrou</small></button>
      <button type="button" data-r="despesa" class="r-despesa">${ic('arrow-up-right')}<b>Despesa</b><small>Conta, compra, gasto</small></button>
      <button type="button" data-r="transferencia" class="r-transf">${ic('arrow-left-right')}<b>Transferência</b><small>Entre suas contas</small></button>
      <button type="button" data-r="cartao" class="r-cartao">${ic('credit-card')}<b>Compra no cartão</b><small>À vista ou parcelada</small></button>
    </div>`,
    aoAbrir: f => f.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const r = b.dataset.r; $('#modal').close();
      setTimeout(() => r === 'transferencia' ? formTransferencia() : r === 'cartao' ? formCompra() : formTransacao(r), 30);
    }),
  });
}
