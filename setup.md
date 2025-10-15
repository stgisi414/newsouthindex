Running the Development Environment

You will need to open three separate PowerShell terminals.

Terminal 1: Start Firebase Emulators

This terminal will run the local backend, including the database, authentication, and cloud functions.

Navigate to the project root directory:

cd C:\code2\newsouthindex


Start the Firebase Emulators:

firebase emulators:start


Keep this terminal running.

Terminal 2: Start the Vite Frontend Server

This terminal will compile and serve the React application, which will automatically reload when you make code changes.

Navigate to the project root directory:

cd C:\code2\newsouthindex


Start the Vite development server:

npm run dev


This will make the application available locally at http://localhost:3000. Keep this terminal running.

Terminal 3: Start Cloudflare Tunnel for Live Demo

This terminal creates a secure, public URL that tunnels to your local Vite server, allowing for a clean, warning-free demo.

Navigate to the directory where you saved the Cloudflare executable:

cd C:\codetools


Start the tunnel:

.\cloudflared.exe tunnel --url http://localhost:3000


The output will provide a URL ending in .trycloudflare.com. This is your live, shareable demo link. Keep this terminal running for the duration of the demo.