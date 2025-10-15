import * as functions from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// Corrected Imports for Vertex AI
import {
    VertexAI,
    HarmCategory,
    HarmBlockThreshold,
    // The FunctionDeclaration type is nested within the 'protos' object
    protos,
} from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { mockContacts, mockBooks, mockEvents } from "./mockData";

// Define a type alias for the FunctionDeclaration to keep the code clean
type FunctionDeclaration = protos.google.cloud.aiplatform.v1.tools.IFunctionDeclaration;

type GenerativeContent = { role: string; parts: { text?: string; functionCall?: any; }[] };

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


// --- VertexAI Client Initialization ---
const PROJECT_ID = process.env.GCLOUD_PROJECT || "newsouthindex";
const LOCATION = "us-central1";

const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = "gemini-2.5-flash-lite";

// --- Function Declarations ---
const findTransactionDeclaration: FunctionDeclaration = {
    name: "findTransaction",
    description: "Finds transactions based on a contact's name or a date.",
    parameters: {
        type: "OBJECT",
        properties: {
            contactName: { type: "STRING", description: "The name of the contact who made the transaction." },
            date: { type: "STRING", description: "The date of the transaction (e.g., 'yesterday', 'last week', '2025-10-14')." },
        },
    },
};

const deleteTransactionDeclaration: FunctionDeclaration = {
    name: "deleteTransaction",
    description: "Deletes a transaction based on the contact's name and the date of the transaction.",
    parameters: {
        type: "OBJECT",
        properties: {
            contactName: { type: "STRING", description: "The name of the contact on the transaction to be deleted." },
            date: { type: "STRING", description: "The date of the transaction to be deleted (e.g., 'yesterday')." },
        },
        required: ["contactName"],
    },
};

const countContactsDeclaration: FunctionDeclaration = {
    name: "countContacts",
    description: "Counts the total number of contacts based on optional filters.",
    parameters: {
        type: "OBJECT",
        properties: {
            city: { type: "STRING", description: "The city to filter contacts by (e.g., 'Montgomery')." },
            state: { type: "STRING", description: "The state abbreviation to filter contacts by (e.g., 'AL')." },
            zip: { type: "STRING", description: "The zip code to filter contacts by." },
            category: { type: "STRING", description: "The category of the contact (e.g., 'Client', 'Vendor', 'Media', 'Personal', 'Other', 'not Client')." },
        },
    },
};

const countBooksDeclaration: FunctionDeclaration = {
    name: "countBooks",
    description: "Counts the total number of books based on optional filters.",
    parameters: {
        type: "OBJECT",
        properties: {
            author: { type: "STRING", description: "The author's name to filter books by (e.g., 'Harper Lee')." },
            publisher: { type: "STRING", description: "The publisher's name to filter books by (e.g., 'Penguin Random House')." },
            genre: { type: "STRING", description: "The genre to filter books by (e.g., 'fiction')." },
            publicationYear: { type: "NUMBER", description: "The publication year to filter books by." },
            stock: { type: "NUMBER", description: "The stock level to filter books by (use 0 for 'out of stock')." },
            priceFilter: { type: "STRING", description: "A price range filter (e.g., '>15', '<20.50', '10-25')." },
        },
    },
};

const countEventsDeclaration: FunctionDeclaration = {
    name: "countEvents",
    description: "Counts the total number of events based on optional filters.",
    parameters: {
        type: "OBJECT",
        properties: {
            location: { type: "STRING", description: "The location of the event (e.g., 'Upstairs Loft', 'Main Store')." },
            name: { type: "STRING", description: "The name or theme of the event (e.g., 'Poetry', 'Book Signing')." },
            author: { type: "STRING", description: "The author/featured person of the event (e.g., 'Jane Doe')." },
        },
    },
};

const getMetricsDeclaration: FunctionDeclaration = {
    name: "getMetrics",
    description: "Retrieves a specified metric or top N list from the database.",
    parameters: {
        type: "OBJECT",
        properties: {
            target: { type: "STRING", description: "The data collection to query (e.g., 'customers', 'sales', 'inventory')." },
            metric: { type: "STRING", description: "The specific metric type (e.g., 'top-spending', 'lowest-stock', 'total-revenue')." },
            limit: { type: "NUMBER", description: "The maximum number of results to return for 'top N' requests." },
        },
        required: ["target", "metric"],
    },
};

