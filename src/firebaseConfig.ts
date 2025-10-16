import { initializeApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth"; // <-- Import Auth type
import { initializeFirestore, Firestore, connectFirestoreEmulator } from "firebase/firestore"; // <-- Import Firestore type and connectFirestoreEmulator
import { getFunctions, FirebaseFunctions, connectFunctionsEmulator } from "firebase/functions"; // <-- Import FirebaseFunctions type and connectFunctionsEmulator

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
  // We use local emulator ports for connections, and rely on Cloudflare to proxy the hostname traffic back to localhost.

  // 1. Auth Emulator: Use standard local setup.
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

  // 2. Functions Emulator: Connect to local port (5003).
  connectFunctionsEmulator(functions, "localhost", 5003); 

  // 3. Firestore Emulator: Initialize first, then connect to the local port,
  //    and force long-polling to prevent proxying issues with WebChannels.
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
  connectFirestoreEmulator(db, "localhost", 8080);
  
} else {
  // For production, initialize db normally (only runs here)
  db = initializeFirestore(app, {});
  // functions and auth remain as their default initializations.
}