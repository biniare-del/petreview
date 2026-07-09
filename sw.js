const CACHE_NAME = "petreview-v10";

const PRECACHE_ASSETS = [
  "/petreview/care.html",
  "/petreview/style.css",
  "/petreview/care.js",
  "/petreview/auth.js",
  "/petreview/supabase-client.js",
  "/petreview/manifest.json",
  "/petreview/icons/icon-192.png",
  "/petreview/icons/icon-512.png",
];

const STATIC_EXTS = [".css", ".js", ".svg", ".png", ".jpg", ".webp", ".ico"];

function isStatic(url) {
  try {
    return STATIC_EXTS.some(ext => new URL(url).pathname.endsWith(ext));
  } catch { return false; }
}

// 설치 — 핵심 파일만 사전 캐싱 (app.js 146KB 제외)
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// 활성화 — 이전 캐시 정리
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = e.request.url;

  // 외부 API / CDN / non-GET 요청 → 패스스루
  if (
    url.includes("supabase.co") ||
    url.includes("cdn.jsdelivr") ||
    url.includes("dapi.kakao") ||
    url.includes("vercel.app") ||
    e.request.method !== "GET"
  ) return;

  if (isStatic(url)) {
    // 정적 자산: 캐시 즉시 반환 + 백그라운드 갱신 (stale-while-revalidate)
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(() => null);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // HTML 페이지: 네트워크 우선, 실패 시 캐시
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});

self.addEventListener("push", e => {
  const data = e.data?.json() ?? {};
  const title = data.title || "우쭈쭈";
  const options = {
    body: data.body || "",
    icon: "/petreview/icons/icon-192.png",
    badge: "/petreview/icons/icon-192.png",
    data: { url: data.url || "/petreview/" },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/petreview/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then(list => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
