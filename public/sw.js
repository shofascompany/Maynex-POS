/* Maynex POS service worker: makes the app installable and lets it open offline.
   Strategy: network-first for the app itself (so updates show immediately),
   falling back to the last cached copy when offline. Fonts are cached on first use.
   Anything else (APIs, other sites) is passed straight through and never cached. */
const VERSION = 'maynex-pos-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isDevRequest(url) {
  // Vite dev-server internals and hot-update requests must never be served from cache
  return url.pathname.startsWith('/@') || url.searchParams.has('t')
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION)
  try {
    const res = await fetch(request)
    if (res.ok && res.type === 'basic') cache.put(request, res.clone())
    return res
  } catch {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (hit) return hit
    if (request.mode === 'navigate') return (await cache.match('/')) || (await cache.match('/index.html'))
    throw new Error('offline and not cached')
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION)
  const hit = await cache.match(request)
  const net = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone())
      return res
    })
    .catch(() => hit)
  return hit || net
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin === self.location.origin) {
    if (isDevRequest(url)) return
    event.respondWith(networkFirst(request))
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request))
  }
  // everything else: default browser handling, not cached
})
