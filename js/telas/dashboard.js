// Dashboard: indicadores, gráficos e o que vence a seguir.
import {estado, categoria, alterar, achar} from '../dados.js';
import * as C from '../calc.js';
import {$, $$, esc, ic, brl, data, pct, graficoBarras, graficoLinha, graficoRosca, vazio, chipCategoria, desenharIcones} from '../ui.js';
import * as F from '../formularios.js';
import {filtroPeriodo, ligarPeriodo, linhaTx, ligarAcoes, refazer} from './lancamentos.js';

const filtro = {per: 'mes', ini: '', fim: ''};

const kpi = (icone, cls, titulo, valor, sub, extra = '') => `<div class="kpi ${extra}"><div class="kpi-cab"><span class="kpi-ic ${cls}">${ic(icone)}</span>${titulo}</div><div class="kpi-v num">${valor}</div><div class="kpi-s">${sub}</div></div>`;

// receitas e despesas de um mês fechado (para os gráficos mensais)
function mes(k){
  const ini = C.inicioMes(k), fim = C.fimMes(k);
  const r = C.soma(C.receitasEntre(ini, fim)), d = C.soma(C.despesasEntre(ini, fim));
  return {k, r, d, saldo: r - d};
}

function primeirosPassos(el){
  const passos = [
    ['wallet', 'Cadastre suas contas', 'Banco, carteira digital, dinheiro: com o saldo de hoje.', estado.contas.length, () => F.formConta()],
    ['arrow-down-left', 'Lance sua renda', 'Salário com "Repetir todo mês".', estado.transacoes.some(t => t.tipo === 'receita'), () => F.formTransacao('receita')],
    ['arrow-up-right', 'Lance as contas fixas', 'Aluguel, internet, luz… também repetindo.', estado.transacoes.some(t => t.tipo === 'despesa'), () => F.formTransacao('despesa')],
    ['credit-card', 'Cadastre seus cartões', 'Com fechamento e vencimento: as faturas se montam sozinhas.', estado.cartoes.length, () => F.formCartao()],
  ];
  return `<div class="card" style="margin-bottom:16px"><div class="vazio" style="padding:26px 20px 22px">
    <div class="vazio-ic">${ic('sparkles')}</div><h3>Bem-vindo ao Septim${estado.config.nome ? ', ' + esc(estado.config.nome) : ''}</h3>
    <p>Comece por aqui. Nada é inventado: os números aparecem conforme você registra.</p>
    <div class="primeiros">${passos.map(([i, t, s, feito], n) => `<button type="button" data-passo="${n}" class="${feito ? 'feito' : ''}"><span class="kpi-ic">${ic(feito ? 'circle-check-big' : i)}</span><span><b>${t}</b><small>${s}</small></span></button>`).join('')}</div>
  </div></div>`;
}

