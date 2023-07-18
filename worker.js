/******
 * service worker stuff to cache map tiles
 ******/

self.addEventListener('install', function (event) {
  console.log('Installing Service Worker');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  if(url.startsWith('https://') && (url.includes('localhost') || url.includes("/map/v1/mtl/bike-lanes") || url.includes('bixi.jvns.ca') || url.includes('tiles.mapbox.com') || url.includes('api.mapbox.com'))) {
    event.respondWith(
      caches.match(event.request).then(function(resp) {
        if (resp) {
            console.log('Serving from cache: ', event.request.url);
        } else {
            console.log('Serving from net: ', event.request.url);
        }

        return resp || fetch(event.request).then(function(response) {
          const cacheResponse = response.clone();
          caches.open('mapbox').then(function(cache) {
            cache.put(event.request, cacheResponse);
          });
          return response;
        });
      })
    );
  }
});
