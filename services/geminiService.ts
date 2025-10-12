import { httpsCallable } from "firebase/functions";
import { functions } from "../src/firebaseConfig";

const processCommandCallable = httpsCallable(functions, 'processCommand', { limitedUseAppCheckTokens: true }); 

export const processNaturalLanguageCommand = async (command: string, isAdmin: boolean) => {
    try {
        // UPDATED: Pass the isAdmin status in the payload
        const response = await processCommandCallable({ command, isAdmin });
        return response.data;
    } catch (error) {
        console.error("Error calling Firebase Function:", error);
        throw new Error("Failed to process command.");
    }
};