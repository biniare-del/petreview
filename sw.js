const CACHE_NAME = "petreview-v1";
const STATIC_ASSETS = [
  "/petreview/",
  "/petreview/index.html",
  "/petreview/style.css",
  "/petreview/app.js",
  "/petreview/auth.js",
  "/petreview/supabase-client.js",
  "/petreview/manifest.json",
  "/petreview/icons/icon-192.svg",
  "/petreview/icons/icon-512.svg",
];

// 설치 — 정적 자산 캐싱
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화 — 이전 캐시 정리
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 네트워크 우선, 실패 시 캐시 사용
self.addEventListener("fetch", (e) => {
  // Supabase API, 외부 CDN은 캐싱 안 함
  if (
    e.request.url.includes("supabase.co") ||
    e.request.url.includes("cdn.jsdelivr") ||
    e.request.url.includes("dapi.kakao") ||
    e.request.method !== "GET"
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // 성공 응답이면 캐시에도 저장
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// 푸시 알림 수신
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  const title = data.title || "펫리뷰";
  const options = {
    body: data.body || "",
    icon: "/petreview/icons/icon-192.svg",
    badge: "/petreview/icons/icon-192.svg",
    data: { url: data.url || "/petreview/" },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 → 해당 URL 열기
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/petreview/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
