
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Contact } from '../types';
import { processNaturalLanguageCommand } from '../services/geminiService';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';

interface AIChatProps {
    onCommandProcessed: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string }>;
    isAdmin: boolean;
}

const AIChat: React.FC<AIChatProps> = ({ onCommandProcessed, isAdmin }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    useEffect(() => {
        setMessages([{
            id: 'initial',
            sender: 'ai',
            text: "Hello! How can I help you manage your contacts today? Try 'Add a new contact...' or 'Find Jane Doe'."
        }]);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: input,
        };
        setMessages(prev => [...prev, userMessage]);
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
                     const contactsText = foundContacts.map(c => `\n- ${c.firstName} ${c.lastName}, ${c.email}, ${c.phone}`).join('');
                     aiResponseText = `I found the following contact(s): ${contactsText}`;
                 } else {
                     aiResponseText = `I couldn't find any contacts matching that description.`;
                 }
            }


            const aiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: aiResponseText,
            };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "Sorry, I'm having trouble connecting to my brain right now.",
            };
            setMessages(prev => [...prev, errorMessage]);
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
