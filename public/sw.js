const VERSION = 'yikon-academic-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('yikon-academic-') && key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 业务页面和接口包含内部数据，服务工作线程不缓存响应，只提供安全的桌面安装外壳。
self.addEventListener('fetch', () => undefined);
