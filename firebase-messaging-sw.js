importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB8mh6id_uXg4Xa0ldviRN6qokO1nSyu4g",
  authDomain: "studytracker-99caa.firebaseapp.com",
  projectId: "studytracker-99caa",
  storageBucket: "studytracker-99caa.firebasestorage.app",
  messagingSenderId: "930702749372",
  appId: "1:930702749372:web:e930cd84e5aeb3b7852ab9",
  measurementId: "G-37BPKV2J3B"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/assets/icon.png"
  });
});