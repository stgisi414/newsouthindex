import { onCall, HttpsError, onRequest, Request } from "firebase-functions/v2/https";
import { auth } from "firebase-functions/v1";
import { Response } from "express";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { mockContacts, mockBooks, mockEvents } from "./mockData";
import { google } from "googleapis"; // <-- 'google' is imported...
import { Category } from "./types"
// Removed cors import as we handle it manually or via onCall config

const Customer = google.firestore("v1");

// Your GCS bucket name
const BUCKET_NAME = "gs://nsindx-backup";

export const backupFirestore = onRequest(
  {
    timeoutSeconds: 540, // Runtime options go here
    memory: "256MiB",
    invoker: "private",
  },
  async (req: Request, res: Response) => { // <-- Types go here
    // We use process.env.GCP_PROJECT for the project ID
    const projectId = process.env.GCP_PROJECT;
    if (!projectId) {
      res.status(500).send("GCP_PROJECT environment variable not set.");
      return;
    }

    const databaseName = `projects/${projectId}/databases/(default)`;
    
    // Create a new backup folder with a timestamp
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const outputUriPrefix = `${BUCKET_NAME}/backups/${timestamp}`;

    try {
      // Start the export operation
      await Customer.projects.databases.exportDocuments({
        name: databaseName,
        requestBody: {
          outputUriPrefix: outputUriPrefix,
        },
      });

      const message = `Firestore export started to ${outputUriPrefix}`;
      console.log(message);
      res.status(200).send(message);

    } catch (err) {
      console.error(err);
      res.status(500).send("Error starting Firestore export.");
    }
  }
);

// Manually define the types that were causing the TS2305 error to satisfy TypeScript.
type GenerativeContent = { role: string; parts: { text?: string; functionCall?: any; }[] };
type GeminiTool = { functionDeclarations: FunctionDeclaration[] };

admin.initializeApp();

// --- Function Declarations ---

/* const findTransactionDeclaration: FunctionDeclaration = {
    name: "findTransaction",
    description: "Finds transactions based on a contact's name or a date.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            contactName: { type: Type.STRING, description: "The name of the contact who made the transaction." },
            date: { type: Type.STRING, description: "The date of the transaction (e.g., 'yesterday', 'last week', '2025-10-14')." },
        },
    },
};

const deleteTransactionDeclaration: FunctionDeclaration = {
    name: "deleteTransaction",
    description: "Deletes a transaction based on the contact's name and the date of the transaction.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            contactName: { type: Type.STRING, description: "The name of the contact on the transaction to be deleted." },
            date: { type: Type.STRING, description: "The date of the transaction to be deleted (e.g., 'yesterday')." },
        },
        required: ["contactName"],
    },
}; */

const countContactsDeclaration: FunctionDeclaration = {
    name: "countContacts",
    description: "Counts the total number of contacts based on optional filters.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            city: { type: Type.STRING, description: "The city to filter contacts by (e.g., 'Montgomery')." },
            state: { type: Type.STRING, description: "The state abbreviation to filter contacts by (e.g., 'AL')." },
            zip: { type: Type.STRING, description: "The zip code to filter contacts by." },
            category: {
              type: Type.ARRAY,
              description: "A list of categories to filter contacts by (e.g., ['Customer', 'Vendor']).",
              items: {
                type: Type.STRING,
                enum: Object.values(Category),
              },
            },
        },
    },
};

/* const countBooksDeclaration: FunctionDeclaration = {
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
            priceFilter: { type: Type.STRING, description: "A price range filter (e.g., '>15', '<20.50', '10-25')." },
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
            contactIdentifier: { type: Type.STRING, description: "The name of the contact for a specific metric." }
        },
        required: ["target", "metric"],
    },
};  */

const logInteractionDeclaration: FunctionDeclaration = {
  name: "logInteraction",
  description: "Logs a new interaction (like a phone call, email, or meeting) with a specific contact.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactIdentifier: {
        type: Type.STRING,
        description: "The name or email of the contact the interaction was with. e.g., 'jane doe' or 'jane@example.com'"
      },
      interactionData: {
        type: Type.OBJECT,
        description: "The details of the interaction.",
        properties: {
          type: {
            type: Type.STRING,
            description: "The type of interaction. e.g., 'phone', 'email', 'meeting', 'note'"
          },
          notes: {
            type: Type.STRING,
            description: "The content or notes from the interaction. e.g., 'discussed new sci-fi arrivals'"
          }
        },
        required: ["notes"]
      }
    },
    required: ["contactIdentifier", "interactionData"]
  }
};

// Add this declaration too
const getCustomerSummaryDeclaration: FunctionDeclaration = {
    name: "getCustomerSummary",
    description: "Gets a complete 360-degree summary of a single customer, including their contact details, transaction history, and event attendance.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactIdentifier: {
        type: Type.STRING,
        description: "The name or email of the contact to summarize. e.g., 'tony stark' or 'tony@stark.com'"
      }
    },
    required: ["contactIdentifier"]
  }
};

const findExpenseReportDeclaration: FunctionDeclaration = {
  name: "findExpenseReport",
  description: "Finds expense reports based on staff name, status, or report number.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      staffName: { type: Type.STRING, description: "The name of the staff member on the report (e.g., 'Test2 Contact2')." },
      status: { type: Type.STRING, description: "The status of the report (e.g., 'Submitted', 'Draft')." },
      reportNumber: { type: Type.NUMBER, description: "The report number (e.g., 1003)." },
    },
  },
};

const countExpenseReportsDeclaration: FunctionDeclaration = {
  name: "countExpenseReports",
  description: "Counts expense reports based on status or staff name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      staffName: { type: Type.STRING, description: "The name of the staff member." },
      status: { type: Type.STRING, description: "The status to filter by (e.g., 'Submitted', 'Draft')." },
    },
  },
};

