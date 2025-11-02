import {Type} from "@google/genai";
import {Category} from "./types";

const contactProperties = {
  honorific: {
    type: Type.STRING,
    description: "The contact's honorific (e.g., Mr., Ms., Dr.).",
  },
  firstName: {
    type: Type.STRING,
    description: "The contact's first name.",
  },
  middleInitial: {
    type: Type.STRING,
    description: "The contact's middle initial.",
  },
  lastName: {
    type: Type.STRING,
    description: "The contact's last name.",
  },
  suffix: {
    type: Type.STRING,
    description: "The contact's suffix (e.g., Jr., Sr., II, III).",
  },
  category: {
    type: Type.ARRAY,
    description: "The category of the contact.",
    items: {
      type: "string",
      enum: Object.values(Category),
    },
  },
  phone: {
    type: Type.STRING,
    description: "The contact's phone number.",
  },
  email: {
    type: Type.STRING,
    description: "The contact's email address.",
  },
  url: {
    type: Type.STRING,
    description: "The contact's website URL.",
  },
  address1: {
    type: Type.STRING,
    description: "The first line of the contact's address.",
  },
  address2: {
    type: Type.STRING,
    description: "The second line of the contact's address.",
  },
  city: {
    type: Type.STRING,
    description: "The city of the contact's address.",
  },
  state: {
    type: Type.STRING,
    description: "The state of the contact's address.",
  },
  zip: {
    type: Type.STRING,
    description: "The zip code of the contact's address.",
  },
  notes: {
    type: Type.STRING,
    description: "Any notes about the contact.",
  },
  sendTNSBNewsletter: {
    type: Type.BOOLEAN,
    description: "Whether the contact wants to receive the TNSB Newsletter.",
  },
};

const bookProperties = {
  title: {
    type: Type.STRING,
    description: "The title of the book.",
  },
  author: {
    type: Type.STRING,
    description: "The author of the book.",
  },
  isbn: {
    type: Type.STRING,
    description: "The ISBN of the book.",
  },
  publisher: {
    type: Type.STRING,
    description: "The publisher of the book.",
  },
  price: {
    type: Type.NUMBER,
    description: "The price of the book.",
  },
  stock: {
    type: Type.NUMBER,
    description: "The stock quantity of the book.",
  },
  genre: {
    type: Type.STRING,
    description: "The genre of the book.",
  },
  publicationYear: {
      type: Type.NUMBER,
      description: "The year the book was published.",
  },
  // CRITICAL ADDITION
  priceFilter: { 
      type: Type.STRING, 
      description: "A price range filter (e.g., '>15', '<20.50', '10-25')." 
  },
};

const eventProperties = {
  name: {
    type: Type.STRING,
    description: "The name of the event.",
  },
  date: {
    type: Type.STRING,
    description: "The date of the event in YYYY-MM-DD format.",
  },
  time: {
    type: Type.STRING,
    description: "The time of the event in HH:MM format.",
  },
  location: {
    type: Type.STRING,
    description: "The location of the event.",
  },
  description: {
    type: Type.STRING,
    description: "A description of the event.",
  },
  author: {
    type: Type.STRING,
    description: "The featured author for the event.",
  },
};

export const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: "The user's intent.",
      enum: [
        "ADD_CONTACT",
        "FIND_CONTACT",
        "UPDATE_CONTACT",
        "DELETE_CONTACT",
        "ADD_BOOK",
        "FIND_BOOK",
        "UPDATE_BOOK",
        "DELETE_BOOK",
        "CREATE_TRANSACTION",
        "ADD_EVENT",
        "FIND_EVENT",
        "UPDATE_EVENT",
        "DELETE_EVENT",
        "ADD_ATTENDEE",
        "REMOVE_ATTENDEE",
        "COUNT_DATA",
        "METRICS_DATA",
        "GENERAL_QUERY",
        "UNSURE",
      ],
    },
    contactIdentifier: {
      type: Type.STRING,
      description:
        `The name or email of the contact to find, update, or delete. E.g.,
         "John Smith" or "jane.doe@example.com".`,
    },
    bookIdentifier: {
        type: Type.STRING,
        description: `The title or ISBN of the book to find, update, or delete. E.g., "Dune" or "978-0451524935".`,
    },
    eventIdentifier: {
        type: Type.STRING,
        description: `The name of the event to find, update, delete, or manage attendees for. E.g., "Author Signing".`,
    },
    contactData: {
      type: Type.OBJECT,
      description: "Data for a new contact being added.",
      properties: contactProperties,
    },
    updateData: {
      type: Type.OBJECT,
      description:
        "The specific fields to update for an existing contact, book, or event.",
      properties: { ...contactProperties, ...bookProperties, ...eventProperties },
    },
    bookData: {
        type: Type.OBJECT,
        description: "Data for a new book being added.",
        properties: bookProperties,
    },
    eventData: {
        type: Type.OBJECT,
        description: "Data for a new event being added.",
        properties: eventProperties,
    },
    countRequest: {
      type: Type.OBJECT,
      description: "Details for a data counting request.",
      properties: {
        target: {
          type: Type.STRING,
          description: "The entity to count.",
          enum: ["contacts", "books", "events"],
        },
        filters: {
          type: Type.OBJECT,
          description: "Filters to apply before counting.",
          properties: {category: {
              type: Type.ARRAY,
              description: "Filter contacts by category.",
              items: {
                type: "string",
                enum: Object.values(Category),
              },
            },
            state: { type: Type.STRING, description: "Filter contacts by state." },
            city: { type: Type.STRING, description: "Filter contacts by city." },
            zip: { type: Type.STRING, description: "Filter contacts by zip code." },
            author: { type: Type.STRING, description: "Filter books or events by author." },
            genre: { type: Type.STRING, description: "Filter books by genre." },
            location: { type: Type.STRING, description: "Filter events by location." },
            name: { type: Type.STRING, description: "Filter events by name." },
            stock: { type: Type.NUMBER, description: "Filter books by stock." },
            publicationYear: { type: Type.NUMBER, description: "Filter books by publication year." },
            publisher: { type: Type.STRING, description: "Filter books by publisher." },
            // CRITICAL ADDITION
            priceFilter: { type: Type.STRING, description: "Filter books by price range (e.g., '>15', '<20.50', '10-25')." }
          },
        },
      },
    },
    metricsRequest: {
      type: Type.OBJECT,
      description: "Details for a metrics summarization request (e.g., top 5).",
      properties: {
        target: {
          type: Type.STRING,
          description: "The entity to summarize.",
          enum: ["customers", "books"],
        },
        metric: {
          type: Type.STRING,
          description: "The specific metric type (e.g., 'top-spending', 'lowest-stock', 'total-revenue').",
          enum: ["top-spending", "top-selling", "total-stock", "lifetime-value"],
        },
        limit: {
          type: Type.NUMBER,
          description: "The number of results to return for top-N queries. Defaults to 10.",
        },
        contactIdentifier: {
            type: Type.STRING,
            description: "The name or email of a specific contact for a metric (e.g., 'Sally Brown')."
        },
      },
    },
    transactionData: {
        type: Type.OBJECT,
        description: "Data for a new transaction, linking contacts and books.",
        properties: {
            contactIdentifier: { type: Type.STRING, description: "The name or email of the customer." },
            bookIdentifiers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of book titles or ISBNs being purchased." },
        },
    },
    responseText: {
      type: Type.STRING,
      description:
        `A friendly, natural language response to the user,
         confirming the action or answering a general question.`,
    },
  },
  required: ["intent", "responseText"],
};