// Firebase Configuration
// This file will be dynamically generated during deployment with GitHub Actions

// Check if we have the dynamic config from GitHub Actions
if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
  // Use the dynamically generated config from GitHub Actions
  const firebaseConfig = window.__FIREBASE_CONFIG__;
  
  // Initialize Firebase with the dynamic config
  if (typeof firebase !== 'undefined') {
    const app = firebase.initializeApp(firebaseConfig);
    const analytics = firebase.analytics();
    const db = firebase.firestore();
    
    // Export for use in other modules
    window.firebaseApp = app;
    window.firebaseAnalytics = analytics;
    window.firebaseDb = db;
  }
} else {
  // Fallback for local development - you can set these in your .env file
  console.warn('⚠️ Using fallback Firebase config. For production, ensure GitHub Actions generates the config.');
  
  // You can set these environment variables locally for development
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
    projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
    appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID"
  };
  
  // Initialize Firebase with fallback config
  if (typeof firebase !== 'undefined') {
    const app = firebase.initializeApp(firebaseConfig);
    const analytics = firebase.analytics();
    const db = firebase.firestore();
    
    // Export for use in other modules
    window.firebaseApp = app;
    window.firebaseAnalytics = analytics;
    window.firebaseDb = db;
  }
}

// Export a function to get the Firebase instance
export function getFirebaseApp() {
  return window.firebaseApp;
}

export function getFirebaseAnalytics() {
  return window.firebaseAnalytics;
}

export function getFirebaseDb() {
  return window.firebaseDb;
}
