// Casca do app: menu, rotas, tema, avisos e ação rápida.
import {estado, aoMudar, alterar, salvar} from './dados.js';
import {avisos, gerarRecorrencias, hoje} from './calc.js';
import {$, $$, esc, ic, desenharIcones, iniciarDicas} from './ui.js';
import {acaoRapida} from './formularios.js';
import {nuvem, nuvemAtiva, aoStatus, puxar, lerLinkDeConexao, iniciarNuvem} from './nuvem.js';
import {toast} from './ui.js';
import * as dashboard from './telas/dashboard.js';
import * as lanc from './telas/lancamentos.js';
import * as contas from './telas/contas.js';
import * as cartoes from './telas/cartoes.js';
import * as assinaturas from './telas/assinaturas.js';
import * as planejamento from './telas/planejamento.js';
import * as metas from './telas/metas.js';
import * as investimentos from './telas/investimentos.js';
import * as dividas from './telas/dividas.js';
import * as calendario from './telas/calendario.js';
import * as relatorios from './telas/relatorios.js';
import * as config from './telas/config.js';

const TELAS = {
  dashboard: {nome: 'Dashboard', icone: 'layout-dashboard', sub: 'Visão geral das suas finanças', tela: dashboard},
  transacoes: {nome: 'Transações', icone: 'arrow-left-right', sub: 'Tudo que entrou, saiu e mudou de conta', tela: {render: lanc.transacoes}},
  receitas: {nome: 'Receitas', icone: 'arrow-down-left', sub: 'Dinheiro que entra', tela: {render: el => lanc.porTipo(el, 'receita')}},
  despesas: {nome: 'Despesas', icone: 'arrow-up-right', sub: 'Contas, compras e gastos', tela: {render: el => lanc.porTipo(el, 'despesa')}},
  contas: {nome: 'Contas', icone: 'wallet', sub: 'Bancos, carteiras e dinheiro', tela: contas},
  cartoes: {nome: 'Cartões', icone: 'credit-card', sub: 'Limites e faturas', tela: cartoes},
  assinaturas: {nome: 'Assinaturas', icone: 'repeat', sub: 'Cobranças que repetem sozinhas', tela: assinaturas},
  sep1: null,
  planejamento: {nome: 'Planejamento', icone: 'chart-pie', sub: 'Orçamento do mês por categoria', tela: planejamento},
  metas: {nome: 'Metas', icone: 'target', sub: 'Seus objetivos', tela: metas},
  investimentos: {nome: 'Investimentos', icone: 'trending-up', sub: 'Aplicações e evolução', tela: investimentos},
  dividas: {nome: 'Dívidas', icone: 'hand-coins', sub: 'Empréstimos e financiamentos', tela: dividas},
  sep2: null,
  calendario: {nome: 'Calendário', icone: 'calendar-days', sub: 'Vencimentos e movimentações do mês', tela: calendario},
  relatorios: {nome: 'Relatórios', icone: 'file-bar-chart', sub: 'Análises e exportação', tela: relatorios},
  configuracoes: {nome: 'Configurações', icone: 'settings', sub: 'Perfil, aparência e dados', tela: config},
};

/* ================= tema ================= */
function aplicarTema(){
  const t = estado.config.tema, escuro = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
  $('#btnTema').innerHTML = ic(escuro ? 'sun' : 'moon');
  $('#btnOcultar').innerHTML = ic(estado.config.ocultarValores ? 'eye-off' : 'eye');
  $('meta[name=theme-color]').content = escuro ? '#0F0B16' : '#2A1748';
}
$('#btnTema').onclick = () => {
  const escuro = document.documentElement.dataset.tema === 'escuro';
  alterar('Tema alterado', e => { e.config.tema = escuro ? 'claro' : 'escuro'; });
};
$('#btnOcultar').onclick = () => alterar(estado.config.ocultarValores ? 'Valores à mostra' : 'Valores ocultos', e => { e.config.ocultarValores = !e.config.ocultarValores; });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { aplicarTema(); desenharIcones(); });

