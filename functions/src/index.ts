import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI, FunctionDeclaration, GenerativeContent } from "@google/genai";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { mockContacts, mockBooks, mockEvents } from "./mockData";

admin.initializeApp();

// This is a helper function to seed the database in the emulator.
export const seedDatabase = onCall({cors: true}, async (request) => {
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
  const contactDocs = mockContacts.map(contact => {
    const docRef = contactsRef.doc();
    batch.set(docRef, { ...contact, createdDate: FieldValue.serverTimestamp() });
    return { id: docRef.id, ...contact };
  });
  const booksRef = admin.firestore().collection("books");
  const bookDocs = mockBooks.map(book => {
    const docRef = booksRef.doc();
    batch.set(docRef, book);
    return { id: docRef.id, ...book };
  });
  const eventsRef = admin.firestore().collection("events");
  mockEvents.forEach(event => {
    const docRef = eventsRef.doc();
    batch.set(docRef, event);
  });
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
      transactionDate: FieldValue.serverTimestamp(),
    });
    const book1Ref = booksRef.doc(bookDocs[0].id);
    batch.update(book1Ref, { stock: FieldValue.increment(-1) });
    const book2Ref = booksRef.doc(bookDocs[1].id);
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


// Main function to process natural language commands.
export const processCommand = onCall({secrets: ["GEMINI_API_KEY"], cors: true}, async (request: CallableRequest<any>) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("GEMINI_API_KEY environment variable missing.");
      throw new HttpsError("internal", "AI service configuration failed.");
    }
    const ai = new GoogleGenAI({apiKey});

    const command = request.data.command;
    logger.info(`[GEMINI] Received command: "${command}"`);

    // --- Definitive Fix v4: Enforced System Instruction and Highly Specific Few-Shot Examples ---
    cconst systemInstruction = `You are a function-calling AI assistant for a CRM application. Your role is to convert natural language commands into a single, structured JSON function call using the provided tools.
    
CRITICAL INSTRUCTION:
1. Always translate the user's intent into the *most specific* function call possible. Never use the 'find' functions when a 'count', 'add', 'update', 'delete', or 'metrics' function is appropriate.
2. The output MUST be a function call and NOT a conversational response.
3. For all queries that require specific filtering (e.g., location, category, author), you must populate the 'args' object with the correct filter(s) and their value(s) from the user's command. Use proper casing for known categorical values (e.g., 'Client', 'Media', 'AL').
4. For general "count all" requests (e.g., 'total contacts'), the function call must include an empty args object: {}.`;


    const fewShotExamples: GenerativeContent[] = [
        // All-data counts must explicitly use an empty object as args
        { role: "user", parts: [{ text: "total contacts" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: {} } }] },
        { role: "user", parts: [{ text: "count all events" }] },
        { role: "model", parts: [{ functionCall: { name: "countEvents", args: {} } }] },
        
        // Filtered examples (ensuring args is populated)
        { role: "user", parts: [{ text: "how many clients?" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: { category: "Client" } } }] },
        { role: "user", parts: [{ text: "how many contacts are not clients?" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: { category: "not Client" } } }] },
        { role: "user", parts: [{ text: "count my business contacts" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: { category: "Client" } } }] },
        { role: "user", parts: [{ text: "how many contacts in montgomery?" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: { city: "Montgomery" } } }] },
        { role: "user", parts: [{ text: "how many contacts in mobile, alabama with zip 36602?" }] },
        { role: "model", parts: [{ functionCall: { name: "countContacts", args: { city: "Mobile", state: "AL", zip: "36602" } } }] },
        { role: "user", parts: [{ text: "count all books by Stephen King" }] },
        { role: "model", parts: [{ functionCall: { name: "countBooks", args: { author: "Stephen King" } } }] },
        { role: "user", parts: [{ text: "how many books are out of stock?" }] },
        { role: "model", parts: [{ functionCall: { name: "countBooks", args: { stock: 0 } } }] },
        { role: "user", parts: [{ text: "count events in the Upstairs Loft" }] },
        { role: "model", parts: [{ functionCall: { name: "countEvents", args: { location: "Upstairs Loft" } } }] },
        { role: "user", parts: [{ text: "who are my top 5 customers?" }] },
        { role: "model", parts: [{ functionCall: { name: "getMetrics", args: { target: "customers", metric: "top-spending", limit: 5 } } }] }
    ];

    const contents: GenerativeContent[] = [
        ...fewShotExamples,
        { role: "user", parts: [{ text: command }] }
    ];

    // --- Updated Tool Definitions (More Descriptive) ---
    const tools: FunctionDeclaration[] = [
      { name: "countContacts", description: "Counts contacts based on filters like category, city, state, or zip code.", parameters: { type: "OBJECT", properties: { category: { type: "STRING" }, state: { type: "STRING" }, city: { type: "STRING" }, zip: { type: "STRING" } } } },
      { name: "countBooks", description: "Counts books in the inventory based on filters like author, genre, stock, publisher, or publication year.", parameters: { type: "OBJECT", properties: { author: { type: "STRING" }, genre: { type: "STRING" }, stock: { type: "NUMBER" }, publisher: { type: "STRING" }, publicationYear: { type: "NUMBER" } } } },
      { name: "countEvents", description: "Counts scheduled events based on filters like location, featured author, or event name.", parameters: { type: "OBJECT", properties: { location: { type: "STRING" }, author: { type: "STRING" }, name: { type: "STRING" } } } },
      { name: "addContact", description: "Adds a new contact.", parameters: { type: "OBJECT", properties: { firstName: { type: "STRING" }, lastName: { type: "STRING" }, email: { type: "STRING" }, phone: { type: "STRING" }, city: { type: "STRING" }, state: { type: "STRING" }, zip: { type: "STRING" }, category: { type: "STRING" }, notes: { type: "STRING" } }, required: ["firstName", "lastName"] } },
      { name: "findContact", description: "Finds a contact by name or email.", parameters: { type: "OBJECT", properties: { identifier: { type: "STRING" } }, required: ["identifier"] } },
      { name: "updateContact", description: "Updates a contact's information.", parameters: { type: "OBJECT", properties: { identifier: { type: "STRING" }, updateData: { type: "OBJECT", properties: { firstName: { type: "STRING" }, lastName: { type: "STRING" }, email: { type: "STRING" }, phone: { type: "STRING" }, city: { type: "STRING" }, state: { type: "STRING" }, zip: { type: "STRING" }, category: { type: "STRING" }, notes: { type: "STRING" } } } }, required: ["identifier", "updateData"] } },
      { name: "deleteContact", description: "Deletes a contact by name or email.", parameters: { type: "OBJECT", properties: { identifier: { type: "STRING" } }, required: ["identifier"] } },
      { name: "addBook", description: "Adds a new book.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, author: { type: "STRING" }, isbn: { type: "STRING" }, publisher: { type: "STRING" }, price: { type: "NUMBER" }, stock: { type: "NUMBER" }, genre: { type: "STRING" }, publicationYear: { type: "NUMBER" } }, required: ["title", "author"] } },
      { name: "findBook", description: "Finds a book by title, author, or ISBN.", parameters: { type: "OBJECT", properties: { identifier: { type: "STRING" } }, required: ["identifier"] } },
      { name: "updateBook", description: "Updates a book's information.", parameters: { type: "OBJECT", properties: { bookIdentifier: { type: "STRING" }, updateData: { type: "OBJECT", properties: { title: { type: "STRING" }, author: { type: "STRING" }, isbn: { type: "STRING" }, publisher: { type: "STRING" }, price: { type: "NUMBER" }, stock: { type: "NUMBER" }, genre: { type: "STRING" }, publicationYear: { type: "NUMBER" } } } }, required: ["bookIdentifier", "updateData"] } },
      { name: "deleteBook", description: "Deletes a book by its title.", parameters: { type: "OBJECT", properties: { bookIdentifier: { type: "STRING" } }, required: ["bookIdentifier"] } },
      { name: "addEvent", description: "Adds a new event.", parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, date: { type: "STRING" }, author: { type: "STRING" }, description: { type: "STRING" }, location: { type: "STRING" } }, required: ["name", "date", "location"] } },
      { name: "findEvent", description: "Finds an event by its name, description, or author.", parameters: { type: "OBJECT", properties: { identifier: { type: "STRING" } }, required: ["identifier"] } },
      { name: "updateEvent", description: "Updates an event's information.", parameters: { type: "OBJECT", properties: { eventIdentifier: { type: "STRING" }, updateData: { type: "OBJECT", properties: { name: { type: "STRING" }, date: { type: "STRING" }, author: { type: "STRING" }, description: { type: "STRING" }, location: { type: "STRING" } } } }, required: ["eventIdentifier", "updateData"] } },
      { name: "deleteEvent", description: "Deletes an event by its name.", parameters: { type: "OBJECT", properties: { eventIdentifier: { type: "STRING" } }, required: ["eventIdentifier"] } },
      { name: "addAttendee", description: "Adds a contact as an attendee to an event.", parameters: { type: "OBJECT", properties: { eventIdentifier: { type: "STRING" }, contactIdentifier: { type: "STRING" } }, required: ["eventIdentifier", "contactIdentifier"] } },
      { name: "removeAttendee", description: "Removes a contact from an event's attendee list.", parameters: { type: "OBJECT", properties: { eventIdentifier: { type: "STRING" }, contactIdentifier: { type: "STRING" } }, required: ["eventIdentifier", "contactIdentifier"] } },
      { name: "getMetrics", description: "Gets metrics, such as top customers (top-spending) or best-selling books (top-selling).", parameters: { type: "OBJECT", properties: { target: { type: "STRING" }, metric: { type: "STRING" }, limit: { type: "NUMBER" } }, required: ["target", "metric"] } },
    ];

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: contents,
            tools: [{ functionDeclarations: tools }],
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const call = result.functionCalls?.[0];

        if (call) {
            logger.info("[GEMINI] Function call requested:", call.name, call.args);
            const { name, args } = call;
            let response: any;
            const anyArgs = args as any;

            // CRITICAL FIX: Enforce correct nested data structure for all intents
            switch (name) {
                case "countContacts": 
                case "countBooks":
                case "countEvents":
                    response = { 
                        intent: 'COUNT_DATA', 
                        data: {
                            // FIX: Correctly nest target and filters under countRequest.filters
                            countRequest: { 
                                target: name.replace('count', '').toLowerCase(), 
                                filters: args || {},
                            }, 
                        },
                        // OPTIONAL: Provide a responseText if the model didn't, for completeness.
                        responseText: result.text || `Query received for counting ${name.replace('count', '').toLowerCase()}.`,
                    };
                    break;
                case "addContact": 
                    response = { 
                        intent: 'ADD_CONTACT', 
                        data: { contactData: args }, 
                        responseText: result.text || `Adding contact.`,
                    };
                    break;
                case "findContact": 
                    response = { 
                        intent: 'FIND_CONTACT', 
                        data: { contactIdentifier: anyArgs.identifier }, 
                        responseText: result.text || `Finding contact.`,
                    };
                    break;
                case "updateContact": 
                    response = { 
                        intent: 'UPDATE_CONTACT', 
                        data: { contactIdentifier: anyArgs.identifier, updateData: anyArgs.updateData }, 
                        responseText: result.text || `Updating contact.`,
                    };
                    break;
                case "deleteContact": 
                    response = { 
                        intent: 'DELETE_CONTACT', 
                        data: { contactIdentifier: anyArgs.identifier }, 
                        responseText: result.text || `Deleting contact.`,
                    };
                    break;
                case "addBook": 
                    response = { 
                        intent: 'ADD_BOOK', 
                        data: { bookData: args },
                        responseText: result.text || `Adding book.`,
                    };
                    break;
                case "findBook": 
                    response = { 
                        intent: 'FIND_BOOK', 
                        data: { bookIdentifier: anyArgs.identifier },
                        responseText: result.text || `Finding book.`,
                    };
                    break;
                case "updateBook": 
                    response = { 
                        intent: 'UPDATE_BOOK', 
                        data: { bookIdentifier: anyArgs.bookIdentifier, updateData: anyArgs.updateData },
                        responseText: result.text || `Updating book.`,
                    };
                    break;
                case "deleteBook": 
                    response = { 
                        intent: 'DELETE_BOOK', 
                        data: { bookIdentifier: anyArgs.bookIdentifier },
                        responseText: result.text || `Deleting book.`,
                    };
                    break;
                case "addEvent": 
                    response = { 
                        intent: 'ADD_EVENT', 
                        data: { eventData: args },
                        responseText: result.text || `Adding event.`,
                    };
                    break;
                case "findEvent": 
                    response = { 
                        intent: 'FIND_EVENT', 
                        data: { eventIdentifier: anyArgs.identifier },
                        responseText: result.text || `Finding event.`,
                    };
                    break;
                case "updateEvent": 
                    response = { 
                        intent: 'UPDATE_EVENT', 
                        data: { eventIdentifier: anyArgs.eventIdentifier, updateData: anyArgs.updateData },
                        responseText: result.text || `Updating event.`,
                    };
                    break;
                case "deleteEvent": 
                    response = { 
                        intent: 'DELETE_EVENT', 
                        data: { eventIdentifier: anyArgs.eventIdentifier },
                        responseText: result.text || `Deleting event.`,
                    };
                    break;
                case "addAttendee": 
                    response = { 
                        intent: 'ADD_ATTENDEE', 
                        data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier },
                        responseText: result.text || `Adding attendee.`,
                    };
                    break;
                case "removeAttendee": 
                    response = { 
                        intent: 'REMOVE_ATTENDEE', 
                        data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier },
                        responseText: result.text || `Removing attendee.`,
                    };
                    break;
                case "getMetrics": 
                    response = { 
                        intent: 'METRICS_DATA', 
                        data: { metricsRequest: args }, 
                        responseText: result.text || `Getting metrics.`,
                    };
                    break;
                default: 
                    // If no function call, use the model's response text if it exists
                    const conversationalText = result.text || "I'm sorry, I could not determine a specific action to take.";
                    response = { intent: "GENERAL_QUERY", responseText: conversationalText };
            }

            logger.info("[GEMINI] Transformed to structured response:", JSON.stringify(response, null, 2));
            return response;
        }

        logger.warn("[GEMINI] No function call was returned by the model.");
        // If it reaches here, use the model's text response if it returned one.
        const conversationalText = result.text || "I'm sorry, I could not determine a specific action to take.";
        return { intent: "GENERAL_QUERY", responseText: conversationalText };

    } catch (error) {
        logger.error("Error processing command with Gemini:", error);
        throw new HttpsError("internal", "Gemini processing failed.");
    }
});

// --- User Management Functions ---
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
    if (error instanceof HttpsError) { throw error; }
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
    if (error instanceof HttpsError) { throw error; }
    throw new HttpsError("internal", "Failed to delete user.");
  }
});

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