export function render(el){
  const p = C.periodo(filtro.per, filtro.ini, filtro.fim), ant = C.periodoAnterior(p), h = C.hoje();
  const receitas = C.receitasEntre(p.ini, p.fim), despesas = C.despesasEntre(p.ini, p.fim);
  const tr = C.soma(receitas), td = C.soma(despesas);
  const trAnt = C.soma(C.receitasEntre(ant.ini, ant.fim)), tdAnt = C.soma(C.despesasEntre(ant.ini, ant.fim));
  const pagar = C.soma(despesas.filter(d => d.tx && !d.tx.pagoEm))
    + estado.cartoes.reduce((s, c) => s + C.faturasDoCartao(c).filter(f => C.entre(f.vencimento, p.ini, p.fim)).reduce((a, f) => a + f.restante, 0), 0);
  const receber = C.soma(receitas.filter(t => !t.pagoEm));
  const invest = estado.investimentos.reduce((s, i) => s + C.valorInvestimento(i), 0);
  const dividas = estado.dividas.reduce((s, d) => s + C.restanteDivida(d), 0);
  const limite = estado.cartoes.reduce((s, c) => s + Math.max(0, c.limite - C.limiteUsado(c)), 0), limiteTot = estado.cartoes.reduce((s, c) => s + c.limite, 0);
  const saldo = C.saldoTotal(), pat = C.patrimonio();
  const varTxt = (a, b, bomSubir) => { if(!b) return 'sem comparação'; const v = (a - b) / b * 100; return `<span class="${(v >= 0) === bomSubir ? 'txt-pos' : 'txt-neg'}">${v >= 0 ? '▲' : '▼'} ${pct(Math.abs(v))}</span> vs período anterior`; };
  const novo = !estado.contas.length || !estado.transacoes.length;

  // meses dos gráficos mensais: os do período, ou os 6 até o fim dele
  let meses = C.mesesDe(p);
  if(meses.length < 2) meses = Array.from({length: 6}, (_, i) => C.chaveMes(C.somaMeses(C.inicioMes(p.fim), i - 5)));
  const dm = meses.map(mes);
  // últimos 12 meses, a partir do primeiro com dados (no mínimo os 2 últimos)
  const pm = C.primeiroMes(), ult12 = Array.from({length: 12}, (_, i) => C.chaveMes(C.somaMeses(C.inicioMes(h), i - 11))).filter((k, i) => k >= pm || i >= 10);
  const patri = ult12.map(k => C.patrimonio(k === C.chaveMes(h) ? h : C.fimMes(k)).total);
  const res12 = ult12.map(mes);
  // comparativo por categoria: este período contra o anterior
  const catAgora = C.porCategoria(despesas), catAntes = C.porCategoria(C.despesasEntre(ant.ini, ant.fim));
  const topCats = [...new Set([...catAgora.slice(0, 6).map(c => c.id), ...catAntes.slice(0, 3).map(c => c.id)])].slice(0, 7);
  const contasPos = estado.contas.filter(c => !c.arquivada).map(c => ({nome: c.nome, valor: C.saldoConta(c), cor: c.cor}));
  if(invest) contasPos.push({nome: 'Investimentos', valor: invest, cor: '#E0B44C'});
  const proximos = proximosVencimentos(30);
  const alertas = C.avisos().filter(a => a.nivel === 'perigo' || a.nivel === 'atencao').slice(0, 3);

  el.innerHTML = `<div class="filtros">${filtroPeriodo(filtro)}<span class="cresce"></span><span class="txt-fraco" style="font-size:12.5px">${data(p.ini)} a ${data(p.fim)}</span></div>
    ${avisoMigracao()}${novo ? primeirosPassos(el) : ''}
    ${alertas.length ? `<div class="alertas">${alertas.map(a => `<a class="aviso-item nv-${a.nivel}" href="#/${a.link}"><span class="aviso-ic">${ic(a.icone)}</span><span>${a.texto}</span></a>`).join('')}</div>` : ''}
    <div class="kpis nove">
      ${kpi('landmark', '', 'Saldo disponível', brl(saldo), `em ${estado.contas.filter(c => !c.arquivada).length} ${estado.contas.length === 1 ? 'conta' : 'contas'} · patrimônio ${brl(pat.total)}`, 'destaque')}
      ${kpi('arrow-down-left', 'pos-bg', 'Receitas', `<span class="txt-pos">${brl(tr)}</span>`, varTxt(tr, trAnt, true))}
      ${kpi('arrow-up-right', 'neg-bg', 'Despesas', `<span class="txt-neg">${brl(td)}</span>`, varTxt(td, tdAnt, false))}
      ${kpi('scale', tr - td >= 0 ? 'pos-bg' : 'neg-bg', 'Saldo do período', `<span class="${tr - td < 0 ? 'txt-neg' : 'txt-pos'}">${brl(tr - td)}</span>`, 'receitas menos despesas')}
      ${kpi('clock', 'warn-bg', 'Contas a pagar', brl(pagar), 'pendentes no período, com faturas')}
      ${kpi('hourglass', 'pos-bg', 'A receber', brl(receber), 'receitas ainda não recebidas')}
      ${kpi('trending-up', 'ouro-bg', 'Total investido', brl(invest), estado.investimentos.length ? `${estado.investimentos.length} ${estado.investimentos.length === 1 ? 'aplicação' : 'aplicações'}` : 'nenhuma aplicação')}
      ${kpi('hand-coins', 'neg-bg', 'Dívidas em aberto', brl(dividas), estado.dividas.length ? `${estado.dividas.filter(d => C.restanteDivida(d) > 0).length} ativas` : 'nenhuma dívida')}
      ${kpi('credit-card', '', 'Limite disponível', brl(limite), limiteTot ? `de ${brl(limiteTot)} nos cartões` : 'nenhum cartão')}
    </div>
    <div class="grade g-2-1">
      <div class="card"><div class="card-cab"><h2>${ic('chart-column')}Receitas x despesas</h2><small>por mês</small></div><div class="card-corpo">
        ${graficoBarras({rotulos: dm.map(m => C.nomeMes(m.k, true)), series: [{nome: 'Receitas', cor: 'var(--pos)', valores: dm.map(m => m.r)}, {nome: 'Despesas', cor: 'var(--neg)', valores: dm.map(m => m.d)}]})}</div></div>
      <div class="card"><div class="card-cab"><h2>${ic('chart-pie')}Gastos por categoria</h2><small>no período</small></div><div class="card-corpo">
        ${graficoRosca({itens: catAgora, sub: 'despesas'})}</div></div>
    </div>
    <div class="grade g2">
      <div class="card"><div class="card-cab"><h2>${ic('gem')}Evolução do patrimônio</h2><small>até 12 meses</small></div><div class="card-corpo">
        ${graficoLinha({rotulos: ult12.map(k => C.nomeMes(k, true)), series: [{nome: 'Patrimônio', cor: 'var(--roxo-2)', valores: patri, area: true}]})}
        <p class="txt-fraco" style="font-size:12px; margin:8px 0 0">Contas + investimentos − dívidas − cartões em aberto.</p></div></div>
      <div class="card"><div class="card-cab"><h2>${ic('activity')}Evolução mensal</h2><small>resultado de cada mês</small></div><div class="card-corpo">
        ${graficoLinha({rotulos: ult12.map(k => C.nomeMes(k, true)), series: [{nome: 'Receitas', cor: 'var(--pos)', valores: res12.map(m => m.r)}, {nome: 'Despesas', cor: 'var(--neg)', valores: res12.map(m => m.d)}, {nome: 'Resultado', cor: 'var(--ouro)', valores: res12.map(m => m.saldo), tracejada: true}]})}</div></div>
    </div>
    <div class="grade g2">
      <div class="card"><div class="card-cab"><h2>${ic('git-compare')}Comparativo</h2><small>este período x anterior</small></div><div class="card-corpo">
        ${graficoBarras({rotulos: topCats.map(id => categoria(id).nome), series: [{nome: 'Período anterior', cor: 'var(--roxo-mut)', valores: topCats.map(id => (catAntes.find(c => c.id === id) || {}).valor || 0)}, {nome: 'Este período', cor: 'var(--roxo-2)', valores: topCats.map(id => (catAgora.find(c => c.id === id) || {}).valor || 0)}]})}</div></div>
      <div class="card"><div class="card-cab"><h2>${ic('wallet')}Distribuição por contas</h2><small>saldo de hoje</small></div><div class="card-corpo">
        ${graficoRosca({itens: contasPos, sub: 'positivo'})}</div></div>
    </div>
    <div class="grade g2">
      <div class="card"><div class="card-cab"><h2>${ic('calendar-clock')}Próximos vencimentos</h2><small>30 dias</small></div>
        ${proximos.length ? `<ul class="lista">${proximos.slice(0, 8).map(v => `<li class="linha"><span class="cat-ic" style="--c:${v.cor}">${ic(v.icone)}</span><div class="meio"><b>${esc(v.nome)}</b><small>${data(v.data)} · ${v.quando}</small></div><span class="valor">${brl(v.valor)}</span><span></span></li>`).join('')}</ul><a class="mais" href="#/calendario">Ver calendário</a>`
          : vazio('calendar-check', 'Nada vencendo', 'Nenhuma conta, fatura ou parcela pendente nos próximos 30 dias.')}</div>
      <div class="card"><div class="card-cab"><h2>${ic('history')}Últimos lançamentos</h2></div>
        ${estado.transacoes.length ? `<ul class="lista">${[...estado.transacoes].filter(t => t.data <= h).sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0)).slice(0, 6).map(t => linhaTx(t)).join('')}</ul><a class="mais" href="#/transacoes">Ver todas</a>`
          : vazio('list', 'Nenhum lançamento', 'Seus lançamentos mais recentes aparecem aqui.')}</div>
    </div>`;
  ligarPeriodo(el, filtro, () => { render(refazer(el)); desenharIcones(); });
  $$('[data-passo]', el).forEach(b => b.onclick = () => [() => F.formConta(), () => F.formTransacao('receita'), () => F.formTransacao('despesa'), () => F.formCartao()][+b.dataset.passo]());
  const mig = $('[data-mig]', el);
  if(mig) mig.onclick = () => alterar('Recado da mudança lido', e => { e.config.migracaoVista = true; });
  const sal = $('[data-mig-saldo]', el);
  if(sal) sal.onclick = () => { const c = achar('contas', 'conta-principal'); if(c) F.formConta(c); };
  ligarAcoes(el);
}

