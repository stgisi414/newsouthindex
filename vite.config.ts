import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // Assuming you might have meant @vitejs/plugin-react instead of @vitejs/plugin-react-swc based on your pasted config
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

// !!! IMPORTANT: Replace this placeholder with your computer's actual local IPv4 address !!!
const localIp = "YOUR_COMPUTER_IPV4_ADDRESS";
// Example: const localIp = "192.168.1.100";

if (!localIp || localIp === "YOUR_COMPUTER_IPV4_ADDRESS") {
    console.error("\n\nCRITICAL ERROR in vite.config.ts: You MUST set the 'localIp' variable to your computer's local IP address for the Functions emulator proxy to work.\n\n");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // --- YOUR SERVER CONFIG ---
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['app.projectgrid.tech'], // Keep this

      // --- ADD THE PROXY CONFIGURATION INSIDE server: {} ---
      proxy: {
        // Proxy requests intended for the *local Firebase Functions emulator*
        // Use a unique path prefix not used by your app.
        '/__/firebase_functions_proxy': {
          // Target the emulator using your computer's local IP address
          target: `http://${localIp}:5003`,
          changeOrigin: true, // Important for CORS and host header manipulation
          // Rewrite the path: Remove the proxy prefix before forwarding
          rewrite: (path) => path.replace(/^\/__\/firebase_functions_proxy/, ''),
          configure: (proxy, _options) => { // Optional: Add logging for debugging
             proxy.on('error', (err, _req, _res) => { console.log('>>> Vite Firebase Functions Proxy Error:', err); });
             proxy.on('proxyReq', (proxyReq, req, _res) => { console.log('>>> Vite Firebase Functions Proxy: Forwarding:', req.method, req.url, '->', `http://${localIp}:5003${proxyReq.path}`); });
             proxy.on('proxyRes', (proxyRes, req, _res) => { console.log('>>> Vite Firebase Functions Proxy: Response:', proxyRes.statusCode, req.url); });
          },
        },
        // You could add proxies for Auth/Firestore here too if needed, but let's focus on Functions first
        // '/__/firebase_auth_proxy': { target: `http://${localIp}:9099`, ... },
        // '/__/firebase_firestore_proxy': { target: `http://${localIp}:8080`, ... },
      }
      // --- END PROXY CONFIGURATION ---
    },
    // --- YOUR PLUGINS ---
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
        // Include your manifest details here if not linked separately
        manifest: {
             name: 'New South Index',
             short_name: 'NSIndex',
             // ... other manifest properties ...
        }
      }),
    ],
    // --- YOUR DEFINES ---
    define: {
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'process.env.VITE_AUTH_DOMAIN': JSON.stringify(env.VITE_AUTH_DOMAIN),
      'process.env.VITE_PROJECT_ID': JSON.stringify(env.VITE_PROJECT_ID),
      'process.env.VITE_STORAGE_BUCKET': JSON.stringify(env.VITE_STORAGE_BUCKET),
      'process.env.VITE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_MESSAGING_SENDER_ID),
      'process.env.VITE_APP_ID': JSON.stringify(env.VITE_APP_ID),
      'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
      // Add other defines from your previous config if needed
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY)
    },
    // --- YOUR RESOLVE/ALIAS ---
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // Corrected alias target
      },
    },
  };
});