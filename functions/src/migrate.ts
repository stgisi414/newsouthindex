/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
// This script assumes you are running it with valid application credentials
// (e.g., after running 'gcloud auth application-default login')
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Make sure to add your databaseURL if it's not auto-detected
    // databaseURL: "https://<YOUR-PROJECT-ID>.firebaseio.com" 
  });
  console.log('Firebase Admin initialized.');
} catch (error: any) {
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase Admin already initialized.');
  } else {
    console.error('Firebase Admin initialization error:', error);
    process.exit(1);
  }
}


const db = admin.firestore();
const batchSize = 100; // Process 100 docs at a time

// Define default metadata
const DEFAULT_USER = 'system.migration@stefangisi.info';
const NOW = FieldValue.serverTimestamp();

/**
 * Migrates a single collection.
 * It renames `createdDate` to `createdAt` and `lastModifiedDate` to `lastModifiedAt`.
 * It also backfills `createdBy` and `lastModifiedBy`.
 */
async function migrateCollection(collectionName: string) {
  console.log(`\n--- Starting migration for collection: ${collectionName} ---`);
  
  const collectionRef = db.collection(collectionName);
  let processedCount = 0;
  let skippedCount = 0;
  let query = collectionRef.limit(batchSize);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log(`No more documents found in ${collectionName}.`);
      break;
    }

    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data() as any;
      const updatePayload: Record<string, any> = {};

      // --- Field Rename Logic ---

      // 1. Handle `createdAt`
      if (data.createdDate && !data.createdAt) {
        // If `createdDate` exists and `createdAt` doesn't, rename it.
        updatePayload.createdAt = data.createdDate;
        updatePayload.createdDate = FieldValue.delete(); // Remove old field
      } else if (!data.createdDate && !data.createdAt) {
        // If neither exists, set it to NOW.
        updatePayload.createdAt = NOW;
      }
      
      // 2. Handle `lastModifiedAt`
      if (data.lastModifiedDate && !data.lastModifiedAt) {
        // If `lastModifiedDate` exists and `lastModifiedAt` doesn't, rename it.
        updatePayload.lastModifiedAt = data.lastModifiedDate;
        updatePayload.lastModifiedDate = FieldValue.delete(); // Remove old field
      } else if (!data.lastModifiedDate && !data.lastModifiedAt) {
        // If neither exists, set it to NOW.
        updatePayload.lastModifiedAt = NOW;
      }

      // 3. Backfill `createdBy`
      if (!data.createdBy) {
        updatePayload.createdBy = DEFAULT_USER;
      }

      // 4. Backfill `lastModifiedBy`
      if (!data.lastModifiedBy) {
        updatePayload.lastModifiedBy = DEFAULT_USER;
      }
      
      // --- End Logic ---

      if (Object.keys(updatePayload).length > 0) {
        // Only add to batch if there's something to update
        batch.update(doc.ref, updatePayload);
        processedCount++;
      } else {
        skippedCount++;
      }
    });

    // Commit the batch of updates
    if (processedCount > 0) {
      await batch.commit();
      console.log(`Committed batch. Total processed: ${processedCount}, Skipped: ${skippedCount}`);
    }

    if (snapshot.size < batchSize) {
      // We've reached the end
      break;
    }

    // Set up the query for the next page
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    query = collectionRef.startAfter(lastDoc).limit(batchSize);
  }
  
  console.log(`--- Finished migration for ${collectionName} ---`);
  console.log(`Total documents updated: ${processedCount}`);
  console.log(`Total documents skipped (up-to-date): ${skippedCount}`);
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('Starting Firestore data migration...');
  
  try {
    await migrateCollection('contacts');
    await migrateCollection('books');
    await migrateCollection('events');
    // Add any other collections here
    
    console.log('\nMigration complete for all collections!');
  } catch (error) {
    console.error('A critical error occurred during migration:', error);
    process.exit(1);
  }
}

// Run the script
runMigration().catch(console.error);