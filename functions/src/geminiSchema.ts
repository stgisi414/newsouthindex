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
  lastName: {
    type: Type.STRING,
    description: "The contact's last name.",
  },
  category: {
    type: Type.STRING,
    description: "The category of the contact.",
    enum: Object.values(Category),
  },
  phone: {
    type: Type.STRING,
    description: "The contact's phone number.",
  },
  email: {
    type: Type.STRING,
    description: "The contact's email address.",
  },
  address: {
    type: Type.STRING,
    description: "The contact's physical address.",
  },
  notes: {
    type: Type.STRING,
    description: "Any notes about the contact.",
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
        description: `The title or ISBN of the book to find, update, or delete. E.g., "Dune" or "978-0451524935".`
    },
    contactData: {
      type: Type.OBJECT,
      description: "Data for a new contact being added.",
      properties: contactProperties,
    },
    updateData: {
      type: Type.OBJECT,
      description:
        "The specific fields to update for an existing contact or book.",
      properties: { ...contactProperties, ...bookProperties },
    },
    bookData: {
        type: Type.OBJECT,
        description: "Data for a new book being added.",
        properties: bookProperties,
    },
    transactionData: {
        type: Type.OBJECT,
        description: "Data for a new transaction, linking contacts and books.",
        properties: {
            contactIdentifier: { type: Type.STRING, description: "The name or email of the customer." },
            bookIdentifiers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of book titles or ISBNs being purchased." }
        }
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
