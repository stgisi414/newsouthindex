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

  // 2. Functions
  functions = getFunctions(app, 'us-central1'); // Specify region

  if (isTunnel) {
     console.log('[firebaseConfig] Functions: Using customDomain for HTTPS tunnel (app.projectgrid.tech)');
     // SDK will append /projectId/region/functionName to this:
     functions.customDomain = "https://app.projectgrid.tech";
  } else {
     // Localhost: Connect directly to the emulator port
     console.log('[firebaseConfig] Functions Emulator: Connecting via localhost:5003');
     connectFunctionsEmulator(functions, 'localhost', 5003); // Use correct emulator port
  }

  // 3. Firestore: Connect to tunnel URL or localhost:8080
  const firestoreHost = isTunnel ? 'firestore.projectgrid.tech' : 'localhost';
  const firestorePort = isTunnel ? 443 : 8080;
  const useSsl = isTunnel;

  console.log(`[firebaseConfig] Initializing Firestore DIRECTLY: host=${firestoreHost}, port=${firestorePort}, ssl=${useSsl}`);

  db = initializeFirestore(app, {
    host: `${firestoreHost}:${firestorePort}`,
    ssl: useSsl,
    // experimentalForceLongPolling: true, // Ensure this is removed or commented out
  });
  console.log('[firebaseConfig] Firestore initialized directly. connectFirestoreEmulator NOT called.');
  // [END] FIRESTORE - DIRECT INITIALIZATION, NO LONG POLLING

} else {
  // --- PRODUCTION CONFIGURATION ---
  console.log("[firebaseConfig] Production mode detected.");
  auth = getAuth(app);
  functions = getFunctions(app); // Consider specifying region
  db = initializeFirestore(app, {});
}