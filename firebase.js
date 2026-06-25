window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyBRoyT2ogH-9jvhCWEEhd46pa0J98CSUlM",
    authDomain: "kyoya-pro.firebaseapp.com",
    projectId: "kyoya-pro",
    storageBucket: "kyoya-pro.firebasestorage.app",
    messagingSenderId: "964390632463",
    appId: "1:964390632463:web:3a350c36c0ec915c8e777a",
};

if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
}

window.firebaseDb = typeof firebase !== "undefined" ? firebase.firestore() : null;
