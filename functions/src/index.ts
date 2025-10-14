import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI } from "@google/genai";
import { responseSchema } from "./geminiSchema";
import * as admin from "firebase-admin";
// FIX: Import FieldValue directly
import { FieldValue } from "firebase-admin/firestore";
import { mockContacts, mockBooks, mockEvents } from "./mockData";

admin.initializeApp();

// NEW FUNCTION: Seeds the database with mock data if it's empty
export const seedDatabase = onCall({cors: true}, async (request) => {
  // Only allow this in non-production environments
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    throw new HttpsError("permission-denied", "This function can only be run in the emulator environment.");
  }

  const contactsRef = admin.firestore().collection("contacts");
  const contactsSnapshot = await contactsRef.limit(1).get();

  if (!contactsSnapshot.empty) {
    logger.info("Database already contains data. Seeding skipped.");
    return { message: "Database already seeded." };
  }

  logger.info("Database is empty. Seeding with mock data...");

  const batch = admin.firestore().batch();

  // Add Contacts and store their new IDs
  const contactDocs = mockContacts.map(contact => {
    const docRef = contactsRef.doc();
    // FIX: Use FieldValue directly
    batch.set(docRef, { ...contact, createdDate: FieldValue.serverTimestamp() });
    return { id: docRef.id, ...contact };
  });

  // Add Books and store their new IDs
  const booksRef = admin.firestore().collection("books");
  const bookDocs = mockBooks.map(book => {
    const docRef = booksRef.doc();
    batch.set(docRef, book);
    return { id: docRef.id, ...book };
  });

  // Add Events
  const eventsRef = admin.firestore().collection("events");
  mockEvents.forEach(event => {
    const docRef = eventsRef.doc();
    batch.set(docRef, event);
  });

  // Add a sample Transaction
  if (contactDocs.length > 0 && bookDocs.length > 1) {
    const transactionsRef = admin.firestore().collection("transactions");
    const transactionDoc = transactionsRef.doc();
    batch.set(transactionDoc, {
      contactId: contactDocs[0].id,
      contactName: `${contactDocs[0].firstName} ${contactDocs[0].lastName}`,
      books: [
        { id: bookDocs[0].id, title: bookDocs[0].title, price: bookDocs[0].price, quantity: 1 },
        { id: bookDocs[1].id, title: bookDocs[1].title, price: bookDocs[1].price, quantity: 2 },
      ],
      totalPrice: bookDocs[0].price + (bookDocs[1].price * 2),
      // FIX: Use FieldValue directly
      transactionDate: FieldValue.serverTimestamp(),
    });

    // Decrement stock for the books in the transaction
    const book1Ref = booksRef.doc(bookDocs[0].id);
    // FIX: Use FieldValue directly
    batch.update(book1Ref, { stock: FieldValue.increment(-1) });
    const book2Ref = booksRef.doc(bookDocs[1].id);
    // FIX: Use FieldValue directly
    batch.update(book2Ref, { stock: FieldValue.increment(-2) });
  }

  try {
    await batch.commit();
    logger.info("Database seeded successfully.");
    return { message: "Database seeded successfully." };
  } catch (error) {
    logger.error("Error seeding database:", error);
    throw new HttpsError("internal", "Failed to seed database.");
  }
});


