import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI } from "@google/genai";
import { responseSchema } from "./geminiSchema";
import * as admin from "firebase-admin";

admin.initializeApp();

export const processCommand = onCall({secrets: ["GEMINI_API_KEY"]}, async (request: CallableRequest<any>) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("GEMINI_API_KEY environment variable missing.");
      throw new HttpsError("internal", "AI service configuration failed.");
    }
    const ai = new GoogleGenAI({apiKey});

    const command = request.data.command;
    const isAdmin = request.data.isAdmin === true;
    logger.info(`Received command: "${command}" for user with isAdmin=${isAdmin}`);

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `User command: "${command}"`,
        config: {
          systemInstruction:
            `You are an intelligent assistant for a CRM app. Your task is to parse user commands into structured JSON data. The user's admin status is: ${isAdmin}.
            - Identify the user's intent (ADD_CONTACT, FIND_CONTACT, UPDATE_CONTACT, DELETE_CONTACT, GENERAL_QUERY).
            - Extract all relevant contact details.
            - If the intent is to add, update, or delete, AND the user is NOT an admin, your responseText MUST inform them that they do not have permission.
            - If the user IS an admin and the intent is to add, update, or delete, your responseText should confirm you are performing the action.
            - If the intent is unclear, use 'UNSURE'.
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
      return JSON.parse(rawResponse);
    } catch (error) {
      logger.error("Error processing command with Gemini:", error);
      throw new HttpsError("internal", "Gemini processing failed.");
    }
});

export const setUserRole = onCall(async (request) => {
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError("permission-denied", "Only admins can set user roles.");
  }

  const { userId, role } = request.data;
  if (!userId || !['admin', 'viewer', 'applicant'].includes(role)) {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId` and a valid `role`.");
  }

  try {
    await admin.auth().setCustomUserClaims(userId, { role });
    await admin.firestore().collection("users").doc(userId).update({ role, isAdmin: role === 'admin' });
    return { success: true, message: `Successfully updated role for user ${userId}.` };
  } catch (error) {
    logger.error("Error setting user role:", error);
    throw new HttpsError("internal", "Failed to set user role.");
  }
});

export const deleteUser = onCall(async (request) => {
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "The function must be called with a `userId`.");
  }

  try {
    await admin.auth().deleteUser(userId);
    await admin.firestore().collection("users").doc(userId).delete();
    return { success: true, message: `Successfully deleted user ${userId}.` };
  } catch (error) {
    logger.error("Error deleting user:", error);
    throw new HttpsError("internal", "Failed to delete user.");
  }
});

// TEMPORARY FUNCTION: Run this once to make yourself an admin, then DELETE it.
export const makeMeAdmin = onCall(async (request) => {
  const myEmail = "olive.raccoon.392@example.com";

  if (request.auth?.token.email !== myEmail) {
    throw new HttpsError("permission-denied", "This function is for the initial admin setup only.");
  }

  try {
    const user = await admin.auth().getUserByEmail(myEmail);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    
    await admin.firestore().collection("users").doc(user.uid).update({
      role: 'admin',
      isAdmin: true,
    });
    
    logger.info(`Successfully set 'admin' role for ${myEmail}.`);
    return { message: `Success! Admin role set for ${myEmail}. You can now remove this function.` };
  } catch (error) {
    logger.error("Error in makeMeAdmin function:", error);
    throw new HttpsError("internal", "Failed to set admin role.");
  }
});