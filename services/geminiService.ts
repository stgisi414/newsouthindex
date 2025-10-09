import { httpsCallable } from "firebase/functions";
import { functions } from "../src/firebaseConfig"; // Adjust the path if needed

const processCommandCallable = httpsCallable(functions, 'processCommand');

export const processNaturalLanguageCommand = async (command: string) => {
    try {
        const response = await processCommandCallable({ command });
        return response.data;
    } catch (error) {
        console.error("Error calling Firebase Function:", error);
        throw new Error("Failed to process command.");
    }
};