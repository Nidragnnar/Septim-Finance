// Contas bancárias e carteiras: saldo, histórico e transferências.
import {estado, achar, alterar, redesenhar} from '../dados.js';
import {saldoConta, movimentos, saldoTotal, hoje, chaveMes, inicioMes} from '../calc.js';
import {$, $$, esc, ic, brl, data, vazio, abrirModal, graficoRosca} from '../ui.js';
import * as F from '../formularios.js';
import {importarExtrato} from '../extrato.js';

let verArquivadas = false;
const TIPO = Object.fromEntries(F.TIPOS_CONTA);
const ICONE = {corrente: 'landmark', poupanca: 'piggy-bank', dinheiro: 'banknote', digital: 'smartphone', outra: 'wallet'};

export function render(el){
  const ativas = estado.contas.filter(c => !c.arquivada), arquivadas = estado.contas.filter(c => c.arquivada);
  const lista = verArquivadas ? arquivadas : ativas;
  const total = saldoTotal(), k = chaveMes(hoje());
  const doMes = c => movimentos(c.id).filter(m => m.data >= inicioMes(k) && m.data <= hoje());
  el.innerHTML = `<div class="filtros">
      <button class="btn primario" data-nova>${ic('plus')}Nova conta</button>
      <button class="btn" data-transf>${ic('arrow-left-right')}Transferir</button>
      <button class="btn" data-extrato>${ic('file-down')}Importar extrato</button>
      <span class="cresce"></span>
      ${arquivadas.length ? `<button class="btn ghost pequeno" data-arq>${verArquivadas ? 'Ver ativas' : `Arquivadas (${arquivadas.length})`}</button>` : ''}
    </div>
    ${ativas.length ? `<div class="kpis">
      <div class="kpi destaque"><div class="kpi-cab"><span class="kpi-ic">${ic('landmark')}</span>Saldo total</div><div class="kpi-v num">${brl(total)}</div><div class="kpi-s">${ativas.length} ${ativas.length === 1 ? 'conta ativa' : 'contas ativas'}</div></div>
    </div>` : ''}
    ${lista.length ? `<div class="grade g-2-1"><div class="mini-cards">${lista.map(c => {
      const s = saldoConta(c), mm = doMes(c), ent = mm.filter(m => m.valor > 0).reduce((a, m) => a + m.valor, 0), sai = -mm.filter(m => m.valor < 0).reduce((a, m) => a + m.valor, 0);
      return `<div class="card mc">
        <div class="mc-cab"><span class="cat-ic" style="--c:${c.cor}">${ic(ICONE[c.tipo] || 'wallet')}</span><div class="meio"><b>${esc(c.nome)}</b><small>${esc(c.instituicao || TIPO[c.tipo] || '')}${c.instituicao ? ' · ' + (TIPO[c.tipo] || '') : ''}</small></div>
          <button class="icone-btn mini" data-ed="${c.id}" title="Editar">${ic('pencil')}</button>
          ${c.arquivada ? `<button class="icone-btn mini" data-desarq="${c.id}" title="Reativar">${ic('archive-restore')}</button>` : `<button class="icone-btn mini perigo" data-ex="${c.id}" title="Excluir ou arquivar">${ic('trash-2')}</button>`}</div>
        <div class="mc-nums"><span>Saldo atual<br><b class="${s < 0 ? 'txt-neg' : ''}">${brl(s)}</b></span><span style="text-align:right">Este mês<br><span class="txt-pos">+${brl(ent)}</span> <span class="txt-neg">−${brl(sai)}</span></span></div>
        <div class="mc-acoes"><button class="btn pequeno" data-hist="${c.id}">${ic('history')}Histórico</button></div>
      </div>`; }).join('')}</div>
      <div class="card"><div class="card-cab"><h2>${ic('chart-pie')}Onde está o dinheiro</h2></div><div class="card-corpo">${graficoRosca({itens: ativas.map(c => ({nome: c.nome, valor: saldoConta(c), cor: c.cor})), sub: 'saldo'})}</div></div></div>`
      : `<div class="card">${vazio('wallet', verArquivadas ? 'Nenhuma conta arquivada' : 'Nenhuma conta ainda', 'Cadastre o banco, a carteira digital e o dinheiro em espécie, cada um com o saldo de hoje. Receitas, despesas e transferências atualizam o saldo sozinhas.', `<button class="btn primario" data-nova>${ic('plus')}Nova conta</button>`)}</div>`}`;
  $$('[data-nova]', el).forEach(b => b.onclick = () => F.formConta());
  $('[data-transf]', el).onclick = () => F.formTransferencia();
  $('[data-extrato]', el).onclick = importarExtrato;
  const arq = $('[data-arq]', el); if(arq) arq.onclick = () => { verArquivadas = !verArquivadas; redesenhar(); };
  el.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    const c = achar('contas', b.dataset.ed || b.dataset.ex || b.dataset.hist || b.dataset.desarq);
    if(!c) return;
    if(b.dataset.ed) F.formConta(c);
    if(b.dataset.ex) F.excluirConta(c);
    if(b.dataset.hist) historico(c);
    if(b.dataset.desarq) alterar('Conta reativada', st => { st.contas.find(x => x.id === c.id).arquivada = false; });
  };
}

function historico(c){
  const ms = movimentos(c.id);
  let saldo = saldoConta(c);
  const linhas = ms.map(m => { const s = saldo; saldo -= m.valor; return {...m, saldo: s}; });
  abrirModal({
    titulo: 'Histórico · ' + c.nome, larga: true,
    corpo: `<p class="nota">Saldo atual <b>${brl(saldoConta(c))}</b> · saldo inicial ${brl(c.saldoInicial)} · só entra o que já foi pago ou recebido.</p>
      ${linhas.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th class="num">Valor</th><th class="num">Saldo</th></tr></thead><tbody>
        ${linhas.map(m => `<tr><td>${data(m.data)}</td><td>${esc(m.descricao)}</td><td class="num ${m.valor < 0 ? 'txt-neg' : 'txt-pos'}">${m.valor < 0 ? '−' : '+'}${brl(Math.abs(m.valor))}</td><td class="num">${brl(m.saldo)}</td></tr>`).join('')}
        <tr><td></td><td class="txt-fraco">Saldo inicial</td><td></td><td class="num">${brl(c.saldoInicial)}</td></tr></tbody></table></div>`
      : vazio('history', 'Sem movimentações', 'As receitas recebidas, despesas pagas, transferências e pagamentos ligados a esta conta aparecem aqui.')}`,
  });
}
