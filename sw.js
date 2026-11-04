// Cache para abrir sem internet. Rede primeiro: com sinal você pega sempre a versão nova.
const VERSAO = 'septim-v13';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/app.js', './js/dados.js', './js/calc.js', './js/ui.js', './js/formularios.js', './js/migracao.js', './js/nuvem.js', './js/extrato.js',
  './js/telas/dashboard.js', './js/telas/lancamentos.js', './js/telas/contas.js', './js/telas/cartoes.js', './js/telas/planejamento.js', './js/telas/metas.js',
  './js/telas/investimentos.js', './js/telas/dividas.js', './js/telas/calendario.js', './js/telas/relatorios.js', './js/telas/config.js',
  './img/logo.png', './img/dragao.png', './img/grifo.png', './img/oblivion.png', './img/espinhos.png', './img/icone-192.png', './img/icone-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // ícones e fontes de fora também ficam guardados depois da primeira visita
  const deFora = /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if(url.origin !== location.origin && !deFora) return;
  e.respondWith(fetch(e.request).then(r => { if(r.ok || r.type === 'opaque'){ const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
