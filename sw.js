/* PMK service worker — bump CACHE_VERSION when precache list or app shell changes */
const CACHE_VERSION = 'pmk-static-v25';
const CDN_CACHE = 'pmk-cdn-v2';
const PRECACHE = [
  './',
  './index.html',
  './preop-procedures.js',
  './pwa-client.js',
  './pmk-alerts-copy.js',
  './pmk-login.js',
  './pmk-patient-print.js',
  './pmk-pid.js',
  './pmk-openheart.js',
  './pmk-tb.js',
  './images/pid/onepage-hiv-peds.jpg',
  './images/pid/onepage-tb-peds.jpg',
  './images/pid/onepage-oi-peds-1.jpg',
  './images/pid/onepage-oi-peds-2.jpg',
  './pmk-tailwind.css',
  './pmk-ui.css',
  './fonts/ibm-plex-sans-thai/latin-400-normal.woff2',
  './fonts/ibm-plex-sans-thai/latin-500-normal.woff2',
  './fonts/ibm-plex-sans-thai/latin-600-normal.woff2',
  './fonts/ibm-plex-sans-thai/latin-700-normal.woff2',
  './fonts/ibm-plex-sans-thai/thai-400-normal.woff2',
  './fonts/ibm-plex-sans-thai/thai-500-normal.woff2',
  './fonts/ibm-plex-sans-thai/thai-600-normal.woff2',
  './fonts/ibm-plex-sans-thai/thai-700-normal.woff2',
  './fonts/prompt/latin-300-normal.woff2',
  './fonts/prompt/latin-400-normal.woff2',
  './fonts/prompt/latin-500-normal.woff2',
  './fonts/prompt/latin-600-normal.woff2',
  './fonts/prompt/thai-300-normal.woff2',
  './fonts/prompt/thai-400-normal.woff2',
  './fonts/prompt/thai-500-normal.woff2',
  './fonts/prompt/thai-600-normal.woff2',
  './fonts/sarabun/latin-300-normal.woff2',
  './fonts/sarabun/latin-400-normal.woff2',
  './fonts/sarabun/latin-600-normal.woff2',
  './fonts/sarabun/latin-700-normal.woff2',
  './fonts/sarabun/thai-300-normal.woff2',
  './fonts/sarabun/thai-400-normal.woff2',
  './fonts/sarabun/thai-600-normal.woff2',
  './fonts/sarabun/thai-700-normal.woff2',
  './manifest.webmanifest',
  './favicon.ico',
  './apple-touch-icon.png',
  './icon_16x16.png',
  './icon_32x32.png',
  './icon_48x48.png',
  './icon_64x64.png',
  './icon_128x128.png',
  './icon_192x192.png',
  './icon_192x192_maskable.png',
  './icon_256x256.png',
  './icon_512x512.png',
  './icon_512x512_maskable.png',
  './rcri.png',
  './ref_antiplatelet.png',
  './ref_doac.png',
  './ref_warfarin.jpg',
  './risk.png',
  './table_bleeding_risk.png',
  './thrombotic_risk.jpg',
  './timeline.png',
  './images/parkinson/Bromocriptine.jpg',
  './images/parkinson/Comtan.jpg',
  './images/parkinson/Levopar.jpg',
  './images/parkinson/Madopar-dispersible.jpg',
  './images/parkinson/MadoparHBS.jpg',
  './images/parkinson/P-Bromocriptine.jpg',
  './images/parkinson/P-Comtan.jpg',
  './images/parkinson/P-Levopar.jpg',
  './images/parkinson/P-Madopar-dispersible.jpg',
  './images/parkinson/P-MadoparHBS.jpg',
  './images/parkinson/P-Rasagiline.jpg',
  './images/parkinson/Rasagiline.jpg',
  './images/parkinson/Sinemet.jpg',
  './images/parkinson/Trihexyphenidyl.jpg'
];

const CDN_PRECACHE = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

function isAppsScript(url) {
  const h = url.hostname;
  return h === 'script.google.com' || h.endsWith('.google.com') && url.pathname.includes('/macros/');
}

function isCdn(url) {
  const h = url.hostname;
  return (
    h === 'cdn.tailwindcss.com' ||
    h === 'cdn.jsdelivr.net' ||
    h === 'cdnjs.cloudflare.com' ||
    h === 'fonts.googleapis.com' ||
    h === 'fonts.gstatic.com'
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(PRECACHE);
    const cdn = await caches.open(CDN_CACHE);
    await Promise.allSettled(CDN_PRECACHE.map((u) =>
      fetch(u, { mode: 'cors', credentials: 'omit', cache: 'reload' })
        .then((res) => {
          if (isCacheableResponse(res, u)) return cdn.put(u, res);
        })
        .catch(() => null)
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== CACHE_VERSION && k !== CDN_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'PMK_SW_ACTIVATED', version: CACHE_VERSION }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match('./index.html') || await cache.match('./');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(request, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (res && res.ok) {
      cache.put(request.mode === 'navigate' ? './index.html' : request, res.clone());
    }
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

function isCacheableResponse(res, url) {
  if (!res) return false;
  if (res.type === 'opaque') return true;
  if (!res.ok) return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const u = String(url);
  const looksJs = /\.js(\?|$)/.test(u) || u.includes('cdn.tailwindcss.com') || u.includes('/npm/chart.js');
  if (looksJs) return ct.includes('javascript') || ct.includes('ecmascript');
  const looksCss = u.includes('.css') || u.includes('fonts.googleapis.com');
  if (looksCss) return ct.includes('css') || ct.includes('font');
  return !ct.includes('text/html');
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  const usable = cached && !((cached.headers.get('content-type') || '').toLowerCase().includes('text/html') && (request.destination === 'script' || String(request.url).includes('tailwind')));
  const network = fetch(request).then((res) => {
    if (isCacheableResponse(res, request.url)) cache.put(request, res.clone());
    return res;
  }).catch(() => (usable ? cached : Promise.reject(new Error('offline'))));
  return usable ? cached : network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isAppsScript(url)) return;
  // Tailwind Play CDN often returns HTML; offline styles come from pmk-tailwind.css
  if (url.hostname === 'cdn.tailwindcss.com') return;

  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' || /\/pmk-pwa\/?$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isCdn(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
