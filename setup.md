Setup for Remote/Mobile Demo (IMPORTANT)

For the Cloudflare link to work correctly on other devices (like a phone), you must update the Firebase configuration to use your computer's local network IP address. This needs to be checked each time you start a new demo session, as your IP address can change.

Find Your Local IP Address:
Open PowerShell and run ipconfig. Look for the "IPv4 Address" under your main network connection (it usually starts with 192.168.x.x).

Update the Firebase Config:
Open the file src/firebaseConfig.ts. Find the emulatorHost variable and replace its value with the IP address you just found.

// src/firebaseConfig.ts

if (import.meta.env.DEV) {
  // Replace this IP with the one from ipconfig
  const emulatorHost = "192.168.1.123"; 

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`);
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5003);
}


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