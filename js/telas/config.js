// Configurações: perfil, aparência, categorias, avisos, privacidade e dados.
import {estado, alterar, substituir, novoEstado, uid, completar, redesenhar} from '../dados.js';
import {$, $$, esc, ic, abrirModal, campo, confirmar, toast, chipCategoria} from '../ui.js';
import {baixar} from './relatorios.js';
import {nuvem, nuvemAtiva, conectar, desconectar, gerarChave, linkCelular, puxar} from '../nuvem.js';

const ICONES = ['circle', 'utensils', 'house', 'droplet', 'zap', 'wifi', 'bus', 'fuel', 'heart-pulse', 'graduation-cap', 'gamepad-2', 'shopping-cart', 'shopping-bag', 'repeat', 'landmark', 'gift', 'baby', 'dog', 'plane', 'shirt', 'dumbbell', 'music', 'briefcase', 'laptop', 'trending-up', 'key-round', 'coffee', 'pill', 'wrench', 'smartphone'];
const interruptor = (nome, ligado) => `<label class="interruptor"><input type="checkbox" data-cfg="${nome}" ${ligado ? 'checked' : ''}><span></span></label>`;
const salvarCfg = (texto, fn) => alterar(texto, e => fn(e.config));

export function render(el){
  const c = estado.config, av = c.avisos;
  const cats = tipo => estado.categorias.filter(x => x.tipo === tipo);
  const usoCat = id => estado.transacoes.filter(t => t.categoriaId === id).length + estado.compras.filter(x => x.categoriaId === id).length + estado.recorrencias.filter(r => r.categoriaId === id).length;
  el.innerHTML = `${cartaoDrive()}<div class="grade g2">
    <div class="card"><div class="card-cab"><h2>${ic('user')}Perfil</h2></div>
      <div class="cfg-linha"><span class="avatar" style="width:52px;height:52px;font-size:20px;${c.foto ? `background-image:url(${c.foto})` : ''}">${c.foto ? '' : esc((c.nome || 'V')[0].toUpperCase())}</span>
        <div class="meio"><b>Foto</b><small>Vai junto para os outros aparelhos, se o Drive estiver conectado.</small></div>
        <label class="btn pequeno">${ic('image')}Escolher<input type="file" accept="image/*" data-foto hidden></label>${c.foto ? `<button class="btn pequeno ghost" data-sem-foto>Remover</button>` : ''}</div>
      <div class="cfg-linha"><div class="meio"><b>Nome</b><small>Aparece no menu e na saudação.</small></div><input type="text" data-nome value="${esc(c.nome)}" placeholder="Seu nome" maxlength="40"></div>
      <div class="cfg-linha"><div class="meio"><b>Usuários e login</b><small>Sem servidor, não há login: quem separa os dados é a chave do Drive. Cada pessoa usa o próprio script e a própria chave.</small></div></div>
    </div>
    <div class="card"><div class="card-cab"><h2>${ic('palette')}Aparência e formato</h2></div>
      <div class="cfg-linha"><div class="meio"><b>Tema</b></div><select data-tema>${[['auto', 'Igual ao sistema'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, t]) => `<option value="${v}" ${c.tema === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="cfg-linha"><div class="meio"><b>Formato de data</b></div><select data-formato>${[['dd/mm/aaaa', '31/12/2026'], ['aaaa-mm-dd', '2026-12-31'], ['mm/dd/aaaa', '12/31/2026']].map(([v, t]) => `<option value="${v}" ${c.formatoData === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="cfg-linha"><div class="meio"><b>Moeda</b><small>Real brasileiro.</small></div><select disabled><option>BRL (R$)</option></select></div>
      <div class="cfg-linha"><div class="meio"><b>Ocultar valores</b><small>Troca os números por •••, para usar em público. Também pelo ícone de olho no topo.</small></div>${interruptor('ocultarValores', c.ocultarValores)}</div>
    </div>
  </div>
  <div class="grade g2">
    <div class="card"><div class="card-cab"><h2>${ic('tags')}Categorias</h2><button class="btn pequeno" data-nova-cat>${ic('plus')}Nova</button></div>
      ${['despesa', 'receita'].map(t => `<div class="dia-cab">${t === 'despesa' ? 'Despesas' : 'Receitas'}</div><ul class="lista">${cats(t).map(x => `<li class="linha">${chipCategoria(x.id)}<div class="meio"><b>${esc(x.nome)}</b><small>${usoCat(x.id)} ${usoCat(x.id) === 1 ? 'uso' : 'usos'}${x.sistema ? ' · usada pelos pagamentos de dívida' : ''}</small></div><span></span>
        <span class="acoes"><button class="icone-btn mini" data-cat="${x.id}" title="Editar">${ic('pencil')}</button>${x.sistema ? '' : `<button class="icone-btn mini perigo" data-del-cat="${x.id}" title="Excluir">${ic('trash-2')}</button>`}</span></li>`).join('')}</ul>`).join('')}
    </div>
    <div>
      <div class="card" style="margin-bottom:16px"><div class="card-cab"><h2>${ic('bell')}Avisos</h2></div>
        ${[['vencimento', 'Contas e parcelas perto do vencimento'], ['atrasadas', 'Contas atrasadas'], ['faturas', 'Faturas perto do vencimento'], ['limite', 'Cartão perto do limite (80%)'], ['orcamento', 'Orçamento em 80% e ultrapassado'], ['metas', 'Metas atingidas'], ['receitas', 'Receitas previstas']].map(([k, t]) => `<div class="cfg-linha"><div class="meio"><b>${t}</b></div>${interruptor('avisos.' + k, av[k])}</div>`).join('')}
        <div class="cfg-linha"><div class="meio"><b>Avisar com antecedência de</b></div><select data-dias>${[1, 2, 3, 5, 7, 10].map(n => `<option value="${n}" ${c.diasAviso === n ? 'selected' : ''}>${n} ${n === 1 ? 'dia' : 'dias'}</option>`).join('')}</select></div>
        <div class="cfg-linha"><div class="meio"><small>Os avisos aparecem no sino, dentro do app. E-mail e notificação no celular precisariam de um servidor.</small></div></div>
      </div>
      <div class="card"><div class="card-cab"><h2>${ic('shield')}Dados e privacidade</h2></div>
        <div class="cfg-linha"><div class="meio"><b>Onde ficam</b><small>${nuvemAtiva() ? 'Neste aparelho e no arquivo painel-financas.json do seu Google Drive, pelo seu próprio script.' : 'Só neste navegador, neste aparelho. Conecte o Drive para ter os mesmos dados no celular.'} Faça cópias de vez em quando.</small></div></div>
        <div class="cfg-linha"><div class="meio"><b>Exportar cópia</b><small>Arquivo .json com tudo (sem os comprovantes).</small></div><button class="btn pequeno" data-exportar>${ic('download')}Exportar</button></div>
        <div class="cfg-linha"><div class="meio"><b>Restaurar cópia</b><small>Substitui os dados atuais pelos do arquivo.</small></div><label class="btn pequeno">${ic('upload')}Escolher arquivo<input type="file" accept="application/json,.json" data-importar hidden></label></div>
        <div class="cfg-linha"><div class="meio"><b>Histórico de alterações</b><small>${estado.historico.length} registros.</small></div><button class="btn pequeno" data-hist>${ic('history')}Ver</button></div>
        <div class="cfg-linha"><div class="meio"><b>Apagar tudo</b><small>Volta o app ao começo. Não dá para desfazer depois de sair da tela.</small></div><button class="btn pequeno perigo" data-apagar>${ic('trash-2')}Apagar</button></div>
      </div>
    </div>
  </div>`;

  ligarDrive(el);
  $('[data-nome]', el).onchange = e => salvarCfg('Nome alterado', cf => { cf.nome = e.target.value.trim().slice(0, 40); });
  $('[data-tema]', el).onchange = e => salvarCfg('Tema alterado', cf => { cf.tema = e.target.value; });
  $('[data-formato]', el).onchange = e => salvarCfg('Formato de data alterado', cf => { cf.formatoData = e.target.value; });
  $('[data-dias]', el).onchange = e => salvarCfg('Antecedência dos avisos alterada', cf => { cf.diasAviso = +e.target.value; });
  $$('[data-cfg]', el).forEach(i => i.onchange = () => salvarCfg('Configuração alterada', cf => { const [a, b] = i.dataset.cfg.split('.'); if(b) cf[a][b] = i.checked; else cf[a] = i.checked; }));
  $('[data-foto]', el).onchange = e => foto(e.target.files[0]);
  const sf = $('[data-sem-foto]', el); if(sf) sf.onclick = () => salvarCfg('Foto removida', cf => { cf.foto = ''; });
  $('[data-nova-cat]', el).onclick = () => formCategoria();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-cat],[data-del-cat]'); if(!b) return;
    if(b.dataset.cat) formCategoria(estado.categorias.find(x => x.id === b.dataset.cat));
    else excluirCategoria(estado.categorias.find(x => x.id === b.dataset.delCat), usoCat(b.dataset.delCat));
  });
  $('[data-exportar]', el).onclick = () => { baixar(new Blob([JSON.stringify(estado, null, 1)], {type: 'application/json'}), `septim-copia-${new Date().toISOString().slice(0, 10)}.json`); toast('Cópia exportada'); };
  $('[data-importar]', el).onchange = e => importar(e.target.files[0]);
  $('[data-hist]', el).onclick = historico;
  $('[data-apagar]', el).onclick = async () => {
    if(!await confirmar('Apagar <b>todos</b> os dados deste aparelho? Exporte uma cópia antes, se quiser guardar.', 'Apagar tudo')) return;
    const foto = JSON.stringify(estado);
    substituir(novoEstado(), 'Tudo apagado');
    toast('Tudo apagado', foto);
  };
}

