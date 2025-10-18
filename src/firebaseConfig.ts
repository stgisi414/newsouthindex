import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  Auth, 
  connectAuthEmulator 
} from "firebase/auth";
import { 
  initializeFirestore, 
  Firestore, 
  connectFirestoreEmulator 
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
// We initialize them inside the conditional blocks
export let auth: Auth;
export let functions: FirebaseFunctions;
export let db: Firestore;

if (import.meta.env.DEV) {
  console.log(`[firebaseConfig] Development mode detected. isTunnel: ${isTunnel}`);

  // --- Use tunnel domains OR localhost for Auth/Firestore ---
  // --- Use Vite Proxy for Functions ---

  // 1. Auth: Connect to tunnel URL or localhost:9099
  auth = getAuth(app);
  const devAuthDomain = currentPort ? `${currentHost}:${currentPort}` : currentHost;
  effectiveFirebaseConfig.authDomain = devAuthDomain;
  console.log(`[firebaseConfig] Overriding authDomain for popups: ${devAuthDomain}`);
  const authHost = isTunnel ? 'auth.projectgrid.tech' : 'localhost';
  const authProtocol = isTunnel ? 'https' : 'http';
  const authPort = isTunnel ? '' : ':9099';
  const authUrl = `${authProtocol}://${authHost}${authPort}`;
  console.log(`[firebaseConfig] Auth Emulator: ${authUrl}`);
  connectAuthEmulator(auth, authUrl, { disableWarnings: true });

  // 2. Functions: Connect via the NEW Vite Proxy path
  functions = getFunctions(app); // Get default instance
  // Connect to the host/port where Vite is running.
  // The function calls made by the SDK will be intercepted by the '/__/firebase_functions_proxy' rule in vite.config.ts
  const viteHost = isTunnel ? 'app.projectgrid.tech' : 'localhost';
  const vitePort = isTunnel ? 443 : 3000;
  console.log(`[firebaseConfig] Functions Emulator: Connecting via Vite proxy (Targeting Vite at ${viteHost}:${vitePort}, expecting calls to be proxied from /__/firebase_functions_proxy)`);
  // NOTE: We connect to Vite itself. The SDK needs to make calls relative to this origin
  // e.g., calling processCommand should result in a request to
  // https://app.projectgrid.tech/__/firebase_functions_proxy/yourProjectId/us-central1/processCommand
  // OR http://localhost:3000/__/firebase_functions_proxy/yourProjectId/us-central1/processCommand
  connectFunctionsEmulator(functions, viteHost, vitePort);
  // It's crucial that the Firebase SDK correctly formats the URL path
  // to include the region/function name relative to the viteHost:vitePort base.


  // 3. Firestore: Connect to tunnel URL or localhost:8080 (using IP in tunnel config)
  db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
  });
  const firestoreHost = isTunnel ? 'firestore.projectgrid.tech' : 'localhost';
  const firestorePort = isTunnel ? 443 : 8080;
  console.log(`[firebaseConfig] Firestore Emulator: ${firestoreHost}:${firestorePort}`);
  connectFirestoreEmulator(db, firestoreHost, firestorePort);

} else {
  // --- PRODUCTION CONFIGURATION ---
  console.log("[firebaseConfig] Production mode detected.");
  auth = getAuth(app);
  functions = getFunctions(app);
  db = initializeFirestore(app, {});
}