/* ================= menu e rotas ================= */
const rotaAtual = () => { const [nome, ...resto] = location.hash.replace(/^#\/?/, '').split('/'); return {nome: TELAS[nome] ? nome : 'dashboard', param: resto.join('/')}; };
function menu(){
  const r = rotaAtual().nome;
  $('#menu').innerHTML = Object.entries(TELAS).map(([k, t]) => t ? `<a href="#/${k}" class="${k === r ? 'ativo' : ''}" ${k === r ? 'aria-current="page"' : ''}>${ic(t.icone)}<span>${t.nome}</span></a>` : '<div class="sep"></div>').join('');
  const nome = estado.config.nome || 'Você', foto = estado.config.foto;
  $('#perfil').innerHTML = `<span class="avatar" style="${foto ? `background-image:url(${foto})` : ''}">${foto ? '' : esc(nome[0].toUpperCase())}</span><div><b>${esc(nome)}</b><small>${nuvemAtiva() ? 'Sincronizado com o Drive' : 'Dados neste aparelho'}</small></div>`;
}
let rotaDesenhada = '';
function desenhar(){
  const {nome, param} = rotaAtual(), t = TELAS[nome], velho = $('#conteudo');
  // elemento novo a cada desenho: os ouvintes das telas não se acumulam
  const el = velho.cloneNode(false); velho.replaceWith(el);
  const mesma = rotaDesenhada === nome + '/' + param, rolagem = scrollY;
  $('#tituloPagina').textContent = t.nome; $('#subPagina').textContent = t.sub;
  document.title = t.nome + ' · Septim';
  aplicarTema(); menu(); sino();
  if(!mesma){ el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
  t.tela.render(el, param);
  desenharIcones();
  if(mesma) scrollTo(0, rolagem); else { scrollTo(0, 0); rotaDesenhada = nome + '/' + param; }
}
addEventListener('hashchange', () => { fecharMenu(); desenhar(); });
// dados vindos do Drive: cria as repetições que faltarem (ids fixos, então não duplicam) antes de desenhar
aoMudar(origem => { if(origem === 'nuvem' && gerarRecorrencias(estado)) salvar(); desenhar(); });

const fecharMenu = () => { $('#lateral').classList.remove('aberta'); $('#fundoMenu').hidden = true; };
$('#abrirMenu').onclick = () => { $('#lateral').classList.add('aberta'); $('#fundoMenu').hidden = false; };
$('#fundoMenu').onclick = fecharMenu;
$('#btnNovo').onclick = $('#fab').onclick = acaoRapida;

/* ================= avisos (sino) ================= */
function sino(){
  const lista = avisos(), novos = lista.filter(a => !estado.lidas[a.id]);
  $('#nAvisos').hidden = !novos.length; $('#nAvisos').textContent = novos.length > 9 ? '9+' : novos.length;
  const p = $('#painelAvisos');
  p.innerHTML = `<header>Avisos${novos.length ? `<button type="button" id="lerTodos">Marcar como lidos</button>` : ''}</header>`
    + (lista.length ? lista.map(a => `<a class="aviso-item nv-${a.nivel} ${estado.lidas[a.id] ? 'lido' : ''}" href="#/${a.link}" data-aviso="${esc(a.id)}"><span class="aviso-ic">${ic(a.icone)}</span><span>${a.texto}</span></a>`).join('')
      : `<div class="vazio" style="padding:24px">${ic('bell-off')}<p>Nenhum aviso agora.</p></div>`);
  const ler = $('#lerTodos', p);
  if(ler) ler.onclick = e => { e.stopPropagation(); alterar('Avisos lidos', st => lista.forEach(a => { st.lidas[a.id] = Date.now(); })); };
  $$('[data-aviso]', p).forEach(a => a.onclick = () => { p.hidden = true; if(!estado.lidas[a.dataset.aviso]){ estado.lidas[a.dataset.aviso] = Date.now(); salvar(); } });
}
$('#btnAvisos').onclick = e => { e.stopPropagation(); const p = $('#painelAvisos'); p.hidden = !p.hidden; $('#btnAvisos').setAttribute('aria-expanded', !p.hidden); if(!p.hidden) desenharIcones(); };
document.addEventListener('click', e => { if(!e.target.closest('.sino-wrap')) $('#painelAvisos').hidden = true; });

/* ================= Drive: bolinha no topo ================= */
function marcaNuvem(){
  const b = $('#btnNuvem'); b.hidden = !nuvemAtiva();
  b.className = 'nuvem ' + nuvem.classe; $('span', b).textContent = nuvem.status || 'Drive';
}
aoStatus(marcaNuvem); marcaNuvem();
$('#btnNuvem').onclick = async () => toast((await puxar(true)) ? 'Atualizado' : 'Já está em dia');

/* ================= início ================= */
// gera as ocorrências de repetições que venceram desde a última abertura (e confere de novo quando vira o dia)
let diaVisto = hoje();
const conferir = () => { if(gerarRecorrencias(estado)){ salvar(); desenhar(); } };
document.addEventListener('visibilitychange', () => { if(!document.hidden && hoje() !== diaVisto){ diaVisto = hoje(); conferir(); desenhar(); } });
iniciarDicas();
if(gerarRecorrencias(estado)) salvar();
// link do celular (#conectar=…): lido antes das rotas (ele já troca o endereço para o dashboard)
const doLink = /^#conectar=/.test(location.hash) ? lerLinkDeConexao() : null;
desenhar();
if(doLink) doLink.then(m => { if(m) toast(m); marcaNuvem(); });
iniciarNuvem();
// os ícones vêm de fora: se chegarem depois do primeiro desenho, desenha de novo
addEventListener('load', desenharIcones);
if('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
