// 端末内の画面を即座に返す（通信を待たない）。更新は裏で取得し、次回の起動から反映する
const CACHE = 'couplelog-app-067ee7b34ff6', INBOX = 'couplelog-inbox';
const ASSETS = ["./app.css","./app.js","./vendor/leaflet.js","./vendor/leaflet.css","./icon-192.png","./icon-512.png","./manifest.json","./index.html","./config.js"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('couplelog-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Android の共有メニュー。内容は端末内に置き、URL には載せない
async function receive(req) {
  const f = await req.formData(), c = await caches.open(INBOX), files = [];
  for (const b of f.getAll('photos')) if (b && b.size && /^image\//.test(b.type)) { const k = './photo-' + files.length; await c.put(k, new Response(b)); files.push(k); }
  await c.put('./inbox.json', new Response(JSON.stringify({ title: f.get('title') || '', text: f.get('text') || '', url: f.get('url') || '', files })));
  return Response.redirect('./?share=1', 303);
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method === 'POST' && url.pathname.endsWith('/share')) return e.respondWith(receive(req));
  if (req.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true })).then(hit => hit || fetch(req)));
});
