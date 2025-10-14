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
    logger.debug("[GEMINI] Full request data:", request.data);

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: `User command: "${command}"`,
            tools: [{
                functionDeclarations: [
                    // --- Counting Functions ---
                    {
                        name: "countContacts",
                        description: "Counts contacts. Use for queries like 'how many clients?' or 'how many vendors?' with the category filter.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING, description: "The category of the contact to count (e.g., 'Client', 'Vendor')." },
                                state: { type: Type.STRING, description: "The state to filter contacts by (e.g., 'AL')." },
                                city: { type: Type.STRING, description: "The city to filter contacts by (e.g., 'Montgomery')." },
                                zip: { type: Type.STRING, description: "The zip code to filter contacts by." },
                            },
                        },
                    },
                    {
                        name: "countBooks",
                        description: "Counts books, optionally filtering by various criteria.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                author: { type: Type.STRING, description: "The author of the books to count." },
                                genre: { type: Type.STRING, description: "The genre of the books to count." },
                                stock: { type: Type.NUMBER, description: "The stock level to filter books by (e.g., 0 for out of stock)." },
                            },
                        },
                    },
                     {
                        name: "countEvents",
                        description: "Counts events. If a person's name is mentioned (e.g., 'events with Jane Doe'), use the 'author' filter.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                location: { type: Type.STRING, description: "The location of the events to count." },
                                author: { type: Type.STRING, description: "The featured author of the events to count." },
                                name: { type: Type.STRING, description: "A keyword in the name of the events to count (e.g., 'poetry')." },
                            },
                        },
                    },
                    // --- Contact Functions ---
                    {
                        name: "addContact",
                        description: "Adds a new contact.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                firstName: { type: Type.STRING }, lastName: { type: Type.STRING }, email: { type: Type.STRING }, phone: { type: Type.STRING }, city: { type: Type.STRING }, state: { type: Type.STRING }, zip: { type: Type.STRING }, category: { type: Type.STRING }, notes: { type: Type.STRING },
                            },
                            required: ["firstName", "lastName"],
                        },
                    },
                    {
                        name: "findContact",
                        description: "Finds a contact by name or email.",
                        parameters: {
                            type: Type.OBJECT, properties: { identifier: { type: Type.STRING, description: "Name or email of the contact." }, }, required: ["identifier"],
                        },
                    },
                    {
                        name: "updateContact",
                        description: "Updates a contact's information.",
                        parameters: {
                           type: Type.OBJECT, properties: {
                                identifier: { type: Type.STRING, description: "The name or email of the contact to update." },
                                updateData: { type: Type.OBJECT, properties: {
                                    firstName: { type: Type.STRING }, lastName: { type: Type.STRING }, email: { type: Type.STRING }, phone: { type: Type.STRING }, city: { type: Type.STRING }, state: { type: Type.STRING }, zip: { type: Type.STRING }, category: { type: Type.STRING }, notes: { type: Type.STRING },
                                } },
                           }, required: ["identifier", "updateData"],
                        }
                    },
                    {
                        name: "deleteContact",
                        description: "Deletes a contact by name or email.",
                        parameters: {
                            type: Type.OBJECT, properties: { identifier: { type: Type.STRING, description: "Name or email of the contact to delete." }, }, required: ["identifier"],
                        },
                    },
                    // --- Book Functions ---
                    {
                        name: "addBook",
                        description: "Adds a new book.",
                        parameters: {
                           type: Type.OBJECT, properties: {
                                title: { type: Type.STRING }, author: { type: Type.STRING }, isbn: { type: Type.STRING }, publisher: { type: Type.STRING }, price: { type: Type.NUMBER }, stock: { type: Type.NUMBER }, genre: { type: Type.STRING }, publicationYear: { type: Type.NUMBER },
                           }, required: ["title", "author"],
                        }
                    },
                     {
                        name: "findBook",
                        description: "Finds a book by title, author, or ISBN.",
                        parameters: {
                            type: Type.OBJECT, properties: { identifier: { type: Type.STRING, description: "Title, author, or ISBN of the book." }, }, required: ["identifier"],
                        },
                    },
                    {
                        name: "updateBook",
                        description: "Updates a book's information.",
                        parameters: {
                           type: Type.OBJECT, properties: {
                                bookIdentifier: { type: Type.STRING, description: "The title of the book to update." },
                                updateData: { type: Type.OBJECT, properties: {
                                    title: { type: Type.STRING }, author: { type: Type.STRING }, isbn: { type: Type.STRING }, publisher: { type: Type.STRING }, price: { type: Type.NUMBER }, stock: { type: Type.NUMBER }, genre: { type: Type.STRING }, publicationYear: { type: Type.NUMBER },
                                } },
                           }, required: ["bookIdentifier", "updateData"],
                        }
                    },
                    {
                        name: "deleteBook",
                        description: "Deletes a book by its title.",
                        parameters: {
                           type: Type.OBJECT, properties: { bookIdentifier: { type: Type.STRING, description: "The title of the book to delete." }, }, required: ["bookIdentifier"],
                        }
                    },
                    // --- Event Functions ---
                    {
                        name: "addEvent",
                        description: "Adds a new event.",
                        parameters: {
                           type: Type.OBJECT, properties: {
                                name: { type: Type.STRING }, date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." }, author: { type: Type.STRING }, description: { type: Type.STRING }, location: { type: Type.STRING },
                           }, required: ["name", "date", "location"],
                        }
                    },
                     {
                        name: "findEvent",
                        description: "Finds an event by its name, description, or author.",
                        parameters: {
                            type: Type.OBJECT, properties: { identifier: { type: Type.STRING, description: "Name, description, or author of the event." }, }, required: ["identifier"],
                        },
                    },
                    {
                        name: "updateEvent",
                        description: "Updates an event's information.",
                        parameters: {
                           type: Type.OBJECT, properties: {
                                eventIdentifier: { type: Type.STRING, description: "The name of the event to update." },
                                updateData: { type: Type.OBJECT, properties: {
                                    name: { type: Type.STRING }, date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." }, author: { type: Type.STRING }, description: { type: Type.STRING }, location: { type: Type.STRING },
                                } },
                           }, required: ["eventIdentifier", "updateData"],
                        }
                    },
                    {
                        name: "deleteEvent",
                        description: "Deletes an event by its name.",
                        parameters: {
                           type: Type.OBJECT, properties: { eventIdentifier: { type: Type.STRING, description: "The name of the event to delete." }, }, required: ["eventIdentifier"],
                        }
                    },
                    {
                        name: "addAttendee",
                        description: "Adds a contact as an attendee to an event.",
                        parameters: {
                            type: Type.OBJECT, properties: {
                                eventIdentifier: { type: Type.STRING, description: "The name of the event." },
                                contactIdentifier: { type: Type.STRING, description: "The name or email of the contact to add." },
                            }, required: ["eventIdentifier", "contactIdentifier"],
                        },
                    },
                    {
                        name: "removeAttendee",
                        description: "Removes a contact from an event's attendee list.",
                        parameters: {
                            type: Type.OBJECT, properties: {
                                eventIdentifier: { type: Type.STRING, description: "The name of the event." },
                                contactIdentifier: { type: Type.STRING, description: "The name or email of the contact to remove." },
                            }, required: ["eventIdentifier", "contactIdentifier"],
                        },
                    },
                     // --- Metrics Function ---
                    {
                        name: "getMetrics",
                        description: "Gets metrics, such as top customers or best-selling books.",
                        parameters: {
                            type: Type.OBJECT, properties: {
                                target: { type: Type.STRING, description: "Entity for metrics ('customers', 'books')." },
                                metric: { type: Type.STRING, description: "Metric to retrieve ('top-spending', 'top-selling')." },
                                limit: { type: Type.NUMBER, description: "The number of results to return." },
                            }, required: ["target", "metric"],
                        },
                    },
                ],
            }],
        });

        const call = result.functionCalls?.[0];

        if (call) {
            logger.info("[GEMINI] Function call requested:", call.name, call.args);
            const { name, args } = call;
            let response: any = { responseText: `Understood. Performing action: ${name}.` };
            const anyArgs = args as any;

            switch (name) {
                case "countContacts":
                    response.intent = 'COUNT_DATA';
                    response.countRequest = { target: 'contacts', filters: args };
                    break;
                case "countBooks":
                    response.intent = 'COUNT_DATA';
                    response.countRequest = { target: 'books', filters: args };
                    break;
                case "countEvents":
                    response.intent = 'COUNT_DATA';
                    response.countRequest = { target: 'events', filters: args };
                    break;
                case "addContact":
                    response.intent = 'ADD_CONTACT';
                    response.contactData = args;
                    break;
                case "findContact":
                    response.intent = 'FIND_CONTACT';
                    response.contactIdentifier = anyArgs.identifier;
                    break;
                case "updateContact":
                    response.intent = 'UPDATE_CONTACT';
                    response.contactIdentifier = anyArgs.identifier;
                    response.updateData = anyArgs.updateData;
                    break;
                case "deleteContact":
                    response.intent = 'DELETE_CONTACT';
                    response.contactIdentifier = anyArgs.identifier;
                    break;
                case "addBook":
                    response.intent = 'ADD_BOOK';
                    response.bookData = args;
                    break;
                case "findBook":
                    response.intent = 'FIND_BOOK';
                    response.bookIdentifier = anyArgs.identifier;
                    break;
                case "updateBook":
                    response.intent = 'UPDATE_BOOK';
                    response.bookIdentifier = anyArgs.bookIdentifier;
                    response.updateData = anyArgs.updateData;
                    break;
                case "deleteBook":
                    response.intent = 'DELETE_BOOK';
                    response.bookIdentifier = anyArgs.bookIdentifier;
                    break;
                case "addEvent":
                    response.intent = 'ADD_EVENT';
                    response.eventData = args;
                    break;
                case "findEvent":
                    response.intent = 'FIND_EVENT';
                    response.eventIdentifier = anyArgs.identifier;
                    break;
                case "updateEvent":
                    response.intent = 'UPDATE_EVENT';
                    response.eventIdentifier = anyArgs.eventIdentifier;
                    response.updateData = anyArgs.updateData;
                    break;
                case "deleteEvent":
                    response.intent = 'DELETE_EVENT';
                    response.eventIdentifier = anyArgs.eventIdentifier;
                    break;
                case "addAttendee":
                    response.intent = 'ADD_ATTENDEE';
                    response.eventIdentifier = anyArgs.eventIdentifier;
                    response.contactIdentifier = anyArgs.contactIdentifier;
                    break;
                case "removeAttendee":
                    response.intent = 'REMOVE_ATTENDEE';
                    response.eventIdentifier = anyArgs.eventIdentifier;
                    response.contactIdentifier = anyArgs.contactIdentifier;
                    break;
                case "getMetrics":
                    response.intent = 'METRICS_DATA';
                    response.metricsRequest = args;
                    break;
                default:
                    response.intent = 'GENERAL_QUERY';
                    response.responseText = "I understood the action but don't know how to handle it.";
            }

            logger.info("[GEMINI] Transformed to structured response:", JSON.stringify(response, null, 2));
            return response;
        }

        logger.warn("[GEMINI] No function call was returned by the model.");
        return { intent: "GENERAL_QUERY", responseText: "I'm sorry, I could not determine a specific action to take." };

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