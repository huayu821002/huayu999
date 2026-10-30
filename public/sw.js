const CACHE_NAME = 'fiestaflare-chat-v1';
const urlsToCache = [
  // ★ 2026-10-30 安全修复：原来缓存 '/admin/chat' →
  //   后台页 HTML 会留在浏览器缓存里，退出登录后同设备的人仍可能看到缓存内容。
  //   后台路径一律不缓存。
  '/icon-192.png',
  '/icon-512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // 后台与 API 一律直连网络，绝不从缓存返回
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
