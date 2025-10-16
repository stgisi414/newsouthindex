@echo off
title Firebase Emulators
echo Starting Firebase Emulators...
cd /d C:\code2\newsouthindex
firebase emulators:start --only firestore,auth,functions --import ./firebase_data --export-on-exit