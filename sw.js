/* Service worker : le site reste utilisable sans réseau.
   Les pages sont servies « réseau d'abord » pour recevoir les mises à jour,
   avec repli sur le cache ; les ressources statiques sont servies « cache
   d'abord ». Les données de révision, elles, vivent dans localStorage et ne
   passent jamais par ici. */

/* Le nom du cache est tamponné à chaque déploiement par le workflow GitHub
   Pages, qui remplace __BUILD__ par l'empreinte du commit. Sans ça, un cache au
   nom fixe servirait indéfiniment l'ancien JavaScript : les ressources sont
   servies « cache d'abord » pour la vitesse et le hors connexion. En local, le
   marqueur reste tel quel, ce qui donne un cache stable pendant le développement. */
var VERSION = 'edn-__BUILD__';
var COQUILLE = [
  './',
  './index.html',
  './items.html',
  './repartition.html',
  './specialites.html',
  './stats.html',
  './planning.html',
  './fiches.html',
  './sync.html',
  './fiche-ecg.html',
  './fiche-examen-clinique.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/items.js',
  './assets/js/store.js',
  './assets/js/ui.js',
  './assets/js/sync.js',
  './assets/js/page-sync.js',
  './assets/js/page-items.js',
  './assets/js/page-repartition.js',
  './assets/js/page-specialites.js',
  './assets/js/page-stats.js',
  './assets/js/page-planning.js',
  './assets/icone.svg',
  './assets/icone-192.png',
  './assets/icone-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(VERSION)
      // addAll échoue en bloc si une seule requête échoue : on met en cache
      // fichier par fichier pour qu'une ressource absente ne casse pas tout.
      .then(function (cache) {
        return Promise.all(COQUILLE.map(function (url) {
          return cache.add(url).catch(function () { /* ressource ignorée */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys()
      .then(function (cles) {
        return Promise.all(cles.map(function (c) {
          return c === VERSION ? null : caches.delete(c);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (ev) {
  if (ev.data === 'skipWaiting') self.skipWaiting();
});

function estPage(requete) {
  return requete.mode === 'navigate' ||
    (requete.headers.get('accept') || '').indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  var memeOrigine = url.origin === self.location.origin;

  // Autre domaine (la police distante) : on laisse faire le navigateur. En cas
  // d'échec il retombe sur la pile de polices système, ce qui ne casse rien —
  // alors qu'une réponse d'erreur fabriquée ici polluerait la console.
  if (!memeOrigine) return;

  if (estPage(req)) {
    ev.respondWith(
      fetch(req)
        .then(function (rep) {
          var copie = rep.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copie); });
          return rep;
        })
        .catch(function () {
          // ignoreSearch : items.html?item=231 doit retomber sur items.html
          return caches.match(req, { ignoreSearch: true }).then(function (hit) {
            return hit || caches.match('./items.html');
          });
        })
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (rep) {
        if (rep && rep.ok && rep.type === 'basic') {
          var copie = rep.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copie); });
        }
        return rep;
      });
    })
  );
});
