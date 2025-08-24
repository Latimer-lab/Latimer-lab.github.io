// Initialize Firebase using compat SDK and expose Firestore as window.db
(function initFirebaseCompat() {
    if (window.firebaseInitialized) return;
    const firebaseConfig = window.__FIREBASE_CONFIG__ || {
        // Fallback for local development - you can add your local config here
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: "",
        measurementId: ""
    };
    function tryInit() {
        if (!window.firebase || !window.firebase.initializeApp) {
            // Retry shortly until Firebase compat is available
            setTimeout(tryInit, 50);
            return;
        }
        const app = window.firebase.initializeApp(firebaseConfig);
        const db = window.firebase.firestore(app);
        window.firebaseApp = app;
        window.db = db;
        window.firebaseInitialized = true;
    }
    tryInit();
})();


