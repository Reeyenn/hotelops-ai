// Firebase Messaging Service Worker
// Handles background push notifications when the app is closed or in background

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCaZOj0pSfzzslK1CBv9DNBL0O2V7LWnVs',
  authDomain: 'hotelops-ai.firebaseapp.com',
  projectId: 'hotelops-ai',
  storageBucket: 'hotelops-ai.firebasestorage.app',
  messagingSenderId: '307553713414',
  appId: '1:307553713414:web:c2de3afcc4b4a9a11bb287',
});

const messaging = firebase.messaging();

// Handle background messages (app is closed or in background tab)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'room-assignment',        // replaces previous notification instead of stacking
    renotify: true,
    data: payload.data ?? {},
  });
});
