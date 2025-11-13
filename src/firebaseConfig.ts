import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  Auth, 
  connectAuthEmulator 
} from "firebase/auth";
import { 
  getFirestore, // <-- CHANGED
  Firestore, 
  connectFirestoreEmulator,
  initializeFirestore // <-- We still need this for your tunnel logic
} from "firebase/firestore";
import { 
  getFunctions, 
  FirebaseFunctions, 
  connectFunctionsEmulator 
} from "firebase/functions";

// Determine if running through the tunnel by checking the hostname *before* config
const isTunnel = window.location.hostname === 'app.projectgrid.tech';
const currentHost = window.location.hostname;
const currentPort = window.location.port;

// Your web app's Firebase configuration using environment variables
const baseFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Create a mutable config object
let effectiveFirebaseConfig = { ...baseFirebaseConfig };

// If in development mode, override authDomain to match the *current* host the app is served from
// This is critical for the Auth popup to work correctly.
if (import.meta.env.DEV) {
  const devAuthDomain = currentPort ? `${currentHost}:${currentPort}` : currentHost;
  effectiveFirebaseConfig.authDomain = devAuthDomain;
  console.log(`[firebaseConfig] DEV MODE: Overriding authDomain to: ${devAuthDomain}`);
}

const app = initializeApp(effectiveFirebaseConfig);

// --- DECLARE EXPORTED SERVICES ---
// We initialize them once, then conditionally connect emulators
export let auth: Auth = getAuth(app);
export let functions: FirebaseFunctions = getFunctions(app, 'us-central1'); // Specify region
export let db: Firestore = getFirestore(app); // <-- INITIALIZE ONCE

if (import.meta.env.DEV) {
  console.log(`[firebaseConfig] Development mode detected. isTunnel: ${isTunnel}`);

  // 1. Auth: (Your logic is correct)
  const devAuthDomain = currentPort ? `${currentHost}:${currentPort}` : currentHost;
  effectiveFirebaseConfig.authDomain = devAuthDomain;
  console.log(`[firebaseConfig] Overriding authDomain for popups: ${devAuthDomain}`);
  const authHost = isTunnel ? 'auth.projectgrid.tech' : 'localhost';
  const authProtocol = isTunnel ? 'https' : 'http';
  const authPort = isTunnel ? '' : ':9099';
  const authUrl = `${authProtocol}://${authHost}${authPort}`;
  console.log(`[firebaseConfig] Auth Emulator: ${authUrl}`);
  connectAuthEmulator(auth, authUrl, { disableWarnings: true });

  // 2. Functions: (Your logic is correct)
  if (isTunnel) {
      console.log('[firebaseConfig] Functions: Using customDomain for HTTPS tunnel (app.projectgrid.tech)');
      functions.customDomain = "https://app.projectgrid.tech";
  } else {
      console.log('[firebaseConfig] Functions Emulator: Connecting via localhost:5003');
      connectFunctionsEmulator(functions, 'localhost', 5003);
  }

  // 3. Firestore: --- THIS IS THE FIX ---
  if (isTunnel) {
    // Your tunnel logic requires re-initializing with specific settings
    const firestoreHost = 'firestore.projectgrid.tech';
    const firestorePort = 443;
    const useSsl = true;
    console.log(`[firebaseConfig] Re-initializing Firestore DIRECTLY for TUNNEL: host=${firestoreHost}, port=${firestorePort}, ssl=${useSsl}`);
    db = initializeFirestore(app, {
      host: `${firestoreHost}:${firestorePort}`,
      ssl: useSsl,
    });
    console.log('[firebaseConfig] Firestore initialized directly for TUNNEL.');
  } else {
    // Localhost: 'db' is already initialized, just connect it.
    // This is the V9 SDK-compatible way.
    console.log('[firebaseConfig] Connecting to Firestore Emulator on localhost:8081');
    connectFirestoreEmulator(db, 'localhost', 8081);
  }
  // --- END FIX ---

} else {
  // --- PRODUCTION CONFIGURATION ---
  console.log("[firebaseConfig] Production mode detected.");
  // All services (auth, functions, db) were already initialized 
  // above and are pointing to production. No extra work needed.
  console.log("[firebaseConfig] auth, functions, and db are using production endpoints.");
}