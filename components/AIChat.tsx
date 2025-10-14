import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Contact, Book, Event } from '../types'; // Added Book, Event
import { processNaturalLanguageCommand } from '../services/geminiService';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import { User } from 'firebase/auth'; // NEW IMPORT
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'; // NEW IMPORTS
import { db } from '../src/firebaseConfig'; // NEW IMPORT

const MAX_MESSAGES = 50; // NEW CONSTANT

interface AIChatProps {
    onCommandProcessed: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string }>;
    isAdmin: boolean;
    currentUser: User;
    onAiSearch: (results: any[], view: 'contacts' | 'books' | 'events') => void;
}

const AIChat: React.FC<AIChatProps> = ({ onCommandProcessed, isAdmin, currentUser, onAiSearch }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // NEW FUNCTION: Save chat history to Firestore
    const saveChatHistory = async (currentMessages: ChatMessage[]) => {
        if (!currentUser) return;
        
        const messagesToSave = currentMessages.slice(Math.max(currentMessages.length - MAX_MESSAGES, 0));

        try {
            const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
            // FIX: Remove 'timestamp' from individual messages before saving to Firestore,
            // and add a top-level timestamp for sorting/tracking last update time.
            await setDoc(chatRef, { 
                messages: messagesToSave.map(msg => ({ 
                    ...msg, 
                    timestamp: null // Explicitly remove invalid timestamp field for array elements
                })),
                lastUpdated: serverTimestamp(), // NEW: Top-level timestamp for sorting
            }, { merge: false });
        } catch (e) {
            console.error("Error saving chat history:", e);
        }
    };

    // NEW FUNCTION: Load chat history from Firestore
    const loadChatHistory = async () => {
        if (!currentUser) return;
        try {
            const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
            const docSnap = await getDoc(chatRef);
            
            if (docSnap.exists() && docSnap.data().messages) {
                // Ensure loaded messages match the new interface (optional chaining for safety)
                setMessages(docSnap.data().messages.map((msg: any) => ({
                    id: msg.id,
                    sender: msg.sender,
                    text: msg.text,
                    userId: msg.userId,
                    timestamp: msg.timestamp,
                })) as ChatMessage[]);
            } else {
                setMessages([{
                    id: 'initial',
                    sender: 'ai',
                    text: "Hello! How can I help you manage your contacts today? Try 'Add a new contact...' or 'Find Jane Doe'.",
                    userId: 'ai-init', // Placeholder ID
                    timestamp: null,
                }]);
            }
        } catch (e) {
            console.error("Error loading chat history:", e);
            // Fallback to initial message
            setMessages([{
                id: 'initial',
                sender: 'ai',
                text: "Hello! How can I help you manage your contacts today? Try 'Add a new contact...' or 'Find Jane Doe'.",
                userId: 'ai-init',
                timestamp: null,
            }]);
        }
    };

    // NEW FUNCTION: Clear chat history from UI and Firestore
    const handleClearChat = async () => {
        if (window.confirm("Are you sure you want to clear your chat history? This action cannot be undone.")) {
            if (!currentUser) return;

            try {
                const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
                await deleteDoc(chatRef);
                
                // Clear local state and set initial message
                setMessages([{
                    id: 'initial',
                    sender: 'ai',
                    text: "Chat cleared. Hello! How can I help you manage your contacts today? Try 'Add a new contact...' or 'Find Jane Doe'.",
                    userId: 'ai-init',
                    timestamp: null,
                }]);
            } catch (e) {
                console.error("Error clearing chat history:", e);
                alert("Failed to clear chat history.");
            }
        }
    };

    useEffect(() => {
        if (currentUser) {
            loadChatHistory();
        } else {
            setMessages([]);
        }
    }, [currentUser]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    // Initial message logic removed - handled in loadChatHistory

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Check for currentUser as a guard clause
        if (!input.trim() || isThinking || !currentUser) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: input,
            userId: currentUser.uid, // NEW FIELD
            timestamp: new Date().toISOString(), // NEW FIELD
        };
        
        // Use a functional update to ensure we get the latest state before it's set
        const updatedMessagesAfterUser = [...messages, userMessage];
        setMessages(updatedMessagesAfterUser);
        setInput('');
        setIsThinking(true);

        try {
            const commandResponse = await processNaturalLanguageCommand(userMessage.text, isAdmin);
            const { intent, ...data } = commandResponse;

            const result = await onCommandProcessed(intent, data);
            
            let aiResponseText = result.message || commandResponse.responseText || "I'm not sure how to respond to that.";

            if (intent === 'FIND_CONTACT' && result.success) {
                 const foundContacts = result.payload as Contact[];
                 if (foundContacts.length > 0) {
                    onAiSearch(foundContacts, 'contacts');
                     const contactsText = foundContacts.map(c => {
                        const email = c.email || 'N/A';
                        const phone = c.phone || 'N/A';
                        const category = c.category || 'Other';
                        return `\n- ${c.firstName} ${c.lastName} (${category}): ${email}, Phone: ${phone}`;
                    }).join('');
                     aiResponseText = `I found the following contact(s): ${contactsText}`;
                 } else {
                     aiResponseText = `I couldn't find any contacts matching that description.`;
                 }
            }

            if (intent === 'FIND_BOOK' && result.success) {
                const foundBooks = result.payload as Book[];
                if (foundBooks.length > 0) {
                    onAiSearch(foundBooks, 'books');
                    const booksText = foundBooks.map(b => {
                        const isbn = b.isbn ? ` (ISBN: ${b.isbn})` : '';
                        const publisher = b.publisher ? ` by ${b.publisher}` : '';
                        return `\n- "${b.title}" by ${b.author}${publisher}. Price: $${b.price.toFixed(2)}, Stock: ${b.stock}${isbn}.`;
                    }).join('');
                    aiResponseText = `I found the following book(s): ${booksText}`;
                } else {
                    aiResponseText = `I couldn't find any books matching that description.`;
                }
            }

            if (intent === 'FIND_EVENT' && result.success) {
                // Supports enriched events with attendee list
                const foundEvents = result.payload as (Event & { attendees?: { firstName: string, lastName: string, email: string }[] })[];
                
                if (foundEvents.length > 0) {
                    onAiSearch(foundEvents, 'events');
                    const eventsText = foundEvents.map(e => {
                        const date = e.date ? new Date(e.date).toLocaleDateString() : 'N/A';
                        const time = e.time || 'N/A';
                        const location = e.location || 'N/A';
                        const author = e.author ? ` (Author: ${e.author})` : '';
                        const attendeeCount = e.attendees?.length ?? 0;
                        let attendeeList = '';

                        if (attendeeCount > 0) {
                            const attendeeNames = e.attendees!.map(a => `${a.firstName} ${a.lastName}`).join(', ');
                            attendeeList = `\n  - Attendees (${attendeeCount}): ${attendeeNames}`;
                        } else {
                            attendeeList = `\n  - Attendees (0): No one is currently registered.`;
                        }

                        return `\n- Event: ${e.name}${author}. Date: ${date}, Time: ${time}, Location: ${location}. Description: ${e.description || 'N/A'}.${attendeeList}`;
                    }).join('');
                    aiResponseText = `I found the following event(s): ${eventsText}`;
                } else {
                    aiResponseText = `I couldn't find any events matching that description.`;
                }
            }

            if (intent === 'SUMMARIZE_DATA' && result.success) {
                const summaryData = result.payload as any[];
                // Check if there is a payload to format
                if (summaryData && summaryData.length > 0) {
                    if (data.summaryTarget === 'customers') {
                        const summaryText = summaryData.map(c => `\n- ${c.name}: $${c.total.toFixed(2)}`).join('');
                        aiResponseText = `Here are the top customers by spending:${summaryText}`;
                    } else if (data.summaryTarget === 'books') {
                        const summaryText = summaryData.map(b => `\n- ${b.title}: ${b.quantity} sold`).join('');
                        aiResponseText = `Here are the top-selling books:${summaryText}`;
                    }
                // If there's no payload, the message from App.tsx contains the summary (e.g., contact count)
                } else if (result.message) {
                    aiResponseText = result.message;
                } else {
                    aiResponseText = "There is no data to summarize.";
                }
            }

            const aiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: aiResponseText,
                userId: currentUser.uid, // NEW FIELD
                timestamp: new Date().toISOString(), // NEW FIELD
            };
            
            const finalMessages = [...updatedMessagesAfterUser, aiMessage];
            setMessages(finalMessages);
            await saveChatHistory(finalMessages); // NEW: Save the updated list

        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "Sorry, I'm having trouble connecting to my brain right now.",
                userId: currentUser.uid, // NEW FIELD
                timestamp: new Date().toISOString(), // NEW FIELD
            };
            setMessages(prev => {
                const finalMessages = [...prev, errorMessage];
                saveChatHistory(finalMessages); // Save history on error too
                return finalMessages;
            });
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white shadow-lg rounded-xl">
            <header className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
            </header>
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'ai' && <div className="h-8 w-8 rounded-full bg-indigo-500 flex-shrink-0"></div>}
                            <div className={`px-4 py-2 rounded-2xl max-w-xs md:max-w-md ${
                                msg.sender === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex items-start gap-3">
                           <div className="h-8 w-8 rounded-full bg-indigo-500 flex-shrink-0"></div>
                           <div className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-none">
                             <div className="flex items-center space-x-1">
                               <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                               <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                               <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                             </div>
                           </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            {/* NEW: Clear Chat Button */}
            <div className="flex justify-between items-center px-4 pt-2">
                <button
                    type="button"
                    onClick={handleClearChat}
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                    Clear Chat
                </button>
            </div>
            {/* END NEW */}
            <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your command..."
                        className="flex-1 block w-full px-4 py-2 text-gray-900 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isThinking}
                    />
                    <button type="submit" disabled={isThinking || !input.trim()} className="p-2 text-white bg-indigo-600 rounded-full disabled:bg-indigo-300 disabled:cursor-not-allowed hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIChat;