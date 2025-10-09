import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check"; 

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

if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    // You must use ReCaptchaEnterpriseProvider for the highest security level
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY as string
    ),
    is
  });
}

// Export the instances of the services for the rest of your app to use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const appCheck = getAppCheck(app);
