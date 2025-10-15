import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // Import connectAuthEmulator
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"; // Import connectFirestoreEmulator
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"; // Import connectFunctionsEmulator

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase ONCE
const app = initializeApp(firebaseConfig);

// Export the instances of the services for the rest of your app to use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// ADD THIS SECTION TO CONNECT TO EMULATORS
if (import.meta.env.DEV) {
  // Replace with your actual local network IP
  const emulatorHost = "192.168.4.58"; 

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`);
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5003);
}