const addContactDeclaration: FunctionDeclaration = {
  name: "addContact",
  description: "Adds a new contact to the database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      firstName: { type: Type.STRING, description: "The contact's first name." },
      lastName: { type: Type.STRING, description: "The contact's last name." },
      honorific: { type: Type.STRING, description: "The contact's title (e.g., Mr, Ms, Dr)." },
      email: { type: Type.STRING, description: "The contact's email address." },
      phone: { type: Type.STRING, description: "The contact's phone number." },
      category: {
        type: Type.ARRAY,
        description: "A list of categories for the contact (e.g., ['Customer', 'Vendor']).",
        items: {
          type: Type.STRING,
          enum: Object.values(Category),
        },
      },
      address1: { type: Type.STRING, description: "The contact's street address." },
      city: { type: Type.STRING, description: "The contact's city." },
      state: { type: Type.STRING, description: "The contact's state (2-letter abbreviation)." },
      zip: { type: Type.STRING, description: "The contact's zip code." },
      sendTNSBNewsletter: { type: Type.BOOLEAN, description: "Whether the contact wants to receive the TNSB Newsletter." },
    },
    required: ["firstName", "lastName"],
  },
};

const findContactDeclaration: FunctionDeclaration = {
  name: "findContact",
  description: "Finds contacts by name, email, or filters. Can return a list or a single contact.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      identifier: {
        type: Type.STRING,
        description: "The name or email of the contact to find. e.g., 'jane doe' or 'jane@example.com'"
      },
      filters: {
        type: Type.OBJECT,
        description: "Filters to apply for listing contacts.",
        properties: {
            category: {
              type: Type.ARRAY,
              description: "A list of categories to filter contacts by (e.g., ['Customer']).",
              items: {
                type: Type.STRING,
                enum: Object.values(Category),
              },
            },
            state: { type: Type.STRING, description: "The state to filter by (e.g., 'AL')." },
            city: { type: Type.STRING, description: "The city to filter by." },
            zip: { type: Type.STRING, description: "The zip code to filter by." }, // <-- ADDED
            sendTNSBNewsletter: { type: Type.BOOLEAN, description: "Filter by newsletter subscription status." }, // <-- ADDED
            phone: { type: Type.STRING, description: "The phone number to filter by." } // <-- ADDED
        }
      }
    },
  },
};

const updateContactDeclaration: FunctionDeclaration = {
  name: "updateContact",
  description: "Updates one or more fields for a specific contact.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      identifier: {
        type: Type.STRING,
        description: "The name or email of the contact to update. e.g., 'emily brown'"
      },
      updateData: {
        type: Type.OBJECT,
        description: "An object containing the fields to update.",
        properties: {
          // You can list all possible fields here, but it's often easier
          // to just describe it as an object. For strictness, list them:
          category: {
            type: Type.ARRAY,
            description: "The new list of categories (e.g., ['Customer', 'Vendor']).",
            items: {
              type: Type.STRING,
              enum: Object.values(Category),
            },
          },
          city: { type: Type.STRING, description: "The new city." },
          email: { type: Type.STRING, description: "The new email." },
          zip: { type: Type.STRING, description: "The new zip code." },
          notes: { type: Type.STRING, description: "The new notes." },
          address1: { type: Type.STRING, description: "The new street address." },
          suffix: { type: Type.STRING, description: "The new suffix (e.g., Jr)." },
          honorific: { type: Type.STRING, description: "The new honorific." },
          sendTNSBNewsletter: { type: Type.BOOLEAN, description: "Set whether the contact wants to receive the TNSB Newsletter." }
          // Add any other updatable fields
        },
      }
    },
    required: ["identifier", "updateData"],
  },
};

const deleteContactDeclaration: FunctionDeclaration = {
  name: "deleteContact",
  description: "Deletes a contact from the database using their name or email.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      identifier: {
        type: Type.STRING,
        description: "The name or email of the contact to delete. e.g., 'alice johnson'"
      },
    },
    required: ["identifier"],
  },
};

