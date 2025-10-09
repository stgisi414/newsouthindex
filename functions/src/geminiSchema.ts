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
    contactData: {
      type: Type.OBJECT,
      description: "Data for a new contact being added.",
      properties: contactProperties,
    },
    updateData: {
      type: Type.OBJECT,
      description:
        "The specific fields to update for an existing contact.",
      properties: contactProperties,
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
