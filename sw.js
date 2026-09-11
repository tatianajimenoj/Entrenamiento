/* Service worker de la guía de entrenamiento.
   Sube la versión (v1 -> v2 -> ...) cada vez que cambies index.html,
   así el teléfono descarga la versión nueva en lugar de la guardada. */

const VERSION   = 'entreno-v2';
const SHELL     = VERSION + '-shell';
const RUNTIME   = VERSION + '-runtime';

/* Lo que se descarga al instalar: la app en sí. */
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* Borra las cachés de versiones anteriores. */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const esPropio  = url.origin === self.location.origin;
  const esFuente  = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const esMiniatura = /(^|\.)(img|i)\.ytimg\.com$/.test(url.hostname)
                   || url.hostname === 'img.youtube.com';

  /* La app: primero la red, y si no hay señal, lo guardado.
     Así al abrirla con internet siempre ves la versión más reciente. */
  if (esPropio) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(SHELL).then(c => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* Fuentes y miniaturas de YouTube: primero lo guardado (son fijas),
     y se descargan la primera vez que las ves con conexión. */
  if (esFuente || esMiniatura) {
    event.respondWith(
      caches.match(req).then(guardado => {
        if (guardado) return guardado;
        return fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') {
            const copia = res.clone();
            caches.open(RUNTIME).then(c => c.put(req, copia));
          }
          return res;
        }).catch(() => guardado);
      })
    );
  }

  /* Cualquier otra cosa (los videos de YouTube) va directo a la red. */
});
