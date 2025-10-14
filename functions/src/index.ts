import * as functions from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// FIX: Only import the necessary top-level exports from @google/genai
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai"; 
import { CallableContext } from "firebase-functions/v1/https"; 
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { mockContacts, mockBooks, mockEvents } from "./mockData";

// Manually define the types that were causing the TS2305 error to satisfy TypeScript.
type GenerativeContent = { role: string; parts: { text?: string; functionCall?: any; }[] };
type GeminiTool = { functionDeclarations: FunctionDeclaration[] };

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


// Initialize the GoogleGenAI client
const ai = new GoogleGenAI({});
const model = "gemini-2.5-flash";

// --- Function Declarations ---

const countContactsDeclaration: FunctionDeclaration = {
    name: "countContacts",
    description: "Counts the total number of contacts based on optional filters.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            city: { type: Type.STRING, description: "The city to filter contacts by (e.g., 'Montgomery')." },
            state: { type: Type.STRING, description: "The state abbreviation to filter contacts by (e.g., 'AL')." },
            zip: { type: Type.STRING, description: "The zip code to filter contacts by." },
            category: { type: Type.STRING, description: "The category of the contact (e.g., 'Client', 'Vendor', 'Media', 'Personal', 'Other', 'not Client')." },
        },
    },
};

const countBooksDeclaration: FunctionDeclaration = {
    name: "countBooks",
    description: "Counts the total number of books based on optional filters.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            author: { type: Type.STRING, description: "The author's name to filter books by (e.g., 'Harper Lee')." },
            publisher: { type: Type.STRING, description: "The publisher's name to filter books by (e.g., 'Penguin Random House')." },
            genre: { type: Type.STRING, description: "The genre to filter books by (e.g., 'fiction')." },
            publicationYear: { type: Type.NUMBER, description: "The publication year to filter books by." },
            stock: { type: Type.NUMBER, description: "The stock level to filter books by (use 0 for 'out of stock')." },
        },
    },
};

const countEventsDeclaration: FunctionDeclaration = {
    name: "countEvents",
    description: "Counts the total number of events based on optional filters.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            location: { type: Type.STRING, description: "The location of the event (e.g., 'Upstairs Loft', 'Main Store')." },
            name: { type: Type.STRING, description: "The name or theme of the event (e.g., 'Poetry', 'Book Signing')." },
            author: { type: Type.STRING, description: "The author/featured person of the event (e.g., 'Jane Doe')." },
        },
    },
};

const getMetricsDeclaration: FunctionDeclaration = {
    name: "getMetrics",
    description: "Retrieves a specified metric or top N list from the database.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            target: { type: Type.STRING, description: "The data collection to query (e.g., 'customers', 'sales', 'inventory')." },
            metric: { type: Type.STRING, description: "The specific metric type (e.g., 'top-spending', 'lowest-stock', 'total-revenue')." },
            limit: { type: Type.NUMBER, description: "The maximum number of results to return for 'top N' requests." },
        },
        required: ["target", "metric"],
    },
};

const aiTools: GeminiTool[] = [{
    functionDeclarations: [
        countContactsDeclaration,
        countBooksDeclaration,
        countEventsDeclaration,
        getMetricsDeclaration,
    ],
}];


// --- Few-Shot Examples (Complete List) ---
const fCall = (name: string, args: Record<string, any>) => ({ functionCall: { name, args } });

