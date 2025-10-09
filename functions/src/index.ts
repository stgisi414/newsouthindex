import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenAI} from "@google/genai";
// ADDITION: Import the response schema from the new local file
import {responseSchema} from "./geminiSchema";

export const processCommand = onCall(
  {secrets: ["GEMINI_API_KEY"]},
   enforceAppCheck: true, 
  async (request) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      logger.error("GEMINI_API_KEY environment variable missing at runtime.");
      // Throw an appropriate error for a runtime configuration issue
      throw new HttpsError("internal", "AI service configuration failed.");
    }

    const ai = new GoogleGenAI({apiKey});

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
      // FIX: Check if result.text exists before trying to parse it
      const rawResponse = result.text;

      if (!rawResponse) {
        logger.error("Gemini returned an empty response text.");
        throw new HttpsError("internal", "Failed to return structured res.");
      }

      const jsonResponse = JSON.parse(rawResponse);
      return jsonResponse;
    } catch (error) {
      logger.error("Error processing command with Gemini:", error);
      // Use the imported HttpsError class directly, resolving the final err
      throw new HttpsError("internal", "Gemini processing failed.");
    }
  }
);