// reduz a foto para 160 px antes de guardar
function foto(arq){
  if(!arq) return;
  const img = new Image(), url = URL.createObjectURL(arq);
  img.onload = () => {
    const s = 160, cv = document.createElement('canvas'), k = Math.max(s / img.width, s / img.height);
    cv.width = cv.height = s;
    cv.getContext('2d').drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
    URL.revokeObjectURL(url);
    salvarCfg('Foto alterada', cf => { cf.foto = cv.toDataURL('image/jpeg', .85); });
  };
  img.onerror = () => toast('Não consegui abrir essa imagem');
  img.src = url;
}

function formCategoria(cat = null){
  const v = cat || {nome: '', tipo: 'despesa', cor: '#9B7BDA', icone: 'circle'};
  abrirModal({
    titulo: cat ? 'Editar categoria' : 'Nova categoria', botao: cat ? 'Salvar' : 'Criar',
    corpo: `<div class="grade-form">${campo('text', 'nome', 'Nome', v.nome, {obrigatorio: true})}
      ${cat ? '' : campo('select', 'tipo', 'Tipo', v.tipo, {opcoes: [['despesa', 'Despesa'], ['receita', 'Receita']]})}
      ${campo('cor', 'cor', 'Cor', v.cor)}
      ${campo('select', 'icone', 'Ícone', v.icone, {opcoes: ICONES.map(i => [i, i.replace(/-/g, ' ')])})}</div>`,
    aoSalvar: d => {
      const nome = d.nome.trim(), tipo = cat ? cat.tipo : d.tipo;
      if(!nome) return 'Informe o nome.';
      if(estado.categorias.some(x => x.tipo === tipo && x.nome.toLowerCase() === nome.toLowerCase() && (!cat || x.id !== cat.id))) return 'Já existe uma categoria com esse nome.';
      if(cat) toast('Categoria atualizada', alterar('Categoria atualizada', e => Object.assign(e.categorias.find(x => x.id === cat.id), {nome, cor: d.cor, icone: d.icone})));
      else toast('Categoria criada', alterar('Categoria criada', e => e.categorias.push({id: uid(), nome, tipo, cor: d.cor, icone: d.icone})));
    },
  });
}
async function excluirCategoria(cat, uso){
  const destino = estado.categorias.find(x => x.tipo === cat.tipo && x.id !== cat.id && /^outros/.test(x.id)) || estado.categorias.find(x => x.tipo === cat.tipo && x.id !== cat.id && !x.sistema);
  if(!destino) return toast('Precisa existir outra categoria desse tipo');
  if(!await confirmar(`Excluir <b>${esc(cat.nome)}</b>?${uso ? ` Os ${uso} lançamentos dela passam para <b>${esc(destino.nome)}</b>.` : ''}`)) return;
  toast('Categoria excluída', alterar('Categoria excluída', e => {
    ['transacoes', 'compras', 'recorrencias'].forEach(k => e[k].forEach(x => { if(x.categoriaId === cat.id) x.categoriaId = destino.id; }));
    if(e.orcamento.limites[cat.id]){ e.orcamento.limites[destino.id] = (e.orcamento.limites[destino.id] || 0) + e.orcamento.limites[cat.id]; delete e.orcamento.limites[cat.id]; }
    e.categorias = e.categorias.filter(x => x.id !== cat.id);
  }));
}

