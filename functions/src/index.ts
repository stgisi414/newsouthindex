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
          // CORRECTED: Updated system instructions for the AI
          systemInstruction:
            `You are an intelligent assistant for a CRM app that manages contacts, books, and transactions. Your task is to parse user commands into structured JSON data based on the provided schema. The user's admin status is: ${isAdmin}.
            - Your primary goal is to differentiate between contacts, books, and transactions. "Add a book" uses ADD_BOOK intent. "Add a person" uses ADD_CONTACT.
            - Identify the user's intent from the full list: ADD_CONTACT, FIND_CONTACT, UPDATE_CONTACT, DELETE_CONTACT, ADD_BOOK, FIND_BOOK, UPDATE_BOOK, DELETE_BOOK, CREATE_TRANSACTION, GENERAL_QUERY, UNSURE.
            - Extract all relevant details. For an ADD_BOOK command, populate the 'bookData' object. For an ADD_CONTACT command, populate the 'contactData' object.
            - If the user is NOT an admin and tries an admin action (add, update, delete), set the intent to 'GENERAL_QUERY' and use the responseText to inform them they do not have permission.
            - If the user IS an admin, confirm you are performing the action in the responseText.
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
    if (error instanceof HttpsError) {
        throw error;
    }
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
    if (error instanceof HttpsError) {
        throw error;
    }
    throw new HttpsError("internal", "Failed to delete user.");
  }
});

// You should now delete this function if you haven't already.
export const makeMeAdmin = onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
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