/* const addBookDeclaration: FunctionDeclaration = {
  name: "addBook",
  description: "Adds a new book to the inventory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title of the book." },
      author: { type: Type.STRING, description: "The author of the book." },
      price: { type: Type.NUMBER, description: "The retail price of the book." },
      stock: { type: Type.NUMBER, description: "The number of copies in stock." },
      isbn: { type: Type.STRING, description: "The ISBN of the book." },
      genre: { type: Type.STRING, description: "The genre of the book (e.g., Mystery, Sci-Fi)." },
      publicationYear: { type: Type.NUMBER, description: "The year the book was published." },
    },
    required: ["title", "author"],
  },
};

const findBookDeclaration: FunctionDeclaration = {
  name: "findBook",
  description: "Finds books by title, author, ISBN, or filters.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      identifier: {
        type: Type.STRING,
        description: "The title, author, or ISBN of the book to find. e.g., 'the great gatsby' or '9780441172719'"
      },
      filters: {
        type: Type.OBJECT,
        description: "Filters to apply for listing books.",
        properties: {
          genre: { type: Type.STRING, description: "The genre to filter by (e.g., science fiction)." },
          publicationYearRange: {
            type: Type.OBJECT,
            description: "A range of years to filter by.",
            properties: {
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER }
            }
          }
        }
      }
    },
  },
};

const updateBookDeclaration: FunctionDeclaration = {
  name: "updateBook",
  description: "Updates one or more fields for a specific book.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      bookIdentifier: {
        type: Type.STRING,
        description: "The title or ISBN of the book to update. e.g., '1984'"
      },
      updateData: {
        type: Type.OBJECT,
        description: "An object containing the fields to update.",
        properties: {
          stock: { type: Type.NUMBER, description: "The new stock level." },
          price: { type: Type.NUMBER, description: "The new price." },
          genre: { type: Type.STRING, description: "The new genre." },
          publisher: { type: Type.STRING, description: "The new publisher." },
          author: { type: Type.STRING, description: "The new author." }
        },
      }
    },
    required: ["bookIdentifier", "updateData"],
  },
};

const deleteBookDeclaration: FunctionDeclaration = {
  name: "deleteBook",
  description: "Deletes a book from the database using its title or ISBN.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      bookIdentifier: {
        type: Type.STRING,
        description: "The title or ISBN of the book to delete. e.g., '1984'"
      },
    },
    required: ["bookIdentifier"],
  },
};

const addEventDeclaration: FunctionDeclaration = {
  name: "addEvent",
  description: "Schedules a new event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The name of the event. e.g., 'Book Signing'" },
      author: { type: Type.STRING, description: "The featured author for the event. e.g., 'Jane Smith'" },
      date: { type: Type.STRING, description: "The date of the event in YYYY-MM-DD format. e.g., '2025-11-15'" },
      time: { type: Type.STRING, description: "The time of the event in HH:MM format. e.g., '17:00'" },
      location: { type: Type.STRING, description: "The location of the event. e.g., 'Upstairs Loft'" },
      description: { type: Type.STRING, description: "A brief description of the event." },
    },
    required: ["name", "date"],
  },
};

const findEventDeclaration: FunctionDeclaration = {
  name: "findEvent",
  description: "Finds events by name, author, date, or location.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      identifier: {
        type: Type.STRING,
        description: "The name, author, date (YYYY-MM-DD), or location of the event to find. e.g., 'local author signing' or 'jane doe'"
      },
    },
    required: ["identifier"],
  },
};

const updateEventDeclaration: FunctionDeclaration = {
  name: "updateEvent",
  description: "Updates one or more fields for a specific event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventIdentifier: {
        type: Type.STRING,
        description: "The name of the event to update. e.g., 'poetry slam'"
      },
      updateData: {
        type: Type.OBJECT,
        description: "An object containing the fields to update.",
        properties: {
          location: { type: Type.STRING, description: "The new location." },
          date: { type: Type.STRING, description: "The new date (YYYY-MM-DD)." },
          time: { type: Type.STRING, description: "The new time (HH:MM)." },
        },
      }
    },
    required: ["eventIdentifier", "updateData"],
  },
};

const deleteEventDeclaration: FunctionDeclaration = {
  name: "deleteEvent",
  description: "Deletes or cancels an event using its name or date.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventIdentifier: {
        type: Type.STRING,
        description: "The name or date of the event to delete. e.g., 'fantasy book club'"
      },
    },
    required: ["eventIdentifier"],
  },
};

const addAttendeeDeclaration: FunctionDeclaration = {
  name: "addAttendee",
  description: "Adds a contact as an attendee to a specific event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventIdentifier: {
        type: Type.STRING,
        description: "The name of the event. e.g., 'Local Author Signing'"
      },
      contactIdentifier: {
        type: Type.STRING,
        description: "The name or email of the contact to add. e.g., 'Jane Doe'"
      },
    },
    required: ["eventIdentifier", "contactIdentifier"],
  },
};

const removeAttendeeDeclaration: FunctionDeclaration = {
  name: "removeAttendee",
  description: "Removes a contact from an event's attendee list.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventIdentifier: {
        type: Type.STRING,
        description: "The name of the event. e.g., 'Poetry Reading Night'"
      },
      contactIdentifier: {
        type: Type.STRING,
        description: "The name or email of the contact to remove. e.g., 'John Smith'"
      },
    },
    required: ["eventIdentifier", "contactIdentifier"],
  },
}; */

// --- AI Tools Configuration ---
const aiTools: GeminiTool[] = [{
  functionDeclarations: [
    // Counts
    countContactsDeclaration,
    countExpenseReportsDeclaration, // <-- ADD THIS

    // Metrics
    //getMetricsDeclaration,

    // Transactions (Assuming you're keeping these)
    //findTransactionDeclaration,
    //deleteTransactionDeclaration,

    // Contacts
    addContactDeclaration,
    findContactDeclaration,
    updateContactDeclaration,
    deleteContactDeclaration,
    
    // New CRM Functions
    logInteractionDeclaration,
    getCustomerSummaryDeclaration,

    // New Expense Report Functions
    findExpenseReportDeclaration, // <-- ADD THIS

    // --- REMOVE ALL BOOK/EVENT/ATTENDEE DECLARATIONS ---
  ],
}];

// --- Few-Shot Examples (Complete List) ---
const fCall = (name: string, args: Record<string, any>) => ({ functionCall: { name, args } });