async function importar(arq){
  if(!arq) return;
  let dados;
  try{ dados = JSON.parse(await arq.text()); }catch(e){ return toast('Esse arquivo não é uma cópia válida'); }
  if(!dados || typeof dados !== 'object' || !Array.isArray(dados.transacoes)) return toast('Esse arquivo não é uma cópia do Septim novo');
  if(!await confirmar(`Substituir os dados atuais pelos do arquivo <b>${esc(arq.name)}</b>?`, 'Substituir')) return;
  const foto = JSON.stringify(estado);
  substituir(completar(dados), 'Cópia restaurada: ' + arq.name);
  toast('Cópia restaurada', foto);
}

function historico(){
  abrirModal({
    titulo: 'Histórico de alterações', larga: true,
    corpo: estado.historico.length ? `<ul class="historico">${estado.historico.slice(0, 200).map(h => `<li><span>${esc(h.texto)}</span><span class="txt-fraco">${new Date(h.quando).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</span></li>`).join('')}</ul>` : '<p class="nota">Nada ainda.</p>',
  });
}

/* ================= Google Drive ================= */
function cartaoDrive(){
  const ativa = nuvemAtiva();
  return `<div class="card" style="margin-bottom:16px"><div class="card-cab"><h2>${ic('cloud')}Sincronizar com o Google Drive</h2>${ativa ? `<span class="nuvem ${nuvem.classe}"><i></i>${esc(nuvem.status || 'conectado')}</span>` : ''}</div>
    ${ativa ? `<div class="cfg-linha"><div class="meio"><b>Conectado</b><small>Cada alteração sobe em segundos; os outros aparelhos puxam sozinhos. Sem internet, fica salvo aqui e sobe quando voltar.</small></div></div>
      <div class="cfg-linha" style="flex-wrap:wrap"><button class="btn pequeno" data-n-puxar>${ic('refresh-cw')}Buscar atualizações</button><button class="btn pequeno" data-n-link>${ic('smartphone')}Copiar link para o celular</button><span class="cresce"></span><button class="btn pequeno ghost" data-n-sair>Desconectar</button></div>
      <div class="cfg-linha"><div class="meio"><small>O link do celular carrega a chave: trate como senha e mande só para você.</small></div></div>`
    : `<div class="card-corpo" style="display:grid; gap:10px">
      <p class="txt-mut" style="margin:0; font-size:13px">Use o mesmo script do Apps Script do painel antigo. Passo a passo no README do repositório, em “Sincronizar com o Google Drive”.</p>
      <div class="campo"><span>URL do app da Web (termina em /exec)</span><input data-n-url placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>
      <div class="campo"><span>Chave secreta</span><div style="display:flex; gap:8px"><input data-n-chave placeholder="chave" autocomplete="off" style="flex:1"><button class="btn" data-n-gerar>Gerar</button></div></div>
      <button class="btn primario" data-n-conectar>${ic('plug')}Conectar</button>
      <p class="n-status" data-n-status hidden role="status"></p></div>`}
  </div>`;
}
function ligarDrive(el){
  const st = (txt, tipo) => { const p = $('[data-n-status]', el); if(!p) return; p.textContent = txt; p.className = 'n-status ' + (tipo || ''); p.hidden = !txt; };
  const g = $('[data-n-gerar]', el);
  if(g) g.onclick = async () => { const k = gerarChave(); $('[data-n-chave]', el).value = k; try{ await navigator.clipboard.writeText(k); toast('Chave copiada: cole na linha const CHAVE do script'); }catch(e){ toast('Chave gerada: copie do campo'); } };
  const c = $('[data-n-conectar]', el);
  if(c) c.onclick = async () => {
    c.disabled = true; st('Conectando… pode levar alguns segundos.');
    try{ await conectar({url: $('[data-n-url]', el).value, chave: $('[data-n-chave]', el).value}); toast('Drive conectado'); redesenhar(); }
    catch(e){ st(e.message, 'erro'); c.disabled = false; }
  };
  const p = $('[data-n-puxar]', el); if(p) p.onclick = async () => toast((await puxar(true)) ? 'Atualizado' : 'Já está em dia');
  const l = $('[data-n-link]', el);
  if(l) l.onclick = async () => { const link = linkCelular(); try{ await navigator.clipboard.writeText(link); toast('Link copiado: abra no celular'); }catch(e){ prompt('Copie este link e abra no celular:', link); } };
  const s = $('[data-n-sair]', el);
  if(s) s.onclick = async () => { if(await confirmar('Desconectar este aparelho do Drive? Os dados continuam aqui e no Drive.', 'Desconectar')){ desconectar(); toast('Desconectado'); redesenhar(); } };
}
