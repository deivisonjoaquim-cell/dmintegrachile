/* eslint-disable no-undef */
// Service Worker oficial do Firebase Cloud Messaging — D&M Integra Chile
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD8PSMiA6NOnUWVtWqzJ94XDyqhlZcw_5w',
  authDomain: 'gen-lang-client-0947959506.firebaseapp.com',
  projectId: 'gen-lang-client-0947959506',
  storageBucket: 'gen-lang-client-0947959506.firebasestorage.app',
  messagingSenderId: '1076872213311',
  appId: '1:1076872213311:web:07abae77b1858f0646198a',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload && payload.data ? payload.data : {};
  const notif = payload && payload.notification ? payload.notification : {};
  const title = notif.title || data.title || 'Atualização do Processo — D&M Integra Chile';
  const body =
    notif.body ||
    data.body ||
    'Há uma nova atualização no andamento do seu processo de imigração no Chile.';
  const targetUrl = data.url || '/portal';

  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.notificationId || data.caseId || 'dm-integra-processo',
    renotify: true,
    data: {
      url: targetUrl,
      tipo: data.tipo || 'geral',
      caseId: data.caseId || '',
      notificationId: data.notificationId || '',
    },
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || '/portal';
  const absoluteTarget = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && client.url !== absoluteTarget) {
            return client
              .navigate(absoluteTarget)
              .then(() => client.focus())
              .catch(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTarget);
      }
      return undefined;
    }),
  );
});