// recado depois de trazer os dados do painel antigo
function avisoMigracao(){
  if(!estado.config.migradoEm || estado.config.migracaoVista) return '';
  return `<div class="card" style="margin-bottom:16px; border-color:var(--ouro)"><div class="card-corpo" style="display:grid; gap:10px">
    <h3 style="display:flex; gap:8px; align-items:center; font-size:15px">${ic('sparkles')}Seus dados do painel antigo vieram junto</h3>
    <p style="margin:0; font-size:13.5px" class="txt-mut">Os gastos do dia a dia, as contas fixas (agora despesas que repetem todo mês), as parcelas das dívidas, a renda (agora um salário que repete) e as entradas extras estão aqui, todos na <b>Conta principal</b>. O painel antigo continua guardado neste aparelho, sem mudança.</p>
    <p style="margin:0; font-size:13.5px" class="txt-mut"><b>Falta uma coisa:</b> o painel antigo não sabia quanto havia no banco. Ajuste o <b>saldo inicial</b> da Conta principal para o saldo de hoje bater com o do seu banco. Se quiser, renomeie a conta (ex.: Inter) e confira o dia de vencimento das dívidas, que veio como dia 10.</p>
    <div style="display:flex; gap:8px; flex-wrap:wrap"><button class="btn primario pequeno" data-mig-saldo>${ic('pencil')}Ajustar a Conta principal</button><button class="btn pequeno" data-mig>Entendi</button></div>
  </div></div>`;
}

