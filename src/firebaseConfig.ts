import { initializeApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth"; // <-- Import Auth type
import { initializeFirestore, Firestore } from "firebase/firestore"; // <-- Import Firestore type
import { getFunctions, FirebaseFunctions } from "firebase/functions"; // <-- Import FirebaseFunctions type

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// FIX 1: Declare exported services using 'let' so they can be re-assigned.
export let auth: Auth = getAuth(app);
export let functions: FirebaseFunctions = getFunctions(app); 
export let db: Firestore; // Declare db, initialize later

// Connect to emulators using permanent Cloudflare Tunnels in development
if (import.meta.env.DEV) {
  // --- Permanent Tunnel URLs for projectgrid.tech ---
  const authTunnelUrl = "https://auth.projectgrid.tech";
  const functionsTunnelUrl = "https://functions.projectgrid.tech";
  const firestoreTunnelHostname = "firestore.projectgrid.tech";

  // 1. Auth Emulator: Re-configures the existing 'auth' object
  connectAuthEmulator(auth, authTunnelUrl, { disableWarnings: true });

  // FIX 2: Re-initialize 'functions' for the DEV environment, passing the custom domain.
  functions = getFunctions(app, { customDomain: functionsTunnelUrl }); 

  // 3. Firestore Emulator: Initialize 'db' for DEV (only runs here)
  db = initializeFirestore(app, {
    host: firestoreTunnelHostname,
    port: 443,
    ssl: true, 
  });

} else {
  // For production, initialize db normally (only runs here)
  db = initializeFirestore(app, {});
  // functions and auth remain as their default initializations.
}