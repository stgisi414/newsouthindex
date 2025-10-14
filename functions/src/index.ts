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
    logger.info(`[GEMINI] Received command: "${command}" for user with isAdmin=${isAdmin}`);

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `User command: "${command}"`,
        config: {
          systemInstruction:
            `You are an intelligent assistant for a CRM app. Your primary function is to accurately parse user commands into a structured JSON format based on the provided schema.

            **Core Rules:**
            1.  **Intent Identification**: First, determine the user's primary goal. This MUST map to one of the allowed 'intent' enum values.
            2.  **Counting vs. Metrics (CRITICAL)**: You must distinguish between counting and metrics.
                -   If the user is asking "how many," "count," or "total number of," you MUST use the \`COUNT_DATA\` intent and populate the \`countRequest\` object.
                -   **CRITICAL FILTERING RULE**: If any filterable criteria (like a location, category, or author) is mentioned in a counting query, you MUST include it in the \`filters\` object. Do NOT ignore it.
                    - **Example 1**: "how many customers do we have in alabama?" -> This is a count of contacts with a state filter. JSON: \`{ "intent": "COUNT_DATA", "countRequest": { "target": "contacts", "filters": { "state": "alabama" } } }\`
                    - **Example 2**: "count the vendors" -> This is a count of contacts with a category filter. JSON: \`{ "intent": "COUNT_DATA", "countRequest": { "target": "contacts", "filters": { "category": "vendor" } } }\`
                    - **Example 3**: "how many contacts in Montgomery" -> This is a count of contacts with a city filter. JSON: \`{ "intent": "COUNT_DATA", "countRequest": { "target": "contacts", "filters": { "city": "montgomery" } } }\`
                    - **Example 4**: "how many books by F. Scott Fitzgerald?" -> This is a count of books with an author filter. JSON: \`{ "intent": "COUNT_DATA", "countRequest": { "target": "books", "filters": { "author": "F. Scott Fitzgerald" } } }\`
                    - **Example 5**: "count the events at the Main Store" -> This is a count of events with a location filter. JSON: \`{ "intent": "COUNT_DATA", "countRequest": { "target": "events", "filters": { "location": "Main Store" } } }\`
                -   If the user is asking for "top," "best," or "highest," you MUST use the \`METRICS_DATA\` intent and populate the \`metricsRequest\` object.
                    - **Example 1**: "who are our top customers?" -> \`intent: 'METRICS_DATA'\`, \`metricsRequest: { target: 'customers', metric: 'top-spending' }\`
                    - **Example 2**: "show me the best-selling books" -> \`intent: 'METRICS_DATA'\`, \`metricsRequest: { target: 'books', metric: 'top-selling' }\`
            3.  **Admin Rights**: If \`isAdmin: false\`, you MUST REJECT any attempts to add, update, or delete data. Set the \`intent\` to \`'GENERAL_QUERY'\` and use \`responseText\` to explain the permission error.
            4.  **Field Population**: For all other intents, populate the necessary fields (\`contactIdentifier\`, \`bookData\`, etc.) as completely as possible.
            5.  **Clarity**: If unsure, use \`intent: 'UNSURE'\`.
            6.  **Response**: Always provide a friendly, conversational \`responseText\`.`,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const rawResponse = result.text;
      logger.info("[GEMINI] Raw response from API:", rawResponse);
      if (!rawResponse) {
        logger.error("Gemini returned an empty response text.");
        throw new HttpsError("internal", "Failed to get structured response.");
      }
      
      const parsedResponse = JSON.parse(rawResponse);
      logger.info("[GEMINI] Parsed JSON response:", JSON.stringify(parsedResponse, null, 2));
      return parsedResponse;

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