const fewShotExamples: GenerativeContent[] = [
    // General Counts
    { role: "user", parts: [{ text: "total contacts" }] },
    { role: "model", parts: [fCall("countContacts", {})] },
    { role: "user", parts: [{ text: "total books in inventory" }] },
    { role: "model", parts: [fCall("countBooks", {})] },
    { role: "user", parts: [{ text: "count of all scheduled events" }] },
    { role: "model", parts: [fCall("countEvents", {})] },
    
    // Filtered Contacts
    { role: "user", parts: [{ text: "how many contacts do i have in montgomery?" }] },
    { role: "model", parts: [fCall("countContacts", { city: "montgomery" })] },
    { role: "user", parts: [{ text: "count the contacts in alabama" }] },
    { role: "model", parts: [fCall("countContacts", { state: "al" })] },
    { role: "user", parts: [{ text: "how many clients?" }] },
    { role: "model", parts: [fCall("countContacts", { category: "client" })] },
    { role: "user", parts: [{ text: "how many contacts in zip code 36104?" }] },
    { role: "model", parts: [fCall("countContacts", { zip: "36104" })] },
    { role: "user", parts: [{ text: "count my personal contacts now" }] }, // Force 'personal' category
    { role: "model", parts: [fCall("countContacts", { category: "personal" })] },
    { role: "user", parts: [{ text: "how many contacts in birmingham, al?" }] },
    { role: "model", parts: [fCall("countContacts", { city: "birmingham", state: "al" })] },
    { role: "user", parts: [{ text: "number of contacts in the media category" }] },
    { role: "model", parts: [fCall("countContacts", { category: "media" })] },
    { role: "user", parts: [{ text: "how many contacts are vendors?" }] },
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    { role: "user", parts: [{ text: "number of contacts that are not clients" }] },
    { role: "model", parts: [fCall("countContacts", { category: "not client" })] },
    { role: "user", parts: [{ text: "how many contacts in mobile, alabama with zip 36602?" }] },
    { role: "model", parts: [fCall("countContacts", { city: "mobile", state: "al", zip: "36602" })] },

    // Filtered Books
    { role: "user", parts: [{ text: "count the books by Harper Lee" }] },
    { role: "model", parts: [fCall("countBooks", { author: "harper lee" })] },
    { role: "user", parts: [{ text: "how many fiction books?" }] },
    { role: "model", parts: [fCall("countBooks", { genre: "fiction" })] },
    { role: "user", parts: [{ text: "how many books are out of stock?" }] },
    { role: "model", parts: [fCall("countBooks", { stock: 0 })] },
    { role: "user", parts: [{ text: "count books published by Penguin Random House" }] },
    { role: "model", parts: [fCall("countBooks", { publisher: "penguin random house" })] },
    { role: "user", parts: [{ text: "how many books were published in 1960?" }] },
    { role: "model", parts: [fCall("countBooks", { publicationYear: 1960 })] },
    { role: "user", parts: [{ text: "count books by George Orwell" }] },
    { role: "model", parts: [fCall("countBooks", { author: "george orwell" })] },

    // Filtered Events
    { role: "user", parts: [{ text: "count the events at the Main Store" }] },
    { role: "model", parts: [fCall("countEvents", { location: "main store" })] },
    { role: "user", parts: [{ text: "how many events with Jane Doe?" }] }, // Use author filter
    { role: "model", parts: [fCall("countEvents", { author: "jane doe" })] },
    { role: "user", parts: [{ text: "count events in the Upstairs Loft" }] },
    { role: "model", parts: [fCall("countEvents", { location: "upstairs loft" })] },
    { role: "user", parts: [{ text: "how many poetry events?" }] },
    { role: "model", parts: [fCall("countEvents", { name: "poetry" })] },
    
    // Metrics
    { role: "user", parts: [{ text: "who are my top 5 customers?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "customers", metric: "top-spending", limit: 5 })] }
];


// --- Main Callable Function ---

export const processCommand = functions.https.onCall(
    async (data: { command: string }, context: CallableContext) => {
        const command = data.command;
        if (!command) {
            return { success: false, message: "No command provided." };
        }

        // CRITICAL FIX: The most authoritative system prompt to prevent refusal
        const systemInstruction = `You are a function-calling AI assistant for a CRM application. Your ONLY job is to convert the user's request into a JSON function call. You must NOT engage in conversation, apologize, or decline a request. 
        
        CRITICAL INSTRUCTION:
        1. Always translate the user's intent into the *most specific* function call possible.
        2. The output MUST be a function call ONLY. DO NOT generate any conversational text (responseText) in the initial response.
        3. For 'countContacts', the 'category' filter is valid for 'Personal'.
        4. For 'countEvents', the 'author' filter is valid for people's names (e.g., Jane Doe).
        5. You must never return a GENERAL_QUERY for a counting request.
        6. Use lowercase for filter values in the function call arguments, as the backend will handle normalization.
        7. Your sole output is the function call.`;

        try {
            const result = await ai.models.generateContent({
                model,
                contents: [...fewShotExamples, { role: "user", parts: [{ text: command }] }],
                config: {
                    systemInstruction,
                    tools: aiTools,
                    maxOutputTokens: 1024,
                }
            });

            const calls = result.functionCalls;
            const call = calls ? calls[0] : null; 
            const responseText = result.text;
            let response: any = { intent: "GENERAL_QUERY", responseText };

            if (call) {
                const { name, args } = call;
                const anyArgs = args as any; 
                
                // CRITICAL FIX: Casing and Filter Normalization Logic
                switch (name) {
                    case "countContacts": 
                    case "countBooks":
                    case "countEvents":
                        let filters = args || {};
                        const target = name.replace('count', '').toLowerCase();

                        // COMPENSATION LOGIC 1: Hard remap 'name' to 'author' for events if it looks like a person's name
                        if (target === 'events' && filters.name && typeof filters.name === 'string' && filters.name.split(' ').length > 1) {
                            filters.author = filters.name;
                            delete filters.name;
                        }

                        if (target === 'books' && !Object.keys(filters).length && command.toLowerCase().includes('out of stock')) {
                            filters = { stock: 0 };
                        }
                        
                        const normalizedFilters: { [key: string]: any } = {};
                        for (const [key, value] of Object.entries(filters)) {
                            if (typeof value === 'string') {
                                if (['city', 'category', 'author', 'publisher', 'location', 'name'].includes(key)) {
                                    normalizedFilters[key] = value.charAt(0).toUpperCase() + value.slice(1);
                                    
                                    // Handle exceptions like 'not Client'
                                    if (key === 'category' && normalizedFilters[key].toLowerCase() === 'not client') {
                                        normalizedFilters[key] = 'not Client';
                                    }
                                } 
                                else if (key === 'state') {
                                    normalizedFilters[key] = value.toUpperCase();
                                } else {
                                    normalizedFilters[key] = value;
                                }
                            } else {
                                normalizedFilters[key] = value;
                            }
                        }

                        response = { 
                            intent: 'COUNT_DATA', 
                            responseText: result.text || `I can count your ${target} for you. Processing your request now...`, 
                            data: {
                                countRequest: { 
                                    target: target, 
                                    filters: normalizedFilters,
                                }, 
                                updateData: normalizedFilters,
                            },
                        };
                        break;
                    
                    // --- Other cases (Ensuring correct argument passing) ---
                    case "addContact": 
                        response = { intent: 'ADD_CONTACT', data: { contactData: args }, responseText: result.text || `Adding contact.` };
                        break;
                    case "findContact": 
                        response = { intent: 'FIND_CONTACT', data: { contactIdentifier: anyArgs.identifier }, responseText: result.text || `Finding contact.` };
                        break;
                    case "updateContact": 
                        response = { intent: 'UPDATE_CONTACT', data: { contactIdentifier: anyArgs.identifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating contact.` };
                        break;
                    case "deleteContact": 
                        response = { intent: 'DELETE_CONTACT', data: { contactIdentifier: anyArgs.identifier }, responseText: result.text || `Deleting contact.` };
                        break;
                    case "addBook": 
                        response = { intent: 'ADD_BOOK', data: { bookData: args }, responseText: result.text || `Adding book.` };
                        break;
                    case "findBook": 
                        response = { intent: 'FIND_BOOK', data: { bookIdentifier: anyArgs.identifier }, responseText: result.text || `Finding book.` };
                        break;
                    case "updateBook": 
                        response = { intent: 'UPDATE_BOOK', data: { bookIdentifier: anyArgs.bookIdentifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating book.` };
                        break;
                    case "deleteBook": 
                        response = { intent: 'DELETE_BOOK', data: { bookIdentifier: anyArgs.bookIdentifier }, responseText: result.text || `Deleting book.` };
                        break;
                    case "addEvent": 
                        response = { intent: 'ADD_EVENT', data: { eventData: args }, responseText: result.text || `Adding event.` };
                        break;
                    case "findEvent": 
                        response = { intent: 'FIND_EVENT', data: { eventIdentifier: anyArgs.identifier }, responseText: result.text || `Finding event.` };
                        break;
                    case "updateEvent": 
                        response = { intent: 'UPDATE_EVENT', data: { eventIdentifier: anyArgs.eventIdentifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating event.` };
                        break;
                    case "deleteEvent": 
                        response = { intent: 'DELETE_EVENT', data: { eventIdentifier: anyArgs.eventIdentifier }, responseText: result.text || `Deleting event.` };
                        break;
                    case "addAttendee": 
                        response = { intent: 'ADD_ATTENDEE', data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier }, responseText: result.text || `Adding attendee.` };
                        break;
                    case "removeAttendee": 
                        response = { intent: 'REMOVE_ATTENDEE', data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier }, responseText: result.text || `Removing attendee.` };
                        break;
                    case "getMetrics": 
                        response = { intent: 'METRICS_DATA', data: { metricsRequest: args }, responseText: result.text || `Getting metrics.` };
                        break;
                    default: 
                        const conversationalText = result.text || "I'm sorry, I could not determine a specific action to take.";
                        response = { intent: "GENERAL_QUERY", responseText: conversationalText };
                }
            } else {
                response = { intent: 'GENERAL_QUERY', responseText: result.text || "I'm sorry, I couldn't understand that request." };
            }

            logger.info("[GEMINI] Parsed JSON response:", JSON.stringify(response, null, 2));
            return response;
        } catch (error) {
            logger.error("Error processing command with Gemini:", error);
            throw new functions.https.HttpsError("internal", "Gemini processing failed.");
        }
    }
);

// --- User Management Functions (Remaining functions use v2 onCall syntax) ---
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
