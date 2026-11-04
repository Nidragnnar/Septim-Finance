// Google Drive pelo Apps Script: o mesmo script e a mesma conexão do painel antigo.
// Cada alteração sobe em segundos; a cada 15 s (e ao voltar para a tela) pergunta se há novidade.
// Se dois aparelhos mexerem ao mesmo tempo, as duas versões são juntadas (dados.mesclar).
import {estado, loc, aoMudar, definirRemoto, mesclar, completar, vazio, temArmazenamento} from './dados.js';

const ouvintes = [];
export const aoStatus = fn => ouvintes.push(fn);
export const nuvem = {
  cfg: (() => { try{ return JSON.parse(loc.get('painel-nuvem') || 'null'); }catch(e){ return null; } })(),
  base: Number(loc.get('painel-nuvem-base') || 0),
  sujo: loc.get('painel-nuvem-sujo') === '1',
  ocupado: false, status: '', classe: '',
};
export const nuvemAtiva = () => temArmazenamento() && !!(nuvem.cfg && nuvem.cfg.url && nuvem.cfg.chave);
const setBase = v => { nuvem.base = v; loc.set('painel-nuvem-base', String(v)); };
const setSujo = v => { nuvem.sujo = v; loc.set('painel-nuvem-sujo', v ? '1' : '0'); };
const MSG_OFF = () => navigator.onLine ? 'Drive fora do ar · salvo aqui' : 'sem internet · salvo aqui';
function marcar(classe, txt){ nuvem.classe = classe; nuvem.status = txt; ouvintes.forEach(fn => fn()); }

// falha com um código que diz o que deu errado: rede, tempo, http-NNN, resposta, chave, pedido, acao
async function chamar(corpo, cfg = nuvem.cfg){
  const parar = new AbortController(), relogio = setTimeout(() => parar.abort(), 25000);
  let r;
  try{
    r = await fetch(cfg.url, {method: 'POST', signal: parar.signal,
      headers: {'Content-Type': 'text/plain;charset=utf-8'},    // pedido simples: sem pré-verificação de CORS
      body: JSON.stringify(Object.assign({chave: cfg.chave}, corpo))});
  }catch(e){ throw new Error(e.name === 'AbortError' ? 'tempo' : 'rede'); }
  finally{ clearTimeout(relogio); }
  if(!r.ok) throw new Error('http-' + r.status);
  let j;
  try{ j = JSON.parse(await r.text()); }catch(e){ throw new Error('resposta'); }
  if(!j || typeof j !== 'object') throw new Error('resposta');
  if(j.erro) throw new Error(j.erro);
  return j;
}

export function explicarFalha(codigo){
  const NOVA = 'No Apps Script: Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar.';
  if(codigo === 'chave') return 'O script recusou a chave. Confira se a chave do campo é igual à da linha const CHAVE, salve o script e publique uma versão nova. ' + NOVA;
  if(codigo === 'rede') return navigator.onLine ? 'O Google bloqueou a conversa com o script. Quase sempre é o acesso: em Gerenciar implantações, “Quem pode acessar” tem que ser “Qualquer pessoa”.' : 'Sem internet neste aparelho.';
  if(codigo === 'tempo') return 'O script demorou demais para responder. Tente de novo em alguns segundos.';
  if(codigo === 'resposta') return 'O endereço respondeu, mas não como o script do painel. Confira o URL do app da Web e o código do Codigo.gs. ' + NOVA;
  if(codigo === 'pedido' || codigo === 'acao') return 'O script publicado está desatualizado. Cole de novo o Codigo.gs e publique. ' + NOVA;
  if(/^http-/.test(codigo)) return `O Google respondeu com erro ${codigo.slice(5)}. Se acabou de implantar, espere um minuto.`;
  return 'Não consegui falar com o script (' + codigo + ').';
}
const resumoFalha = c => c === 'chave' ? 'chave recusada' : c === 'rede' && navigator.onLine ? 'Drive bloqueou' : MSG_OFF();

let editando = 0;   // conta as alterações locais, para saber se algo mudou enquanto falava com o Drive
export async function enviar(tentativa = 0){
  if(!nuvemAtiva() || nuvem.ocupado) return;
  if(!navigator.onLine) return marcar('off', MSG_OFF());
  nuvem.ocupado = true; marcar('ocupado', 'sincronizando…');
  const marca = editando;
  let repetir = null;
  try{
    const r = await chamar({acao: 'gravar', base: nuvem.base, estado});
    if(r.conflito){
      // outro aparelho gravou antes: junta as duas versões e tenta de novo
      setBase(r.versao); setSujo(true);
      definirRemoto(mesclar(estado, r.estado || {}));
      if(tentativa < 3) repetir = tentativa + 1;
    }else{
      setBase(r.versao); setSujo(editando !== marca);
      if(nuvem.sujo) repetir = 0;
      marcar('ok', 'Drive ✓');
    }
  }catch(e){ marcar('off', resumoFalha(e.message)); }
  finally{ nuvem.ocupado = false; }
  if(repetir !== null) setTimeout(() => enviar(repetir), 250);
}

