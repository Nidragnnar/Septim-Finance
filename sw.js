// Cache só do essencial, e só do próprio site (as conversas com o Drive
// passam direto). Rede primeiro: com sinal você pega sempre a versão nova;
// sem sinal, o cache abre o painel.
const VERSAO = 'septim-v9';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png', './logo.png', './dragao.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(VERSAO).then(c => c.put(e.request, copia)).catch(() => {});
        return resposta;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
