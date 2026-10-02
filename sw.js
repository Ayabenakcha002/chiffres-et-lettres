// Service worker : permet de jouer hors ligne une fois le jeu chargé.
// Incrémenter VERSION à chaque modification des fichiers pour invalider le cache.
const VERSION = 'v1';
const CACHE = `chiffres-et-lettres-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'assets/icon.svg', 'css/style.css',
  'js/main.js', 'js/letters.js', 'js/numbers.js', 'js/dictionary.js', 'js/sound.js', 'js/storage.js',
  'data/words.txt',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réseau d'abord (toujours à jour), cache en secours (hors ligne).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
