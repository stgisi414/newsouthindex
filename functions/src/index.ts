import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenAI} from "@google/genai";
// ADDITION: Import the response schema from the new local file
import {responseSchema} from "./geminiSchema";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Use a console.error/logger.error for build/deployment errors
  logger.error("GEMINI_API_KEY environment variable is missing.");
  // Throw an error early if the key is essential for deployment/initialization
  throw new Error("GEMINI_API_KEY is not set. Cannot initialize AI.");
}

const ai = new GoogleGenAI({apiKey});

export const processCommand = onCall(async (request) => {
  const command = request.data.command;
  logger.info(`Received command: ${command}`);

  try {
    // FIX: Correctly access the models property for model configuration
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `User command: "${command}"`,
      config: {
        systemInstruction:
          `You are an intelligent assistant for a 
          Contact Relationship Management (CRM) app.
          Your task is to parse user commands into structured JSON data.
          Identify the user's intent
          (ADD_CONTACT, FIND_CONTACT, UPDATE_CONTACT,
           DELETE_CONTACT, GENERAL_QUERY). 
          Extract all relevant contact details. For FIND, UPDATE, or DELETE,
           identify the contact they are referring to.
          Always provide a friendly 'responseText'
           to confirm the action or answer the question.
          If the intent is unclear, use the 'UNSURE' intent.
          `,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    // Parse and return the response
    const response = await result.text;
    return response;
  } catch (error) {
    logger.error("Error processing command with Gemini:", error);
    // FIX: Use the imported HttpsError class directly, resolving the final err
    throw new HttpsError("internal", "Gemini processing failed.");
  }
});
