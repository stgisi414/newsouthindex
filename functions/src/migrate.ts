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
    databaseURL: "https://nsindxonline.firebaseio.com",
    projectId: "nsindxonline"
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
 * Migrates users to have sequential IDs (userNumber).
 * It respects existing IDs and backfills missing ones based on creation time.
 */
async function migrateUserIds() {
  console.log('\n--- Starting user ID migration ---');
  const usersRef = db.collection('users');
  const counterRef = db.collection('metadata').doc('userCounter');

  // 1. Get current counter baseline
  const counterSnap = await counterRef.get();
  let currentCount = counterSnap.exists ? counterSnap.data()?.count || 0 : 0;
  
  // 2. Fetch all users ordered by creation time
  const snapshot = await usersRef.orderBy('createdAt', 'asc').get();
  
  if (snapshot.empty) {
      console.log("No users found to migrate.");
      return;
  }

  let batch = db.batch();
  let batchOpCount = 0;
  let processedCount = 0;
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      if (userData.userNumber) {
          // If user already has a number, ensure our counter is at least that high
          if (userData.userNumber > currentCount) {
              currentCount = userData.userNumber;
          }
      } else {
          // Assign new sequential number
          currentCount++;
          batch.update(doc.ref, { userNumber: currentCount });
          updatedCount++;
          batchOpCount++;
      }

      // Commit batch if we reach the limit (safe limit 100)
      if (batchOpCount >= 100) {
          await batch.commit();
          batch = db.batch(); // Start new batch
          batchOpCount = 0;
          console.log(`Committed batch. Current sequence is at: ${currentCount}`);
      }
      processedCount++;
  }

  // Commit any remaining updates
  if (batchOpCount > 0) {
      await batch.commit();
  }

  // 3. Update the global counter to the final highest number
  await counterRef.set({ count: currentCount }, { merge: true });

  console.log(`--- Finished User Migration ---`);
  console.log(`Total users scanned: ${processedCount}`);
  console.log(`Total users assigned new IDs: ${updatedCount}`);
  console.log(`Final User Counter set to: ${currentCount}`);
}

/**
 * Migrates CONTACTS to have sequential IDs (contactNumber).
 * Checks existing IDs and backfills missing ones.
 */
async function migrateContactIds() {
  console.log('\n--- Starting Contact ID migration ---');
  const contactsRef = db.collection('contacts');
  const counterRef = db.collection('metadata').doc('contactCounter');

  // 1. Get current counter baseline
  const counterSnap = await counterRef.get();
  let currentCount = counterSnap.exists ? counterSnap.data()?.count || 0 : 0;
  
  // 2. Fetch all contacts ordered by createdAt (if available) or fallback
  const snapshot = await contactsRef.orderBy('createdAt', 'asc').get();
  
  if (snapshot.empty) {
      console.log("No contacts found to migrate.");
      return;
  }

  let batch = db.batch();
  let batchOpCount = 0;
  let processedCount = 0;
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Check if it already has a number
      if (data.contactNumber) {
          // If contact already has a number, ensure our counter tracks it
          if (data.contactNumber > currentCount) {
              currentCount = data.contactNumber;
          }
      } else {
          // Assign new sequential number
          currentCount++;
          batch.update(doc.ref, { contactNumber: currentCount });
          updatedCount++;
          batchOpCount++;
      }

      // Commit batch if limit reached (safe limit 100)
      if (batchOpCount >= 100) {
          await batch.commit();
          batch = db.batch(); 
          batchOpCount = 0;
          console.log(`Committed batch. Current contact sequence is at: ${currentCount}`);
      }
      processedCount++;
  }

  // Commit any remaining updates
  if (batchOpCount > 0) {
      await batch.commit();
  }

  // 3. Update the global counter to the final highest number
  await counterRef.set({ count: currentCount }, { merge: true });

  console.log(`--- Finished Contact Migration ---`);
  console.log(`Total contacts scanned: ${processedCount}`);
  console.log(`Total contacts assigned new IDs: ${updatedCount}`);
  console.log(`Final Contact Counter set to: ${currentCount}`);
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('Starting Firestore data migration...');
  
  try {
    // You can keep or comment out the field renames if they are already done
    await migrateCollection('contacts');
    await migrateCollection('books');
    await migrateCollection('events');
    
    await migrateUserIds();
    
    // --- ADD THIS CALL ---
    await migrateContactIds();
    
    console.log('\nMigration complete for all collections!');
  } catch (error) {
    console.error('A critical error occurred during migration:', error);
    process.exit(1);
  }
}

// Run the script
runMigration().catch(console.error);