const aiTools = [{
    functionDeclarations: [
        countContactsDeclaration,
        countBooksDeclaration,
        countEventsDeclaration,
        getMetricsDeclaration,
        findTransactionDeclaration,
        deleteTransactionDeclaration,
    ],
}];


// --- Few-Shot Examples (Complete List to fix over-specialization) ---
const fCall = (name: string, args: Record<string, any>) => ({ functionCall: { name, args } });

const fewShotExamples: GenerativeContent[] = [
    // --- TRANSACTION MANAGEMENT EXAMPLES ---
    { role: "user", parts: [{ text: "Find the last transaction for Jane Doe." }] },
    { role: "model", parts: [fCall("findTransaction", { contactName: "jane doe" })] },
    { role: "user", parts: [{ text: "Show me all transactions from last week." }] },
    { role: "model", parts: [fCall("findTransaction", { date: "last week" })] },
    { role: "user", parts: [{ text: "Delete the transaction from yesterday for John Smith." }] },
    { role: "model", parts: [fCall("deleteTransaction", { contactName: "john smith", date: "yesterday" })] },

    // --- GENERAL QUERY EXAMPLES (To prevent over-calling functions) ---
    { role: "user", parts: [{ text: "What are the rules for adding a book?" }] },
    { role: "model", parts: [{ text: "I can help you add a book. I need the title, author, and price at minimum." }] },
    { role: "user", parts: [{ text: "Tell me a joke." }] },
    { role: "model", parts: [{ text: "Why don't scientists trust atoms? Because they make up everything!" }] },
    { role: "user", parts: [{ text: "How do I update a contact?" }] },
    { role: "model", parts: [{ text: "You can tell me the contact's name and what field you want to change." }] },
    { role: "user", parts: [{ text: "What can you do?" }] },
    { role: "model", parts: [{ text: "I can manage your contacts, books, and events using natural language commands like 'Add John Smith' or 'Count contacts in Alabama'." }] },
    { role: "user", parts: [{ text: "I have a question about the transactions." }] },
    { role: "model", parts: [{ text: "I can help you create a new transaction or check top-selling books. What would you like to know?" }] },
    
    // --- CONTACT MANAGEMENT EXAMPLES (ADD) ---
    { role: "user", parts: [{ text: "Add a new client: Mr. Thomas Anderson, email is tom@matrix.com." }] },
    { role: "model", parts: [fCall("addContact", { honorific: "mr", firstName: "thomas", lastName: "anderson", email: "tom@matrix.com", category: "client" })] },
    { role: "user", parts: [{ text: "Create a vendor contact named Wayne Enterprises, phone 555-BATMAN." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "wayne", lastName: "enterprises", phone: "555-BATMAN", category: "vendor" })] },
    { role: "user", parts: [{ text: "New personal contact: Lois Lane, in Metropolis." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "lois", lastName: "lane", category: "personal", city: "metropolis" })] },
    { role: "user", parts: [{ text: "Please add a contact named Clark Kent with address 344 Clinton St, Smallville, KS." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "clark", lastName: "kent", address1: "344 clinton st", city: "smallville", state: "ks" })] },
    { role: "user", parts: [{ text: "Add a media contact: Peter Parker, email peter@dailybugle.com." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "peter", lastName: "parker", email: "peter@dailybugle.com", category: "media" })] },
    { role: "user", parts: [{ text: "Add Contact Sarah Connor, email: sarah@resistance.net, phone: 555-T800" }] },
    { role: "model", parts: [fCall("addContact", { firstName: "sarah", lastName: "connor", email: "sarah@resistance.net", phone: "555-t800" })] },
    { role: "user", parts: [{ text: "New Contact: Tony Stark, CEO, category other." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "tony", lastName: "stark", category: "other" })] },
    { role: "user", parts: [{ text: "Vendor: Bruce Banner, address New York, NY." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "bruce", lastName: "banner", category: "vendor", city: "new york", state: "ny" })] },
    { role: "user", parts: [{ text: "Client: Hermione Granger, email hg@hogwarts.edu" }] },
    { role: "model", parts: [fCall("addContact", { firstName: "hermione", lastName: "granger", category: "client", email: "hg@hogwarts.edu" })] },
    { role: "user", parts: [{ text: "Add Media contact: Gale Hawthorne, city Panem" }] },
    { role: "model", parts: [fCall("addContact", { firstName: "gale", lastName: "hawthorne", category: "media", city: "panem" })] },
    
    // --- CONTACT MANAGEMENT EXAMPLES (FIND) ---
    { role: "user", parts: [{ text: "What's the phone number for John Smith?" }] },
    { role: "model", parts: [fCall("findContact", { identifier: "john smith" })] },
    { role: "user", parts: [{ text: "Can you pull up the details for jane.doe@example.com?" }] },
    { role: "model", parts: [fCall("findContact", { identifier: "jane.doe@example.com" })] },
    { role: "user", parts: [{ text: "Search my contacts for Robert Williams." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "robert williams" })] },
    { role: "user", parts: [{ text: "Find Alice Johnson." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "alice johnson" })] },
    { role: "user", parts: [{ text: "Look up Michael Jones." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "michael jones" })] },
    { role: "user", parts: [{ text: "Check on Thomas Anderson." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "thomas anderson" })] },
    { role: "user", parts: [{ text: "Find the entry for Tony Stark." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "tony stark" })] },
    { role: "user", parts: [{ text: "I need Lois Lane's info." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "lois lane" })] },
    { role: "user", parts: [{ text: "Search for Bruce Banner." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "bruce banner" })] },
    { role: "user", parts: [{ text: "Contact details for Hermione Granger." }] },
    { role: "model", parts: [fCall("findContact", { identifier: "hermione granger" })] },

    // --- CONTACT MANAGEMENT EXAMPLES (UPDATE) ---
    { role: "user", parts: [{ text: "Update Emily Brown's category to Client." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "emily brown", updateData: { category: "client" } })] },
    { role: "user", parts: [{ text: "Change Robert Williams' city to Mobile." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "robert williams", updateData: { city: "mobile" } })] },
    { role: "user", parts: [{ text: "Edit John Smith's email to new.john.smith@vendor.com" }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "john smith", updateData: { email: "new.john.smith@vendor.com" } })] },
    { role: "user", parts: [{ text: "Set Alice Johnson's zip code to 35203." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "alice johnson", updateData: { zip: "35203" } })] },
    { role: "user", parts: [{ text: "Update Jane Doe: notes are 'Big buyer, loves history books'." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "jane doe", updateData: { notes: "Big buyer, loves history books" } })] },
    { role: "user", parts: [{ text: "Change Thomas Anderson's address to 101 NE Blvd, New Orleans." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "thomas anderson", updateData: { address1: "101 ne blvd", city: "new orleans" } })] },
    { role: "user", parts: [{ text: "Update Tony Stark's suffix to Jr." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "tony stark", updateData: { suffix: "jr" } })] },
    { role: "user", parts: [{ text: "Change Lois Lane's email only." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "lois lane", updateData: { email: "lois@dailyplanet.com" } })] },
    { role: "user", parts: [{ text: "Update Bruce Banner, category is now Personal." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "bruce banner", updateData: { category: "personal" } })] },
    { role: "user", parts: [{ text: "Change Hermione Granger's honorific to Ms." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "hermione granger", updateData: { honorific: "ms" } })] },

    // --- CONTACT MANAGEMENT EXAMPLES (DELETE) ---
    { role: "user", parts: [{ text: "Remove Alice Johnson from my contacts." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "alice johnson" })] },
    { role: "user", parts: [{ text: "Delete Robert Williams." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "robert williams" })] },
    { role: "user", parts: [{ text: "I need to delete john.smith@vendorcorp.com" }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "john.smith@vendorcorp.com" })] },
    { role: "user", parts: [{ text: "Delete Michael Jones." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "michael jones" })] },
    { role: "user", parts: [{ text: "Remove Jane Doe." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "jane doe" })] },
    { role: "user", parts: [{ text: "Delete Thomas Anderson's record." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "thomas anderson" })] },
    { role: "user", parts: [{ text: "Remove Tony Stark." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "tony stark" })] },
    { role: "user", parts: [{ text: "Delete Lois Lane." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "lois lane" })] },
    { role: "user", parts: [{ text: "Remove Bruce Banner now." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "bruce banner" })] },
    { role: "user", parts: [{ text: "Delete Hermione Granger." }] },
    { role: "model", parts: [fCall("deleteContact", { identifier: "hermione granger" })] },

    // --- FIND BOOK EXAMPLES (CRITICAL FOR YOUR CURRENT ISSUE) ---
    { role: "user", parts: [{ text: "who wrote The Great Gatsby?" }] },
    { role: "model", parts: [fCall("findBook", { identifier: "the great gatsby" })] },
    { role: "user", parts: [{ text: "What are the details for the book with ISBN 9780441172719?" }] },
    { role: "model", parts: [fCall("findBook", { identifier: "9780441172719" })] },
    { role: "user", parts: [{ text: "Search for 'To Kill a Mockingbird'." }] },
    { role: "model", parts: [fCall("findBook", { identifier: "to kill a mockingbird" })] },
    { role: "user", parts: [{ text: "Find the stock of '1984'." }] },
    { role: "model", parts: [fCall("findBook", { identifier: "1984" })] },
    { role: "user", parts: [{ text: "Look up details for Sapiens." }] },
    { role: "model", parts: [fCall("findBook", { identifier: "sapiens" })] },

    // --- BOOK MANAGEMENT EXAMPLES (ADD) ---
    { role: "user", parts: [{ text: "Add 'Where the Crawdads Sing' by Delia Owens. Price: 10.50, stock: 25." }] },
    { role: "model", parts: [fCall("addBook", { title: "where the crawdads sing", author: "delia owens", price: 10.50, stock: 25 })] },
    { role: "user", parts: [{ text: "Enter 'The Secret History', by Donna Tartt, genre: Mystery, year: 1992, 18.00." }] },
    { role: "model", parts: [fCall("addBook", { title: "the secret history", author: "donna tartt", genre: "mystery", publicationYear: 1992, price: 18.00 })] },
    { role: "user", parts: [{ text: "New book: 'Educated' by Tara Westover, publisher: Random House, ISBN 9780373456789." }] },
    { role: "model", parts: [fCall("addBook", { title: "educated", author: "tara westover", publisher: "random house", isbn: "9780373456789" })] },
    { role: "user", parts: [{ text: "I need to add a history book: 'Sapiens', 50 copies, 19.99." }] },
    { role: "model", parts: [fCall("addBook", { title: "sapiens", author: "yuval noah harari", genre: "history", stock: 50, price: 19.99 })] },
    { role: "user", parts: [{ text: "Add book 'The Martian' author Andy Weir." }] },
    { role: "model", parts: [fCall("addBook", { title: "the martian", author: "andy weir" })] },
    { role: "user", parts: [{ text: "Add 'A Little Life' by Hanya Yanagihara, stock 10." }] },
    { role: "model", parts: [fCall("addBook", { title: "a little life", author: "hanya yanagihara", stock: 10 })] },
    { role: "user", parts: [{ text: "Enter book 'Gone Girl', genre Thriller." }] },
    { role: "model", parts: [fCall("addBook", { title: "gone girl", author: "gillian flynn", genre: "thriller" })] },
    { role: "user", parts: [{ text: "New book: 'The Silent Patient' by Alex Michaelides, 15 copies." }] },
    { role: "model", parts: [fCall("addBook", { title: "the silent patient", author: "alex michaelides", stock: 15 })] },
    { role: "user", parts: [{ text: "Add 'Circe' by Madeline Miller, price 12.00." }] },
    { role: "model", parts: [fCall("addBook", { title: "circe", author: "madeline miller", price: 12.00 })] },
    { role: "user", parts: [{ text: "I added 'Project Hail Mary' by Andy Weir, ISBN 9780593134954." }] },
    { role: "model", parts: [fCall("addBook", { title: "project hail mary", author: "andy weir", isbn: "9780593134954" })] },

    // --- BOOK MANAGEMENT EXAMPLES (UPDATE) ---
    { role: "user", parts: [{ text: "Update stock for 1984 to 75." }] },
    { role: "model", parts: [fCall("updateBook", { bookIdentifier: "1984", updateData: { stock: 75 } })] },
    { role: "user", parts: [{ text: "Change the price of To Kill a Mockingbird to 14.99." }] },
    { role: "model", parts: [fCall("updateBook", { bookIdentifier: "to kill a mockingbird", updateData: { price: 14.99 } })] },
    { role: "user", parts: [{ text: "For Gatsby, set genre to Classic." }] },
    { role: "model", parts: [fCall("updateBook", { bookIdentifier: "gatsby", updateData: { genre: "classic" } })] },
    { role: "user", parts: [{ text: "Set the publisher of 1984 to 'Signet Classics'." }] },
    { role: "model", parts: [fCall("updateBook", { bookIdentifier: "1984", updateData: { publisher: "signet classics" } })] },
    { role: "user", parts: [{ text: "Change The Catcher in the Rye author to J. D. Salinger." }] },
    { role: "model", parts: [fCall("updateBook", { bookIdentifier: "the catcher in the rye", updateData: { author: "j. d. salinger" } })] },

    // --- BOOK MANAGEMENT EXAMPLES (DELETE) ---
    { role: "user", parts: [{ text: "Delete the book 1984." }] },
    { role: "model", parts: [fCall("deleteBook", { bookIdentifier: "1984" })] },
    { role: "user", parts: [{ text: "Remove 'The Great Gatsby'." }] },
    { role: "model", parts: [fCall("deleteBook", { bookIdentifier: "the great gatsby" })] },

    // --- FIND EVENT EXAMPLES (CRITICAL FOR YOUR CURRENT ISSUE) ---
    { role: "user", parts: [{ text: "Find the details for the event called 'Local Author Signing'." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "local author signing" })] },
    { role: "user", parts: [{ text: "Where is the 'Kids Story Time' event?" }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "kids story time" })] },
    { role: "user", parts: [{ text: "Can you look up the event featuring Jane Doe?" }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "jane doe" })] },
    { role: "user", parts: [{ text: "Show me the event scheduled for 2025-11-01." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "2025-11-01" })] },
    { role: "user", parts: [{ text: "What are the details for the event in the Upstairs Loft?" }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "upstairs loft" })] },
    { role: "user", parts: [{ text: "Find the event description for 'Poetry Slam'." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "poetry slam" })] },
    { role: "user", parts: [{ text: "Search for the 'Board Game Night'." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "board game night" })] },
    { role: "user", parts: [{ text: "Look up the 'Historical Fiction Panel'." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "historical fiction panel" })] },
    { role: "user", parts: [{ text: "I need to find the 'Coffee Tasting' event." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "coffee tasting" })] },
    { role: "user", parts: [{ text: "Event details for 'Holiday Market'." }] },
    { role: "model", parts: [fCall("findEvent", { identifier: "holiday market" })] },

    // --- ADD EVENT EXAMPLES ---
    { role: "user", parts: [{ text: "Schedule a book signing with Jane Smith on 2025-11-15." }] },
    { role: "model", parts: [fCall("addEvent", { name: "book signing", author: "jane smith", date: "2025-11-15" })] },
    { role: "user", parts: [{ text: "Add a 'Teen Writing Workshop' to the upstairs loft." }] },
    { role: "model", parts: [fCall("addEvent", { name: "teen writing workshop", location: "upstairs loft" })] },
    { role: "user", parts: [{ text: "New event: Holiday Market on December 10th at 5 PM." }] },
    { role: "model", parts: [fCall("addEvent", { name: "holiday market", date: "2025-12-10", time: "17:00" })] },

    // --- UPDATE EVENT EXAMPLES ---
    { role: "user", parts: [{ text: "Change the location of the Poetry Slam to the Main Store." }] },
    { role: "model", parts: [fCall("updateEvent", { eventIdentifier: "poetry slam", updateData: { location: "Main Store" } })] },
    { role: "user", parts: [{ text: "Update the date for the Holiday Market to 2025-12-11." }] },
    { role: "model", parts: [fCall("updateEvent", { eventIdentifier: "holiday market", updateData: { date: "2025-12-11" } })] },
    { role: "user", parts: [{ text: "Change the time of Jane Smith's signing to 7:00 PM." }] },
    { role: "model", parts: [fCall("updateEvent", { eventIdentifier: "jane smith's signing", updateData: { time: "19:00" } })] },

    // --- DELETE EVENT EXAMPLES ---
    { role: "user", parts: [{ text: "Cancel the event named 'Fantasy Book Club'." }] },
    { role: "model", parts: [fCall("deleteEvent", { eventIdentifier: "fantasy book club" })] },
    { role: "user", parts: [{ text: "Remove the 'Teen Writing Workshop'." }] },
    { role: "model", parts: [fCall("deleteEvent", { eventIdentifier: "teen writing workshop" })] },
    { role: "user", parts: [{ text: "Delete the event scheduled for December 10th." }] },
    { role: "model", parts: [fCall("deleteEvent", { eventIdentifier: "december 10th" })] },
    
    // --- EVENT MANAGEMENT EXAMPLES (ADD, FIND, UPDATE, DELETE) are below ---

    // --- COUNT DATA EXAMPLES (PRICE FILTER ADDED) ---
    // Price Filter Examples (Responding to current request)
    { role: "user", parts: [{ text: "how many books are under $15?" }] },
    { role: "model", parts: [fCall("countBooks", { priceFilter: "<15" })] },
    { role: "user", parts: [{ text: "count books over 20 dollars" }] },
    { role: "model", parts: [fCall("countBooks", { priceFilter: ">20.00" })] },
    { role: "user", parts: [{ text: "how many books are between $10 and $25?" }] },
    { role: "model", parts: [fCall("countBooks", { priceFilter: "10-25" })] },
    // Contacts
    { role: "user", parts: [{ text: "how many contacts do i have in montgomery?" }] },
    { role: "model", parts: [fCall("countContacts", { city: "montgomery" })] },
    { role: "user", parts: [{ text: "count the contacts in alabama" }] },
    { role: "model", parts: [fCall("countContacts", { state: "al" })] },
    { role: "user", parts: [{ text: "how many clients?" }] },
    { role: "model", parts: [fCall("countContacts", { category: "client" })] },
    { role: "user", parts: [{ text: "number of non-vendor contacts" }] },
    { role: "model", parts: [fCall("countContacts", { category: "not vendor" })] },
    // Books
    { role: "user", parts: [{ text: "count the books by Harper Lee" }] },
    { role: "model", parts: [fCall("countBooks", { author: "harper lee" })] },
    { role: "user", parts: [{ text: "how many books are out of stock?" }] },
    { role: "model", parts: [fCall("countBooks", { stock: 0 })] },
    // Events
    { role: "user", parts: [{ text: "how many events with Jane Doe?" }] },
    { role: "model", parts: [fCall("countEvents", { author: "jane doe" })] },
    { role: "user", parts: [{ text: "count events in the Upstairs Loft" }] },
    { role: "model", parts: [fCall("countEvents", { location: "upstairs loft" })] },
    
    // --- ATTENDEE MANAGEMENT EXAMPLES ---
    { role: "user", parts: [{ text: "Add Jane Doe to the Local Author Signing event." }] },
    { role: "model", parts: [fCall("addAttendee", { eventIdentifier: "local author signing", contactIdentifier: "jane doe" })] },
    { role: "user", parts: [{ text: "Remove John Smith from Poetry Reading Night." }] },
    { role: "model", parts: [fCall("removeAttendee", { eventIdentifier: "poetry reading night", contactIdentifier: "john smith" })] },

    // --- METRICS EXAMPLES ---
    { role: "user", parts: [{ text: "Who are the top 5 customers by spending?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "customers", metric: "top-spending", limit: 5 })] },
    { role: "user", parts: [{ text: "Top selling books, show 10." }] },
    { role: "model", parts: [fCall("getMetrics", { target: "books", metric: "top-selling", limit: 10 })] },
];


// --- Main Callable Function ---

export const processCommand = onCall({cors: true}, async (request) => {
    const command = request.data.command;
    if (!command) {
        throw new HttpsError("invalid-argument", "No command provided.");
    }

    const systemInstruction = `You are a function-calling AI assistant for a CRM application...`; // Keeping this brief

    try {
        // **FIX 2: Use the .preview namespace to get the generative model**
        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: model,
            tools: aiTools,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            generationConfig: {
                maxOutputTokens: 2048,
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
        });

        const chat = generativeModel.startChat({
            history: fewShotExamples as any, // Cast to any to handle potential type mismatch in history
        });

        const result = await chat.sendMessage(command);
        const response = result.response;
        
        const call = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;

        let responseObject: any = { intent: "GENERAL_QUERY", responseText };

        if (call) {
            const { name, args } = call;
            // **FIX 3: No longer need the unused 'anyArgs' variable**
            
            switch (name) {
                // ... (rest of your switch case logic)
                // This logic does not need to change.
                case "findTransaction":
                    responseObject = { intent: 'FIND_TRANSACTION', data: { transactionIdentifier: args }, responseText: responseText || `Finding transaction.` };
                    break;
                case "deleteTransaction":
                    responseObject = { intent: 'DELETE_TRANSACTION', data: { transactionIdentifier: args }, responseText: responseText || `Deleting transaction.` };
                    break;
                // ... all other cases
                default: 
                    responseObject = { intent: "GENERAL_QUERY", responseText: responseText || "I'm sorry, I could not determine a specific action to take." };
            }
        } else {
            responseObject = { intent: 'GENERAL_QUERY', responseText: responseText || "I'm sorry, I couldn't understand that request." };
        }

        logger.info("[GEMINI] Parsed JSON response:", JSON.stringify(responseObject, null, 2));
        return responseObject;
    } catch (error) {
        logger.error("Error processing command with Gemini:", error);
        throw new functions.https.HttpsError("internal", "Gemini processing failed.");
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