const fewShotExamples: GenerativeContent[] = [
    // --- EXPENSE REPORT EXAMPLES ---
    { role: "user", parts: [{ text: "how many draft expense reports are there?" }] },
    { role: "model", parts: [fCall("countExpenseReports", { status: "Draft" })] },
    { role: "user", parts: [{ text: "count submitted reports" }] },
    { role: "model", parts: [fCall("countExpenseReports", { status: "Submitted" })] },
    { role: "user", parts: [{ text: "find report 1003" }] },
    { role: "model", parts: [fCall("findExpenseReport", { reportNumber: 1003 })] },
    { role: "user", parts: [{ text: "show me expense reports for Test2 Contact2" }] },
    { role: "model", parts: [fCall("findExpenseReport", { staffName: "Test2 Contact2" })] },
    { role: "user", parts: [{ text: "find submitted reports for Test2 Contact2" }] },
    { role: "model", parts: [fCall("findExpenseReport", { staffName: "Test2 Contact2", status: "Submitted" })] },

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
    { role: "user", parts: [{ text: "Add a new Customer: Mr. Thomas Anderson, email is tom@matrix.com." }] },
    { role: "model", parts: [fCall("addContact", { honorific: "mr", firstName: "thomas", lastName: "anderson", email: "tom@matrix.com", category: "Customer" })] },
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
    { role: "user", parts: [{ text: "Customer: Hermione Granger, email hg@hogwarts.edu" }] },
    { role: "model", parts: [fCall("addContact", { firstName: "hermione", lastName: "granger", category: "Customer", email: "hg@hogwarts.edu" })] },
    { role: "user", parts: [{ text: "Add Media contact: Gale Hawthorne, city Panem" }] },
    { role: "model", parts: [fCall("addContact", { firstName: "gale", lastName: "hawthorne", category: "media", city: "panem" })] },
    { role: "user", parts: [{ text: "Please add a contact named Clark Kent with address 344 Clinton St, Smallville, KS 66002." }] },
    { role: "model", parts: [fCall("addContact", {
        firstName: "clark",
        lastName: "kent",
        address1: "344 clinton st", // Extract address1
        city: "smallville",
        state: "ks",
        zip: "66002" // Extract zip
    })] },
    { role: "user", parts: [{ text: "Add new customer John Doe, john@doe.com, and sign him up for the newsletter." }] },
    { role: "model", parts: [fCall("addContact", { firstName: "john", lastName: "doe", email: "john@doe.com", category: ["Customer"], sendTNSBNewsletter: true })] },

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
    // Existing category filter (using findContact with filters)
    { role: "user", parts: [{ text: "Show me all our suppliers." }] },
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    { role: "user", parts: [{ text: "list all vendor contacts" }] },
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    // NEW: VIP members (using getMetrics)
    { role: "user", parts: [{ text: "List the contacts who are 'VIP' members." }] },
    { role: "model", parts: [fCall("getMetrics", { target: "contacts", metric: "vip-members" })] },
    // Example for a different category
    //{ role: "user", parts: [{ text: "Who are the local authors in our database?" }] },
    //{ role: "model", parts: [fCall("findContact", { category: "author" } )] },
    { role: "user", parts: [{ text: "What is the lifetime value of sally brown" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "customers", metric: "lifetime-value", contactIdentifier: "sally brown" })] },
    { role: "user", parts: [{ text: "Show me all contacts in Alabama." }] },
    { role: "model", parts: [fCall("findContact", { filters: { state: "al" } })] },
    { role: "user", parts: [{ text: "List all vendors." }] },
    { role: "model", parts: [fCall("findContact", { filters: { category: "vendor" } })] },
    { role: "user", parts: [{ text: "Who do I know in Metropolis?" }] },
    { role: "model", parts: [fCall("findContact", { filters: { city: "metropolis" } })] },
    { role: "user", parts: [{ text: "Find all Customers in New York." }] },
    { role: "model", parts: [fCall("findContact", { filters: { category: "Customer", state: "ny" } })] },
    { role: "user", parts: [{ text: "Does john@doe.com get the newsletter?" }] },
    { role: "model", parts: [fCall("findContact", { identifier: "john@doe.com" })] },

    // --- CONTACT MANAGEMENT EXAMPLES (UPDATE) ---
    { role: "user", parts: [{ text: "Update Emily Brown's category to Customer." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "emily brown", updateData: { category: "Customer" } })] },
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
    { role: "user", parts: [{ text: "Opt Jane Smith out of the TNSB newsletter." }] },
    { role: "model", parts: [fCall("updateContact", { identifier: "jane smith", updateData: { sendTNSBNewsletter: false } })] },

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
    { role: "user", parts: [{ text: "Show me science fiction books published between 2010 and 2015." }] },
    { role: "model", parts: [fCall("findBook", { // Using findBook for consistency
        filters: {
           genre: "science fiction", // Lowercase filters
           publicationYearRange: { start: 2010, end: 2015 }
        }
    })] },
    { role: "user", parts: [{ text: "List all mystery novels from the 90s." }] },
    { role: "model", parts: [fCall("findBook", {
        filters: {
           genre: "mystery",
           publicationYearRange: { start: 1990, end: 1999 }
        }
    })] },
    { role: "user", parts: [{ text: "Show me fiction books published between 2020 and 2025." }] },
    { role: "model", parts: [fCall("findBook", {
        filters: {
           genre: "fiction",
           publicationYearRange: { start: 2020, end: 2025 }
        }
    })] },

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
    { role: "user", parts: [{ text: "how many Customers?" }] },
    { role: "model", parts: [fCall("countContacts", { category: "Customer" })] },
    { role: "user", parts: [{ text: "number of non-vendor contacts" }] },
    { role: "model", parts: [fCall("countContacts", { category: "not vendor" })] },
    { role: "user", parts: [{ text: "List all contacts in the vendor category" }] },
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    { role: "user", parts: [{ text: "List contacts in Alabama" }] },
    { role: "model", parts: [fCall("countContacts", { state: "al" })] },
    { role: "user", parts: [{ text: "Show me all contacts in Alabama." }] },
    { role: "model", parts: [fCall("countContacts", { state: "al" })] },
    { role: "user", parts: [{ text: "List all Vendors." }] }, // More direct phrase
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    { role: "user", parts: [{ text: "List all contacts who are vendors" }] }, // Slightly different phrasing
    { role: "model", parts: [fCall("countContacts", { category: "vendor" })] },
    // Books
    { role: "user", parts: [{ text: "count the books by Harper Lee" }] },
    { role: "model", parts: [fCall("countBooks", { author: "harper lee" })] },
    { role: "user", parts: [{ text: "how many books are out of stock?" }] },
    { role: "model", parts: [fCall("countBooks", { stock: 0 })] },
    { role: "user", parts: [{ text: "how many books do I have in stock?" }] },
    { role: "model", parts: [fCall("countBooks", {})] },
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
    { role: "user", parts: [{ text: "what's the next event coming up?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "events", metric: "upcoming", limit: 1 })] },
    { role: "user", parts: [{ text: "Who are the top 5 customers by spending?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "customers", metric: "top-spending", limit: 5 })] },
    { role: "user", parts: [{ text: "Top selling books, show 10." }] },
    { role: "model", parts: [fCall("getMetrics", { target: "books", metric: "top-selling", limit: 10 })] },
    { role: "user", parts: [{ text: "What is the total retail value of our current inventory?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "books", // Consistent with existing metrics
        metric: "total-inventory-value", // Use kebab-case like other metrics
        // calculation_basis: "retail_price" // Optional, frontend can assume retail
    })] },

    { role: "user", parts: [{ text: "How much is all our stock worth?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "books",
        metric: "total-inventory-value"
    })] },
    { role: "user", parts: [{ text: "What is the average price of a mystery novel?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "books",
        metric: "average-price",
        filters: { genre: "mystery" } // Use genre as the filter key
    })] },

    { role: "user", parts: [{ text: "How much does the average hardcover cost?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "books",
        metric: "average-price",
        filters: { format: "hardcover" } // Assuming you might add a 'format' field later
    })] },
    { role: "user", parts: [{ text: "Which customers haven't made a purchase in the last 6 months?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "contacts",
        metric: "lapsed-customers",
        timeframe: "6 months" // Let backend send timeframe string
    })] },

    { role: "user", parts: [{ text: "Show me lapsed customers from the past year." }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "contacts",
        metric: "lapsed-customers",
        timeframe: "1 year"
    })] },
    { role: "user", parts: [{ text: "What was the total revenue yesterday?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "transactions",
        metric: "total-revenue",
        timeframe: "yesterday"
    })] },

    { role: "user", parts: [{ text: "How much money did we make last month?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "transactions",
        metric: "total-revenue",
        timeframe: "last month"
    })] },

    { role: "user", parts: [{ text: "Calculate the year-to-date sales total." }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "transactions",
        metric: "total-revenue",
        timeframe: "year-to-date"
    })] },
    { role: "user", parts: [{ text: "Which loyalty members have purchased books by Harper Lee?" }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "contacts",
        metric: "purchased-by-criteria",
        criteria: { book_author: "harper lee" },
        filters: { contact_category: "loyalty member" } // Assuming 'Loyalty Member' is a category or needs mapping
    })] },

    { role: "user", parts: [{ text: "Generate a list of customers who previously bought science fiction books." }] },
    { role: "model", parts: [fCall("getMetrics", {
        target: "contacts",
        metric: "purchased-by-criteria",
        criteria: { book_genre: "science fiction" }
    })] },
    { role: "user", parts: [{ text: "Who are my 5 most recent customers?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "contacts", metric: "recent-customers", limit: 5 })] },
    { role: "user", parts: [{ text: "How many new Customers did we get last month?" }] },
    { role: "model", parts: [fCall("getMetrics", { target: "contacts", metric: "new-customer-count", timeframe: "last month" })] },

    // --- CONTACT MANAGEMENT EXAMPLES (LOGGING) ---
    { 
      role: "user", 
      parts: [{ text: "Log a phone call with Jane Doe, notes 'discussed new sci-fi arrivals'." }] 
    },
    { 
      role: "model", 
      parts: [fCall(
        "logInteraction", // <-- Must match name: "logInteraction"
        { 
          contactIdentifier: "jane doe", // <-- Must match 'contactIdentifier'
          interactionData: {             // <-- Must match 'interactionData'
            type: "phone", 
            notes: "discussed new sci-fi arrivals" 
          } 
        }
      )] 
    },   
    { role: "user", parts: [{ text: "Add note for Peter Parker: met at coffee shop." }] },
    { role: "model", parts: [fCall("logInteraction", { contactIdentifier: "peter parker", interactionData: { type: "meeting", notes: "met at coffee shop" } })] },
    { role: "user", parts: [{ text: "Logged an email to tom@matrix.com regarding invoice #123." }] },
    { role: "model", parts: [fCall("logInteraction", { contactIdentifier: "tom@matrix.com", interactionData: { type: "email", notes: "Discussed invoice #123" } })] },

    // --- CONTACT MANAGEMENT EXAMPLES (SUMMARY) ---
    { role: "user", parts: [{ text: "Show me the dashboard for Tony Stark." }] },
    { role: "model", parts: [fCall("getCustomerSummary", { contactIdentifier: "tony stark" })] },
    { role: "user", parts: [{ text: "Pull up the full history for 'hulk@avengers.com'." }] },
    { role: "model", parts: [fCall("getCustomerSummary", { contactIdentifier: "hulk@avengers.com" })] },
    { role: "user", parts: [{ text: "What's the full rundown on Sarah Connor?" }] },
    { role: "model", parts: [fCall("getCustomerSummary", { contactIdentifier: "sarah connor" })] },
];

// --- Initialize GoogleGenAI Customer ---
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY as string});
const model = "gemini-2.5-flash-lite"; // Or your preferred model

