import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
  // Load environment variables from the root of your project
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // VitePWA plugin configuration
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'New South Index',
          short_name: 'NSIndex',
          description: 'A simple contact management app for New South Books.',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
      }),
    ],
    css: {
      postcss: {
        plugins: [
          tailwindcss, 
          autoprefixer, 
        ],
      },
    },
    define: {
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'process.env.VITE_AUTH_DOMAIN': JSON.stringify(env.VITE_AUTH_DOMAIN),
      'process.env.VITE_PROJECT_ID': JSON.stringify(env.VITE_PROJECT_ID),
      'process.env.VITE_STORAGE_BUCKET': JSON.stringify(env.VITE_STORAGE_BUCKET),
      'process.env.VITE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_MESSAGING_SENDER_ID),
      'process.env.VITE_APP_ID': JSON.stringify(env.VITE_APP_ID),
      'process.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY),
    },
    resolve: {
      alias: {
        // Set up a path alias for easier imports
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});