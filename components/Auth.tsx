import { useState, FormEvent } from "react";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider, // ADDED: Import for Google Auth
  signInWithPopup // ADDED: Import for Google Auth
} from "firebase/auth";
import logo from '../public/newsouthbookslogo.jpg'; // ADDED: Import logo for consistent styling

// This is the actual React component that will be rendered.
export const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const auth = getAuth();
  const googleProvider = new GoogleAuthProvider(); // ADDED: Initialize Google Auth Provider

  // --- Event Handlers ---

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); 
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message); 
      console.error("Sign up error:", err);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      console.error("Login error:", err);
    }
  };
  
  // ADDED: New handler for Google Sign-In
  const handleGoogleSignIn = async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
          // You can optionally add a custom parameter for language, e.g., provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, googleProvider);
          // Firebase listener in App.tsx handles state change
      } catch (err: any) {
          // Handle specific errors like 'auth/popup-closed-by-user'
          setError(err.message || 'An error occurred during Google sign-in.');
          console.error("Google Sign-In error:", err);
      }
  };


  // --- JSX for the Form ---

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      {/* UPDATED: Added rounded-xl and shadow-lg for consistent card style */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg"> 
        {/* ADDED: App Header with Logo for consistent styling with Dashboard */}
        <div className="flex items-center justify-center gap-4 border-b pb-4">
            <img src={logo} alt="New South Books Logo" className="h-12 w-auto" />
            <h2 className="text-2xl font-bold text-gray-900">
              New South Index
            </h2>
        </div>
        
        <form className="space-y-6">
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

          {error && <p className="text-sm text-center text-red-600">{error}</p>}
          
          {/* UPDATED: Wrapped buttons in a div for better layout control */}
          <div className="pt-2 space-y-4"> 
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
            
            {/* ADDED: New Google Sign-In Button */}
            <button
              type="button" 
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
                {/* A simple placeholder for the Google icon */}
                <img className="w-5 h-5 mr-2" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1024px-Google_%22G%22_logo.svg.png" alt="Google logo"/>
                Sign in with Google
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};