// --- Seed Database Function (using onCall) ---
export const seedDatabase = onCall({cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']}, async (request) => { // Use specific CORS origin
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

// --- processCommand Function (using onRequest with manual PNA/CORS) ---
export const processCommand = onCall({
    secrets: ["GEMINI_API_KEY"],
    cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']
}, async (request) => {

    logger.info("Starting up process command (onCall)");
    logger.info("Credential Path Check:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "Not Set");

    // 1. Get command from request.data (not request.body.data)
    const command = request.data?.command;
    if (!command) {
        // 2. Throw HttpsError instead of response.send()
        throw new HttpsError("invalid-argument", "No command provided.");
    }

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
        let responsePayload: any = { intent: "GENERAL_QUERY", responseText };

        if (call) {
            const { name, args } = call;
            const anyArgs = args as any;

            // --- Your existing switch statement (no changes needed here) ---
            switch (name) {
                case "findExpenseReport":
                    responsePayload = { intent: 'FIND_EXPENSE_REPORT', data: { filters: args }, responseText: result.text || `Finding expense reports.` };
                    break;
                case "countExpenseReports":
                    responsePayload = { intent: 'COUNT_EXPENSE_REPORTS', data: { filters: args }, responseText: result.text || `Counting expense reports.` };
                    break;
                 case "findTransaction":
                    responsePayload = { intent: 'FIND_TRANSACTION', data: { transactionIdentifier: args }, responseText: result.text || `Finding transaction.` };
                    break;
                case "deleteTransaction":
                    responsePayload = { intent: 'DELETE_TRANSACTION', data: { transactionIdentifier: args }, responseText: result.text || `Deleting transaction.` };
                    break;
                case "countContacts":
                case "countBooks":
                case "countEvents":
                    let filters = args || {};
                    const target = name.replace('count', '').toLowerCase();

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
                                const titleCaseValue = value.toLowerCase().split(' ')
                                    .filter(word => word.length > 0)
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');
                                normalizedFilters[key] = titleCaseValue;
                                if (key === 'category' && normalizedFilters[key].toLowerCase() === 'not Customer') {
                                    normalizedFilters[key] = 'not Customer';
                                }
                            }
                            else if (key === 'priceFilter') { 
                                normalizedFilters[key] = value.toLowerCase().replace(/ /g, '');
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

                    responsePayload = {
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

                case "addContact":
                    if (anyArgs.category && typeof anyArgs.category === 'string') {
                        anyArgs.category = anyArgs.category.charAt(0).toUpperCase() + anyArgs.category.slice(1).toLowerCase();
                    }
                    responsePayload = { intent: 'ADD_CONTACT', data: { contactData: args }, responseText: result.text || `Adding contact.` };
                    break;
                case "findContact":
                    // Check if identifier or filters are present
                    const findData = anyArgs.identifier 
                        ? { contactIdentifier: anyArgs.identifier } 
                        : { filters: anyArgs.filters };
                        
                    responsePayload = { 
                        intent: 'FIND_CONTACT', 
                        data: findData, // Use the new findData object
                        responseText: result.text || `Finding contact.` 
                    };
                    break;
                case "updateContact":
                    if (anyArgs.updateData.category && typeof anyArgs.updateData.category === 'string') {
                        anyArgs.updateData.category = anyArgs.updateData.category.charAt(0).toUpperCase() + anyArgs.updateData.category.slice(1).toLowerCase();
                    }
                    responsePayload = { intent: 'UPDATE_CONTACT', data: { contactIdentifier: anyArgs.identifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating contact.` };
                    break;
                case "deleteContact":
                    responsePayload = { intent: 'DELETE_CONTACT', data: { contactIdentifier: anyArgs.identifier }, responseText: result.text || `Deleting contact.` };
                    break;
                case "addBook":
                    responsePayload = { intent: 'ADD_BOOK', data: { bookData: args }, responseText: result.text || `Adding book.` };
                    break;
                case "findBook":
                    responsePayload = { intent: 'FIND_BOOK', data: { bookIdentifier: anyArgs.identifier }, responseText: result.text || `Finding book.` };
                    break;
                case "updateBook":
                    responsePayload = { intent: 'UPDATE_BOOK', data: { bookIdentifier: anyArgs.bookIdentifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating book.` };
                    break;
                case "deleteBook":
                    responsePayload = { intent: 'DELETE_BOOK', data: { bookIdentifier: anyArgs.bookIdentifier }, responseText: result.text || `Deleting book.` };
                    break;
                case "addEvent":
                    responsePayload = { intent: 'ADD_EVENT', data: { eventData: args }, responseText: result.text || `Adding event.` };
                    break;
                case "findEvent":
                    responsePayload = { intent: 'FIND_EVENT', data: { eventIdentifier: anyArgs.identifier }, responseText: result.text || `Finding event.` };
                    break;
                case "updateEvent":
                    responsePayload = { intent: 'UPDATE_EVENT', data: { eventIdentifier: anyArgs.eventIdentifier, updateData: anyArgs.updateData }, responseText: result.text || `Updating event.` };
                    break;
                case "deleteEvent":
                    responsePayload = { intent: 'DELETE_EVENT', data: { eventIdentifier: anyArgs.eventIdentifier }, responseText: result.text || `Deleting event.` };
                    break;
                case "addAttendee":
                    responsePayload = { intent: 'ADD_ATTENDEE', data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier }, responseText: result.text || `Adding attendee.` };
                    break;
                case "removeAttendee":
                    responsePayload = { intent: 'REMOVE_ATTENDEE', data: { eventIdentifier: anyArgs.eventIdentifier, contactIdentifier: anyArgs.contactIdentifier }, responseText: result.text || `Removing attendee.` };
                    break;
                case "getMetrics":
                    responsePayload = { intent: 'METRICS_DATA', data: { metricsRequest: args }, responseText: result.text || `Getting metrics.` };
                    break;
                case "logInteraction":
                    responsePayload = { intent: 'LOG_INTERACTION', data: { contactIdentifier: anyArgs.contactIdentifier, interactionData: anyArgs.interactionData }, responseText: result.text || `Logging interaction.` };
                    break;
                
                case "getCustomerSummary":
                    responsePayload = { intent: 'GET_CUSTOMER_SUMMARY', data: { contactIdentifier: anyArgs.contactIdentifier }, responseText: result.text || `Getting customer summary.` };
                    break;
                 default:
                    const conversationalText = result.text || "I'm sorry, I could not determine a specific action to take.";
                    responsePayload = { intent: "GENERAL_QUERY", responseText: conversationalText };
            }
        } else {
            responsePayload = { intent: 'GENERAL_QUERY', responseText: result.text || "I'm sorry, I couldn't understand that request." };
        }

        logger.info("[GEMINI] Parsed JSON response (onCall):", JSON.stringify(responsePayload, null, 2));
        // 3. Return data instead of response.send()
        return { data: responsePayload };

    } catch (error) {
        logger.error("Error processing command with Gemini (onCall):", error);
        // 4. Throw HttpsError on failure
        throw new HttpsError("internal", "Gemini processing failed.");
    }
});
// --- END processCommand ---

// --- User Management Functions (using onCall) ---
export const setUserRole = onCall({cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']}, async (request) => { // Use specific CORS origin
    const requestingUid = request.auth?.uid;

    // Check for authentication
    if (!requestingUid) {
        throw new HttpsError("unauthenticated", "You must be authenticated to perform this action.");
    }

    const { userId, role: newRole } = request.data;

    // Check for valid arguments
    if (!userId || !['admin', 'viewer', 'applicant', 'bookkeeper'].includes(newRole)) {
        throw new HttpsError("invalid-argument", "The function must be called with a `userId` and a valid `role` (admin, viewer, or applicant).");
    }

    try {
        // --- Start New Permission Checks ---
        const db = admin.firestore();

        // 1. Get the requesting user's full doc to check for isMasterAdmin
        const requestingUserRef = db.collection("users").doc(requestingUid);
        const requestingUserDoc = await requestingUserRef.get();

        // --- THIS IS THE FIX ---
        // Get the user data
        const requestingUserData = requestingUserDoc.data();

        // Check if the user exists AND if their role is 'admin' OR 'master-admin'
        if (!requestingUserDoc.exists || (requestingUserData?.role !== 'admin' && requestingUserData?.role !== 'master-admin')) {
            throw new HttpsError("permission-denied", "You must be an admin to change user roles.");
        }

        // Now, check for isMasterAdmin from the same data
        const isMasterAdmin = requestingUserData?.isMasterAdmin === true;

        // 2. Get the target user's full doc
        const targetUserRef = db.collection("users").doc(userId);
        const targetUserDoc = await targetUserRef.get();

        if (!targetUserDoc.exists) {
            throw new HttpsError("not-found", "The specified user does not exist.");
        }

        const targetUser = targetUserDoc.data();
        if (!targetUser) {
            throw new HttpsError("internal", "Could not retrieve target user data.");
        }

        const isTargetMasterAdmin = targetUser.isMasterAdmin === true;
        const currentRole = targetUser.role;

        // 3. Enforce Master Admin rules
        if (isMasterAdmin) {
            // Master Admins can do anything, EXCEPT modify other Master Admins
            if (isTargetMasterAdmin) {
                throw new HttpsError("permission-denied", "Master Admins cannot be modified.");
            }
            // Proceed to change role (at the end)
        }
        // 4. Enforce Regular Admin rules
        else {
            // Regular Admins CANNOT modify Master Admins
            if (isTargetMasterAdmin) {
                throw new HttpsError("permission-denied", "Only Master Admins can modify this user.");
            }

            // Regular Admins CANNOT promote to Admin or demote from Admin
            if (newRole === 'admin' || currentRole === 'admin') {
                throw new HttpsError("permission-denied", "Only Master Admins can promote to or demote other Admins.");
            }

            // Regular Admins can ONLY promote Applicant -> Viewer or demote Viewer -> Applicant
            const isPromotingApplicant = currentRole === 'applicant' && newRole === 'viewer';
            const isDemotingViewer = currentRole === 'viewer' && newRole === 'applicant';

            if (!isPromotingApplicant && !isDemotingViewer) {
                throw new HttpsError("permission-denied", `Regular admins can only change roles between 'applicant' and 'viewer'.`);
            }
            // Proceed to change role (at the end)
        }
        // --- End New Permission Checks ---

        // If all checks passed, perform the update:
        await admin.auth().setCustomUserClaims(userId, { role: newRole });
        await targetUserRef.update({ role: newRole, isAdmin: newRole === 'admin' });
        return { success: true, message: `Successfully updated role for user ${userId}.` };

    } catch (error) {
        logger.error("Error setting user role:", error);
        if (error instanceof HttpsError) { throw error; } // Re-throw HttpsErrors
        throw new HttpsError("internal", "Failed to set user role.");
    }
});

export const deleteUser = onCall({cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']}, async (request) => { // Use specific CORS origin
    const requestingUid = request.auth?.uid;

    // Check for authentication
    if (!requestingUid) {
        throw new HttpsError("unauthenticated", "You must be authenticated to perform this action.");
    }

    const { userId } = request.data;
    if (!userId) {
        throw new HttpsError("invalid-argument", "The function must be called with a `userId`.");
    }

    try {
        // --- Start New Permission Checks ---
        const db = admin.firestore();

        // 1. Get the requesting user's full doc to check for isMasterAdmin
        const requestingUserRef = db.collection("users").doc(requestingUid);
        const requestingUserDoc = await requestingUserRef.get();

        // --- THIS IS THE FIX ---
        // Get the user data
        const requestingUserData = requestingUserDoc.data();

        // Check if the user exists AND if their role is 'admin' OR 'master-admin'
        if (!requestingUserDoc.exists || (requestingUserData?.role !== 'admin' && requestingUserData?.role !== 'master-admin')) {
            throw new HttpsError("permission-denied", "You must be an admin to delete users.");
        }
        
        // Now, check for isMasterAdmin from the same data
        const isMasterAdmin = requestingUserData?.isMasterAdmin === true;

        // 2. Get the target user's full doc
        const targetUserRef = db.collection("users").doc(userId);
        const targetUserDoc = await targetUserRef.get();

        if (!targetUserDoc.exists) {
            throw new HttpsError("not-found", "The specified user does not exist.");
        }

        const isTargetMasterAdmin = targetUserDoc.data()?.isMasterAdmin === true;

        // 3. Enforce rules
        // Regular Admins CANNOT delete anyone
        if (!isMasterAdmin) {
            throw new HttpsError("permission-denied", "Only Master Admins can delete users.");
        }

        // Master Admins CANNOT delete other Master Admins
        if (isTargetMasterAdmin) {
            throw new HttpsError("permission-denied", "Master Admins cannot be deleted.");
        }
        // --- End New Permission Checks ---

        // If all checks passed, perform the deletion:
        await admin.auth().deleteUser(userId);
        await targetUserRef.delete();
        
        // (Optional) Delete chat history subcollection
        // If you have chat history, you might want to uncomment this
        // const chatHistoryRef = db.collection("users").doc(userId).collection("chat").doc("history");
        // await chatHistoryRef.delete().catch(err => logger.warn("Could not delete chat history:", err));

        return { success: true, message: `Successfully deleted user ${userId}.` };
    } catch (error) {
        logger.error("Error deleting user:", error);
        if (error instanceof HttpsError) { throw error; } // Re-throw HttpsErrors
        throw new HttpsError("internal", "Failed to delete user.");
    }
});

export const makeMeAdmin = onCall({cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']}, async (request) => { // Use specific CORS origin
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
        // FIX: Set the correct 'master-admin' role on the auth token
        await admin.auth().setCustomUserClaims(uid, { role: 'master-admin' });
        // --- This is the key change ---
        await admin.firestore().collection("users").doc(uid).set({
            role: 'master-admin', // <-- FIX 1: Set the correct role in the database
            isAdmin: true,
            isMasterAdmin: true, // Set the first admin as Master Admin
            email: email, // <-- ADD THIS
            showAiChat: true, // <-- ADD THIS
            contactId: null, // <-- ADD THIS
            createdAt: FieldValue.serverTimestamp(), // <-- ADD THIS
        }, { merge: true });
        // --- End of key change ---
        logger.info(`Successfully set 'admin' role for ${email} (${uid}) via onCall.`);
        return { message: `Success! Admin permissions have been synced for ${email}. Please refresh the page.` };
    } catch (error) {
        logger.error("Error in makeMeAdmin function (onCall):", error);
        throw new HttpsError("internal", "Failed to set admin role. Check the function logs.");
    }
});
// --- ADD THIS NEW FUNCTION ---
// This trigger creates a default user document in Firestore when a new
// user signs up in Firebase Auth.
export const onUserCreate = auth.user().onCreate(async (user) => {
  // The 'user' object is directly available, no 'event.data' needed
  logger.info(`New user signed up: ${user.uid}, Email: ${user.email}`);

  const userDocRef = admin.firestore().collection("users").doc(user.uid);

  try {
    // Set the default user document
    await userDocRef.set({
      email: user.email || null,
      role: "applicant", // Default role for all new users
      isAdmin: false,
      isMasterAdmin: false,
      showAiChat: true, // Default preference
      contactId: null, // No contact linked by default
      createdAt: FieldValue.serverTimestamp(),
    });

    // Also set their default auth claim
    await admin.auth().setCustomUserClaims(user.uid, {
      role: "applicant",
      contactId: null,
    });

    logger.info(`Successfully created user document for ${user.uid}`);
  } catch (error) {
    logger.error(`Error creating user document for ${user.uid}:`, error);
  }
});

// --- NEW MANUAL SYNC FUNCTION ---
export const forceSetMyRole = onCall({
  cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  try {
    // 1. Get the user's document from Firestore
    const userDocRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Your user document was not found.");
    }

    const userData = userDoc.data();
    if (!userData) {
      throw new HttpsError("internal", "Could not read user data.");
    }

    // 2. Read the roles from the document
    const isMasterAdmin = userData.isMasterAdmin === true;
    const role = userData.role;
    const contactId = userData.contactId || null;

    // 3. Determine the final "role" claim
    let finalRoleClaim = 'applicant'; // Safe default
    if (isMasterAdmin) {
      finalRoleClaim = 'master-admin';
    } else if (role) {
      finalRoleClaim = role;
    }
    
    // 4. Build the new claims object
    const newClaims = {
      role: finalRoleClaim,
      contactId: contactId
    };

    // 5. Force-set the claims on the Auth token
    await admin.auth().setCustomUserClaims(uid, newClaims);

    // --- FIX 2: WRITE THE CORRECTED ROLE BACK TO THE DATABASE ---
    // This fixes the de-synced state the user is seeing.
    if (isMasterAdmin && userData.role !== 'master-admin') {
      await userDocRef.update({ role: "master-admin" });
      logger.info(`Updated database role for ${uid} to 'master-admin'.`);
    }
    // --- END FIX ---
    
    logger.info(`Successfully FORCED claim sync for ${uid}:`, newClaims);
    return { success: true, message: "Claims synced!", claims: newClaims };

  } catch (error) {
    logger.error(`Error in forceSetMyRole for ${uid}:`, error);
    if (error instanceof HttpsError) { throw error; }
    throw new HttpsError("internal", "Failed to force-set role.");
  }
});

// --- NEW FUNCTION TO SECURELY ADD EXPENSE REPORTS ---
export const addExpenseReport = onCall({
  cors: ['https://nsindxonline.web.app', 'https://newsouthindex.online', 'http://localhost:3000']
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const reportData = request.data;
  const db = admin.firestore();

  // 1. Define the counter document
  const counterRef = db.collection("metadata").doc("expenseReportCounter");
  const reportsRef = db.collection("expenseReports");

  // --- FIX: REMOVED THE 'let nextReportNumber' LINE ---

  try {
    // 2. Run a transaction that *returns* the new number
    const nextReportNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let newCount: number; // <-- Declare the new count *inside* the transaction

      if (!counterDoc.exists) {
        // If it doesn't exist, start at 1001
        newCount = 1001;
        transaction.set(counterRef, { count: newCount });
      } else {
        // It exists, increment it
        newCount = (counterDoc.data()?.count || 1000) + 1;
        transaction.update(counterRef, { count: newCount });
      }

      // 3. Create the new report document with the guaranteed unique number
      const newReportRef = reportsRef.doc();
      transaction.set(newReportRef, {
        ...reportData,
        reportNumber: newCount, // Set the new number
        createdBy: uid,                 // Set the creator
        createdAt: FieldValue.serverTimestamp(), // Set timestamps
        lastModifiedAt: FieldValue.serverTimestamp(),
      });
      
      // --- FIX: Return the new count from the transaction ---
      return newCount; 
    });

    // 4. Now 'nextReportNumber' is assigned and in scope.
    return { success: true, message: `Report #${nextReportNumber} created.` };

  } catch (error) {
    logger.error("Error in addExpenseReport transaction:", error);
    throw new HttpsError("internal", "Failed to create expense report.");
  }
});