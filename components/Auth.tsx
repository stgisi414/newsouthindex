import { useState, FormEvent } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../src/firebaseConfig";
import { UserRole } from "../types";

const ensureUserDocument = async (user: User) => {
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      email: user.email,
      role: UserRole.APPLICANT,
      isAdmin: false,
      createdDate: serverTimestamp(),
    });
  }
};

export const Auth = () => {
  /* --- These are for email/password, safe to comment --- */
  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  /* --- End email/password state --- */

  // --- These are needed for Google Sign-In, so UNCOMMENT them ---
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider();
  // --- End required variables ---

  /* --- Email/password functions, safe to comment --- */
  //  const handleSignUp = async (e: FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   try {
  //     const result = await createUserWithEmailAndPassword(auth, email, password);
  //     await ensureUserDocument(result.user);
  //   } catch (err: any) {
  //     setError("Invalid email or password. Please check your credentials.");
  //     console.error("Sign up error:", err);
  //   }
  // };

  // const handleLogin = async (e: FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   try {
  //     await signInWithEmailAndPassword(auth, email, password);
  //   } catch (err: any) {
  //     setError("Invalid email or password. Please check your credentials.");
  //     console.error("Login error:", err);
  //   }
  // };
  /* --- End email/password functions --- */

  // This function is for Google Sign-In and needs the variables above
  const handleGoogleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); // Needs setError
    try {
      const result = await signInWithPopup(auth, googleProvider); // Needs auth and googleProvider
      await ensureUserDocument(result.user);
    } catch (err: any) {
      setError(err.message || "An error occurred during Google sign-in."); // Needs setError
      console.error("Google Sign-In error:", err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="flex items-center justify-center gap-4 border-b pb-4">
          <img src="/newsouthbookslogo.jpg" alt="New South Books Logo" className="h-12 w-auto" />
          <h2 className="text-2xl font-bold text-gray-900">
            New South Index
          </h2>
        </div>
        <div className="text-center text-gray-600">
          <p>
            Welcome! This is a private contact management tool for New South Books.
          </p>
          <p className="mt-2 text-sm">
            Please sign in to continue.
          </p>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>This is a private system for authorized New South Bookstore staff only.</strong>
              <br />
              Do not attempt to log in if you are not an employee.
            </p>
          </div>
        </div>
        
        {/* --- Email/Password Form Commented Out --- */}
        <form className="space-y-6">
          {/*
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          */}

          {error && <p className="text-sm text-center text-red-600">{error}</p>}
          
          <div className="pt-2 space-y-4">
            {/*
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleLogin}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                className="w-full px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Sign Up
              </button>
            </div>
            */}

            {/* --- This is the Google Sign-In button, which should remain --- */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <img className="w-5 h-5 mr-2" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1024px-Google_%22G%22_logo.svg.png" alt="Google logo" />
              Sign in with Google
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};