// despesas pendentes, faturas e parcelas de dívida nos próximos dias (inclui atrasadas)
export function proximosVencimentos(dias){
  const h = C.hoje(), lim = C.somaDias(h, dias), out = [];
  const quando = d => d < h ? 'atrasada' : d === h ? 'hoje' : 'em ' + C.difDias(h, d) + ' dias';
  estado.transacoes.filter(t => t.tipo === 'despesa' && !t.pagoEm && t.data <= lim).forEach(t => out.push({nome: t.descricao, data: t.data, valor: t.valor, cor: categoria(t.categoriaId).cor, icone: categoria(t.categoriaId).icone, quando: quando(t.data)}));
  estado.cartoes.forEach(c => C.faturasDoCartao(c).filter(f => f.restante > 0 && f.vencimento <= lim).forEach(f => out.push({nome: 'Fatura ' + c.nome, data: f.vencimento, valor: f.restante, cor: c.cor, icone: 'credit-card', quando: quando(f.vencimento)})));
  estado.dividas.forEach(d => { const p = C.proximaParcela(d); if(p && p.vencimento <= lim) out.push({nome: `${d.credor} · parcela ${p.n}/${d.parcelas}`, data: p.vencimento, valor: d.valorParcela, cor: '#A63D33', icone: 'hand-coins', quando: quando(p.vencimento)}); });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
