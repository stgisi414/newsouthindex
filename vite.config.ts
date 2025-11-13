import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // Assuming you might have meant @vitejs/plugin-react instead of @vitejs/plugin-react-swc based on your pasted config
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

const localIp = '192.168.4.58';
const projectId = 'nsindxonline'; // <== Make sure this is your Firebase project ID
const functionsEmulatorPort = 5003; // <== Make sure this is the port your Functions emulator runs on (check firebase.json or startup logs)

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
        // Match specific function names at the root path
        '^/(processCommand|seedDatabase|setUserRole|deleteUser|makeMeAdmin)': { // <== CHANGED: Match function names directly
          target: `http://${localIp}:${functionsEmulatorPort}`, // Target the LOCAL emulator
          changeOrigin: true, // Important for Cloudflare tunnel/virtual hosts

          // *** ADD THIS REWRITE RULE ***
          // Prepend the path expected by the emulator
          rewrite: (path) => `/${projectId}/us-central1${path}`,

          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Updated log to show rewritten path
              console.log(`[Vite Proxy] Functions: REWRITTEN ${req.method} ${req.url} to ${options.target}${proxyReq.path}`);
            });
            proxy.on('error', (err, req, res) => {
              console.error('[Vite Proxy] Functions Error:', err);
            });
          }
        },
        // You could add proxies for Auth/Firestore here too if needed, but let's focus on Functions first
        // '/__/firebase_auth_proxy': { target: `http://${localIp}:9099`, ... },
        // '/__/firebase_firestore_proxy': { target: `http://${localIp}:8081`, ... },
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
             name: 'NewSouth Index',
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
      'process.env.VITE_MEASUREMENT_ID': JSON.stringify(env.VITE_MEASUREMENT_ID),
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