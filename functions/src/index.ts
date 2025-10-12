import { onCall, HttpsError } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI } from "@google/genai";
import { responseSchema } from "./geminiSchema";
import * as admin from "firebase-admin";

export const processCommand = onCall(
  {secrets: ["GEMINI_API_KEY"]},
  async (request) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      logger.error("GEMINI_API_KEY environment variable missing.");
      throw new HttpsError("internal", "AI service configuration failed.");
    }

    const ai = new GoogleGenAI({apiKey});

    const command = request.data.command;
    // ADDITION: Get the isAdmin status from the request
    const isAdmin = request.data.isAdmin === true;
    logger.info(`Received command: "${command}" for user with isAdmin=${isAdmin}`);

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `User command: "${command}"`,
        config: {
          // UPDATED: Modified system instruction
          systemInstruction:
            `You are an intelligent assistant for a Contact Relationship Management (CRM) app.
            Your task is to parse user commands into structured JSON data.
            The user's admin status is: ${isAdmin}.
            
            - Identify the user's intent
              (ADD_CONTACT, FIND_CONTACT, UPDATE_CONTACT, DELETE_CONTACT, GENERAL_QUERY).
            - Extract all relevant contact details.
            - If the intent is to add, update, or delete,
              AND the user is NOT an admin, your responseText MUST inform
              them that they do not have permission.
            - If the user IS an admin and the intent is to add, update,
              or delete, your responseText should confirm you are performing the action.
            - If the intent is unclear, use the 'UNSURE' intent.
            - Always provide a friendly 'responseText'.`,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const rawResponse = result.text;
      if (!rawResponse) {
        logger.error("Gemini returned an empty response text.");
        throw new HttpsError("internal", "Failed to get structured response.");
      }

      const jsonResponse = JSON.parse(rawResponse);
      return jsonResponse;
    } catch (error) {
      logger.error("Error processing command with Gemini:", error);
      throw new HttpsError("internal", "Gemini processing failed.");
    }
  }
);

/**
 * Sets the admin status for a given user.
 * Can only be called by an existing admin.
 */
export const setAdminStatus = onCall(async (request) => {
  if (request.auth?.token.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Only admins can set admin status.");
  }

  const { userId, isAdmin } = request.data;
  if (!userId || typeof isAdmin !== "boolean") {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId` and `isAdmin` boolean.");
  }

  try {
    // Set a custom claim on the user's auth token
    await admin.auth().setCustomUserClaims(userId, { isAdmin });
    
    // Update the user's document in Firestore
    await admin.firestore().collection("users").doc(userId).update({ isAdmin });

    return { success: true, message: `Successfully updated admin status for user ${userId}.` };
  } catch (error) {
    logger.error("Error setting admin status:", error);
    throw new HttpsError("internal", "Failed to set admin status.");
  }
});

/**
 * Deletes a user from Firebase Auth and Firestore.
 * Can only be called by an existing admin.
 */
export const deleteUser = onCall(async (request) => {
  if (request.auth?.token.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId`.");
  }

  try {
    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);
    
    // Delete the user's document from Firestore
    await admin.firestore().collection("users").doc(userId).delete();

    return { success: true, message: `Successfully deleted user ${userId}.` };
  } catch (error) {
    logger.error("Error deleting user:", error);
    throw new HttpsError("internal", "Failed to delete user.");
  }
});