export const processCommand = onCall({secrets: ["GEMINI_API_KEY"], cors: true}, async (request: CallableRequest<any>) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("GEMINI_API_KEY environment variable missing.");
      throw new HttpsError("internal", "AI service configuration failed.");
    }
    const ai = new GoogleGenAI({apiKey});

    const command = request.data.command;
    const isAdmin = request.data.isAdmin === true;
    logger.info(`Received command: "${command}" for user with isAdmin=${isAdmin}`);

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `User command: "${command}"`,
        config: {
          systemInstruction:
            `You are an intelligent assistant for a CRM app that manages contacts, books, transactions, and events. Your task is to parse user commands into structured JSON data based on the provided schema. The user's admin status is: ${isAdmin}.
            - Your primary goal is to differentiate between contacts, books, transactions, and events. "Add a book" uses ADD_BOOK. "Add a person" uses ADD_CONTACT. "Schedule an event" uses ADD_EVENT.
            - For summarization questions like "how many clients in Alabama" or "who is the top customer", use the SUMMARIZE_DATA intent. For "how many", populate the 'filters' object. For "top customer" or "best-selling book", populate 'summaryTarget' and 'summaryMetric'.
            - Identify the user's intent from the full list: ADD_CONTACT, FIND_CONTACT, UPDATE_CONTACT, DELETE_CONTACT, ADD_BOOK, FIND_BOOK, UPDATE_BOOK, DELETE_BOOK, CREATE_TRANSACTION, ADD_EVENT, FIND_EVENT, UPDATE_EVENT, DELETE_EVENT, ADD_ATTENDEE, REMOVE_ATTENDEE, SUMMARIZE_DATA, GENERAL_QUERY, UNSURE.
            - For adding attendees (e.g., "add John Smith to the author signing"), set intent to ADD_ATTENDEE and populate both contactIdentifier and eventIdentifier. The same applies for REMOVE_ATTENDEE.
            - Extract all relevant details. For an ADD_BOOK command, populate 'bookData'. For an ADD_CONTACT command, populate 'contactData'. For ADD_EVENT, populate 'eventData'.
            - If the user is NOT an admin and tries an admin action (add, update, delete), set the intent to 'GENERAL_QUERY' and use the responseText to inform them they do not have permission.
            - If the user IS an admin, confirm you are performing the action in the responseText.
            - If the intent is unclear, use 'UNSURE'.
            - Always provide a friendly 'responseText'.`,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const rawResponse = result.text;
      if (!rawResponse) {
        logger.error("Gemini returned an empty response text.");
        throw new HttpsError("internal", "Failed to get structured response.");
      }
      return JSON.parse(rawResponse);
    } catch (error) {
      logger.error("Error processing command with Gemini:", error);
      throw new HttpsError("internal", "Gemini processing failed.");
    }
});

export const setUserRole = onCall({cors: true}, async (request) => {
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError("permission-denied", "Only admins can set user roles.");
  }

  const { userId, role } = request.data;
  if (!userId || !['admin', 'viewer', 'applicant'].includes(role)) {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId` and a valid `role`.");
  }

  try {
    const userDocRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists && userDoc.data()?.isMasterAdmin === true) {
      throw new HttpsError("permission-denied", "The master admin account cannot be modified.");
    }

    await admin.auth().setCustomUserClaims(userId, { role });
    await userDocRef.update({ role, isAdmin: role === 'admin' });
    return { success: true, message: `Successfully updated role for user ${userId}.` };
  } catch (error) {
    logger.error("Error setting user role:", error);
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError("internal", "Failed to set user role.");
  }
});

export const deleteUser = onCall({cors: true}, async (request) => {
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId`.");
  }

  try {
    const userDocRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists && userDoc.data()?.isMasterAdmin === true) {
        throw new HttpsError("permission-denied", "The master admin account cannot be deleted.");
    }

    await admin.auth().deleteUser(userId);
    await userDocRef.delete();
    return { success: true, message: `Successfully deleted user ${userId}.` };
  } catch (error) {
    logger.error("Error deleting user:", error);
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError("internal", "Failed to delete user.");
  }
});

// You should now delete this function if you haven't already.
export const makeMeAdmin = onCall({cors: true}, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }

    const usersRef = admin.firestore().collection("users");
    const adminSnapshot = await usersRef.where('isAdmin', '==', true).limit(1).get();

    if (!adminSnapshot.empty) {
        throw new HttpsError("permission-denied", "An admin already exists.");
    }
    
    const uid = request.auth.uid;
    const email = request.auth.token.email || "Unknown";
    try {
      await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
      await admin.firestore().collection("users").doc(uid).set({
        role: 'admin',
        isAdmin: true,
      }, { merge: true });
      logger.info(`Successfully set 'admin' role for ${email} (${uid}).`);
      return { message: `Success! Admin permissions have been synced for ${email}. Please refresh the page.` };
    } catch (error) {
      logger.error("Error in makeMeAdmin function:", error);
      throw new HttpsError("internal", "Failed to set admin role. Check the function logs.");
    }
});
