
import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import { mockContacts } from './data/mockContacts';
import { Contact } from './types';

const App: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>(mockContacts);

    const addContact = (contactData: Omit<Contact, 'id'>) => {
        const newContact: Contact = {
            ...contactData,
            id: Date.now().toString(),
        };
        setContacts(prev => [newContact, ...prev]);
    };

    const updateContact = (updatedContact: Contact) => {
        setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    };

    const deleteContact = (id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
    };
    
    const findContact = (identifier: string): Contact[] => {
        const lowerIdentifier = identifier.toLowerCase();
        return contacts.filter(c => 
            c.email.toLowerCase() === lowerIdentifier ||
            `${c.firstName.toLowerCase()} ${c.lastName.toLowerCase()}`.includes(lowerIdentifier)
        );
    }
    
    const processAiCommand = async (intent: string, data: any): Promise<{ success: boolean; payload?: any }> => {
        console.log("Processing AI Command:", { intent, data });
        switch (intent) {
            case 'ADD_CONTACT':
                if (data.contactData) {
                    addContact(data.contactData);
                    return { success: true };
                }
                return { success: false };

            case 'FIND_CONTACT':
                if (data.contactIdentifier) {
                    const found = findContact(data.contactIdentifier);
                    return { success: true, payload: found };
                }
                return { success: false };

            case 'UPDATE_CONTACT': {
                if (data.contactIdentifier && data.updateData) {
                    const contactsToUpdate = findContact(data.contactIdentifier);
                    if (contactsToUpdate.length === 1) {
                         const updatedContact = { ...contactsToUpdate[0], ...data.updateData };
                         updateContact(updatedContact);
                         return { success: true };
                    }
                    // Handle multiple matches or no matches if necessary in a real app
                }
                return { success: false };
            }

            case 'DELETE_CONTACT': {
                if (data.contactIdentifier) {
                     const contactsToDelete = findContact(data.contactIdentifier);
                      if (contactsToDelete.length === 1) {
                         deleteContact(contactsToDelete[0].id);
                         return { success: true };
                    }
                }
                return { success: false };
            }
                
            default:
                console.warn(`Unhandled intent: ${intent}`);
                return { success: false };
        }
    };


    return (
        <Dashboard
            contacts={contacts}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            onProcessAiCommand={processAiCommand}
        />
    );
};

export default App;
