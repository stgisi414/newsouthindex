Terminal 1: Start Firebase Emulators

PowerShell

cd C:\code2\newsouthindex
firebase emulators:start
Terminal 2: Start the Vite Frontend Server

PowerShell

cd C:\code2\newsouthindex
npm run dev
Terminal 3: Start the Cloudflare Tunnel

PowerShell

cd C:\code2\newsouthindex
npm run tunnel
Your client can now access the app and all its features at https://app.projectgrid.tech.