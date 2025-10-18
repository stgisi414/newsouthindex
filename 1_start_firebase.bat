@echo off
echo --- BUILDING FIREBASE FUNCTIONS (TypeScript -> JavaScript) ---
cd functions
call npm run build
cd ..
echo --- STARTING FIREBASE EMULATORS ---
firebase emulators:start --import=./.firebase/data --export-on-exit