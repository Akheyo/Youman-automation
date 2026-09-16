/*
 * Service Worker — bewusst minimal.
 *
 * Er macht genau eine Sache: die unveränderlichen Programmdateien unter
 * /_next/static/ zwischenspeichern. Die tragen einen Hash im Namen, können also
 * nie veralten. Alles andere geht ungefiltert ins Netz.
 *
 * WARUM SO WENIG: Ein Service Worker, der auch Seiten und Daten
 * zwischenspeichert, liefert früher oder später eine alte Version aus, und
 * niemand versteht warum. Der Zweck hier ist die Installierbarkeit vom
 * Startbildschirm und ein schneller Start — nicht Offline-Betrieb. Dass die
 * Fotos ein Funkloch überleben, macht die Warteschlange in IndexedDB
 * (lib/erfassung/warteschlange.ts), nicht dieser Worker.
 */

const CACHE = 'kk-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;

  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/_next/static/')) return;

  ereignis.respondWith(
    caches.match(anfrage).then(
      (treffer) =>
        treffer ||
        fetch(anfrage).then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE).then((c) => c.put(anfrage, kopie));
          }
          return antwort;
        }),
    ),
  );
});
