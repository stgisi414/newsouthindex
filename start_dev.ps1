# Get the directory where this script is located (the project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
cd $scriptDir

# --- 1. Start Firebase Emulators (Backend/Functions) ---
# CRITICAL FIX: We are using cmd.exe to launch PowerShell in a new window, 
# and within that new shell, we execute the firebase command. This forces a proper PATH load.
Start-Process -FilePath "cmd.exe" -ArgumentList "/k powershell -Command ""firebase emulators:start --only firestore,auth,functions --import ./firebase_data --export-on-exit --timeout 180000""" -NoNewWindow
# Increased delay for robust initial startup
Start-Sleep -Seconds 10 

# --- 2. Start the Frontend (Vite Dev Server) ---
# Use cmd /c to run npm script
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -NoNewWindow

# --- 3. Start the Cloudflare Tunnel ---
# Use cmd /c to run npm script for tunnel. 
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run tunnel" -NoNewWindow
