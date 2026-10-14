// Serve solo perché Android permetta di installare Axend come app. Non salva niente in memoria:
// ogni richiesta va sempre in rete, così si gioca sempre con l'ultima versione.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