export async function puxar(forcar = false){
  if(!nuvemAtiva() || nuvem.ocupado) return false;
  if(nuvem.sujo){ await enviar(); return true; }
  if(!navigator.onLine){ marcar('off', MSG_OFF()); return false; }
  nuvem.ocupado = true;
  const marca = editando;
  let mudou = false, reenviar = false, novo = null;
  try{
    const v = await chamar({acao: 'versao'});
    if(v.versao !== nuvem.base || forcar){
      marcar('ocupado', 'sincronizando…');
      const r = await chamar({acao: 'ler'});
      const remoto = completar(r.estado);           // arquivo ainda no formato antigo: converte aqui
      if(editando !== marca){ novo = mesclar(estado, remoto); reenviar = true; }
      else if(!vazio(remoto)){ novo = remoto; reenviar = !!(r.estado && !Array.isArray(r.estado.transacoes)); }   // formato antigo: sobe já no novo
      else if(!vazio(estado)) reenviar = true;       // arquivo do Drive vazio: sobe o que tem aqui
      setBase(r.versao); mudou = true;
    }
    marcar('ok', 'Drive ✓');
  }catch(e){ marcar('off', resumoFalha(e.message)); }
  finally{ nuvem.ocupado = false; }
  if(novo) definirRemoto(novo);
  if(reenviar){ setSujo(true); await enviar(); }
  return mudou;
}

export async function conectar(dados){
  const cfg = {url: String(dados.url || '').trim(), chave: String(dados.chave || '').trim().replace(/^['"]|['"]$/g, '')};
  if(/\/dev\/?$/.test(cfg.url)) throw new Error('Esse é o endereço de teste (termina em /dev), que só funciona dentro do editor. Use o URL do app da Web, que termina em /exec.');
  if(!/^https:\/\/script\.google\.com\/.+\/exec$/.test(cfg.url)) throw new Error('O endereço precisa começar com https://script.google.com/ e terminar em /exec.');
  if(cfg.chave.length < 16) throw new Error('A chave está vazia ou curta demais. Gere uma, cole na linha const CHAVE do script, salve e publique uma versão nova.');
  let r;
  try{ r = await chamar({acao: 'ler'}, cfg); }catch(e){ throw new Error(explicarFalha(e.message)); }
  nuvem.cfg = cfg; loc.set('painel-nuvem', JSON.stringify(cfg));
  const remoto = completar(r.estado);
  setBase(r.versao);
  if(vazio(remoto)) setSujo(true);
  else if(vazio(estado)){ setSujo(!Array.isArray((r.estado || {}).transacoes)); definirRemoto(remoto); }
  else { setSujo(true); definirRemoto(mesclar(estado, remoto)); }
  if(nuvem.sujo) await enviar(); else marcar('ok', 'Drive ✓');
}
export function desconectar(){
  nuvem.cfg = null; setBase(0); setSujo(false);
  loc.del('painel-nuvem'); loc.del('painel-nuvem-base'); loc.del('painel-nuvem-sujo');
  marcar('', '');
}
export const gerarChave = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
export const linkCelular = () => location.origin + location.pathname + '#conectar=' + encodeURIComponent(btoa(JSON.stringify(nuvem.cfg)));

// link do celular: #conectar=… (lido antes das rotas)
export async function lerLinkDeConexao(){
  const m = location.hash.match(/^#conectar=(.+)$/);
  if(!m) return null;
  history.replaceState(null, '', location.pathname + location.search + '#/dashboard');
  try{ await conectar(JSON.parse(atob(decodeURIComponent(m[1])))); return 'Drive conectado'; }
  catch(e){ return 'Não conectou: ' + e.message; }
}

// cada alteração sua marca para subir; o que veio do Drive não sobe de novo
let timer;
aoMudar(origem => {
  if(origem !== 'local' || !nuvemAtiva()) return;
  editando++; setSujo(true);
  clearTimeout(timer); timer = setTimeout(() => enviar(), 600);
});
export function iniciarNuvem(){
  setInterval(() => { if(document.visibilityState === 'visible') puxar(); }, 15000);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') puxar(); });
  addEventListener('online', () => { if(nuvemAtiva()) (nuvem.sujo ? enviar() : puxar()); });
  if(nuvemAtiva()) puxar();
}
