/**
 * Painel de finanças — ponte com o Google Drive.
 *
 * Guarda tudo num único arquivo, painel-financas.json, no seu Drive.
 * Roda com a sua conta e só responde a quem mandar a chave certa.
 *
 * 1. Cole abaixo, entre as aspas, a chave gerada no painel (botão "gerar").
 * 2. Salve e rode a função "testar" uma vez para autorizar.
 * 3. Implantar > Nova implantação > App da Web
 *    Executar como: Eu · Quem pode acessar: Qualquer pessoa
 */
const CHAVE = 'COLE-AQUI-A-CHAVE-GERADA-NO-PAINEL';
const NOME_DO_ARQUIVO = 'painel-financas.json';

function doPost(e) {
  let pedido;
  try { pedido = JSON.parse(e.postData.contents); }
  catch (err) { return responder_({ erro: 'pedido' }); }

  if (CHAVE.indexOf('COLE-AQUI') === 0 || pedido.chave !== CHAVE) {
    return responder_({ erro: 'chave' });
  }

  const props = PropertiesService.getScriptProperties();
  const versaoAtual = () => Number(props.getProperty('versao') || 0);

  if (pedido.acao === 'versao') {
    arquivo_();                                   // garante que o arquivo existe
    return responder_({ versao: versaoAtual() });
  }

  if (pedido.acao === 'ler') {
    const estado = lerEstado_();
    return responder_({ versao: versaoAtual(), estado: estado });
  }

  if (pedido.acao === 'gravar') {
    const trava = LockService.getScriptLock();
    trava.waitLock(15000);
    try {
      const atual = versaoAtual();
      // outro aparelho gravou depois da última leitura deste: devolve para ele juntar
      if (Number(pedido.base) !== atual) {
        return responder_({ conflito: true, versao: atual, estado: lerEstado_() });
      }
      arquivo_().setContent(JSON.stringify(pedido.estado));
      props.setProperty('versao', String(atual + 1));
      return responder_({ ok: true, versao: atual + 1 });
    } finally {
      trava.releaseLock();
    }
  }

  return responder_({ erro: 'acao' });
}

// Abrir o endereço /exec no navegador mostra esta mensagem: serve de teste.
function doGet() {
  return ContentService.createTextOutput('Painel de finanças: ponte com o Drive funcionando.');
}

function lerEstado_() {
  const texto = arquivo_().getBlob().getDataAsString();
  try { return JSON.parse(texto || '{}'); } catch (err) { return {}; }
}

function arquivo_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('arquivoId');
  if (id) {
    try {
      const f = DriveApp.getFileById(id);
      if (!f.isTrashed()) return f;
    } catch (err) { /* apagado: cria de novo abaixo */ }
  }
  const novo = DriveApp.createFile(NOME_DO_ARQUIVO, '{}', 'application/json');
  props.setProperty('arquivoId', novo.getId());
  props.setProperty('versao', '0');
  return novo;
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Rode uma vez pelo editor: pede a autorização e cria o arquivo no Drive. */
function testar() {
  Logger.log('Tudo certo. Arquivo no Drive: ' + arquivo_().getUrl());
}
