Setup for Remote/Mobile Demo (IMPORTANT)

For the Cloudflare link to work correctly on other devices (like a phone), you must make both the Vite server and the Firebase Auth Emulator accessible via public URLs.

One-Time Firewall Setup

If you haven't already, you must create firewall rules to allow local network access to your emulators. Run PowerShell as an Administrator and execute each of these commands once:

New-NetFirewallRule -DisplayName "Firebase Auth Emulator" -Direction Inbound -Protocol TCP -LocalPort 9099 -Action Allow
New-NetFirewallRule -DisplayName "Firebase Firestore Emulator" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
New-NetFirewallRule -DisplayName "Firebase Functions Emulator" -Direction Inbound -Protocol TCP -LocalPort 5003 -Action Allow
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow


Per-Session Demo Setup

This needs to be done each time you start a new demo session, as your IP address and tunnel URLs can change.

Find Your Local IP Address:
Open PowerShell and run ipconfig. Find the "IPv4 Address" under your main network connection (it usually starts with 192.168.x.x).

Run Terminals (4 total):
You will need to open four separate PowerShell terminals.

Terminal 1: Start Firebase Emulators

cd C:\code2\newsouthindex
firebase emulators:start


Terminal 2: Start the Vite Frontend Server

cd C:\code2\newsouthindex
npm run dev


Terminal 3: Start Cloudflare Tunnel for Vite
This exposes your web app to the internet.

cd C:\codetools
.\cloudflared.exe tunnel --url http://localhost:3000


Note the .trycloudflare.com URL it gives you. This is your main app link.

Terminal 4: Start Cloudflare Tunnel for Auth Emulator
This gives the authentication service a public URL to solve the Google Sign-In issue. Use the IP address you found in step 1.

cd C:\codetools
.\cloudflared.exe tunnel --url http://192.168.4.58:9099


Note the different .trycloudflare.com URL this terminal provides.

Update the Firebase Config:
Open src/firebaseConfig.ts. You need to use both the public Auth Tunnel URL and your local IP address.

authHost should be the full URL from Terminal 4.

emulatorHost should be your local IP address from Step 1 for the other services.

// src/firebaseConfig.ts

if (import.meta.env.DEV) {
  // From ipconfig (for Firestore and Functions)
  const emulatorHost = "192.168.4.58"; 

  // From Terminal 4 (the Auth tunnel URL)
  const authHost = "https://your-auth-tunnel-name.trycloudflare.com";

  connectAuthEmulator(auth, authHost); // <-- Use public URL for Auth
  connectFirestoreEmulator(db, emulatorHost, 8080); // <-- Use local IP for others
  connectFunctionsEmulator(functions, emulatorHost, 5003); // <-- Use local IP for others
}


After completing these steps, restart your Vite and Emulator terminals, then try accessing the main app link (from Terminal 3) on your phone again. The Google Authentication should now complete successfully.