// Firebase Configuration - Classarium SaaS Platform
const firebaseConfig = {
    apiKey: "AIzaSyBxnfxEw__3WptO44bWVzhenUVGc26wkG0",
    authDomain: "learnlynk1.firebaseapp.com",
    projectId: "learnlynk1",
    storageBucket: "learnlynk1.firebasestorage.app",
    messagingSenderId: "507980129773",
    appId: "1:507980129773:web:06532e31b0a7dbf6e173e4"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistence not available in this browser');
    }
});

// Auth state persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Firestore field value helpers
const FieldValue = firebase.firestore.FieldValue;
const Timestamp = firebase.firestore.Timestamp;
