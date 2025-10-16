import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
// UPDATE: Import initializeFirestore instead of getFirestore directly for this block
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore"; 
import { getFunctions } from "firebase/functions";

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

// Export the instances of the services
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Initialize db here but it will be reassigned in the DEV block
export let db = initializeFirestore(app, {});

// Connect to emulators using permanent Cloudflare Tunnels in development
if (import.meta.env.DEV) {
  // --- Permanent Tunnel URLs for projectgrid.tech ---
  const authTunnelUrl = "https://auth.projectgrid.tech";
  const functionsTunnelUrl = "https://functions.projectgrid.tech";
  const firestoreTunnelHostname = "firestore.projectgrid.tech";

  // 1. Auth Emulator (uses a full URL)
  connectAuthEmulator(auth, authTunnelUrl, { disableWarnings: true });

  // 2. Functions Emulator (set customDomain to the full URL)
  functions.customDomain = functionsTunnelUrl;

  // 3. Firestore Emulator (Explicitly set SSL to true)
  db = initializeFirestore(app, {
    host: firestoreTunnelHostname,
    port: 443,
    ssl: true, // This is the critical line that forces HTTPS
  });

} else {
  // For production, initialize Firestore normally
  db = initializeFirestore(app, {});
}