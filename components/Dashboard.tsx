
import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import ContactTable from './ContactTable';
import ContactForm from './ContactForm';
import AIChat from './AIChat';
import PlusIcon from './icons/PlusIcon';
import logo from '../public/newsouthbookslogo.jpg';

interface DashboardProps {
    contacts: Contact[];
    onAddContact: (contactData: Omit<Contact, 'id'>) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContact: (id: string) => void;
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any }>;
}

const Dashboard: React.FC<DashboardProps> = ({ contacts, onAddContact, onUpdateContact, onDeleteContact, onProcessAiCommand }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

    const filteredContacts = useMemo(() => {
        return contacts.filter(contact =>
            `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.category}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [contacts, searchQuery]);

    const handleNewContact = () => {
        setEditingContact(null);
        setIsFormOpen(true);
    };

    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setIsFormOpen(true);
    };

    const handleDeleteContact = (id: string) => {
        if (window.confirm('Are you sure you want to delete this contact?')) {
            onDeleteContact(id);
        }
    };
    
    const handleSaveContact = (contactData: Omit<Contact, 'id'> | Contact) => {
        if ('id' in contactData) {
            onUpdateContact(contactData);
        } else {
            onAddContact(contactData);
        }
        setIsFormOpen(false);
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                   <div className="flex items-center gap-4">
                        <img src={logo} alt="New South Books Logo" className="h-12 w-auto" />
                        <h1 className="text-3xl font-bold leading-tight text-gray-900">New South Index</h1>
                   </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleNewContact}
                                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                               <PlusIcon className="h-5 w-5 mr-2" />
                               New Contact
                            </button>
                        </div>
                        <ContactTable 
                            contacts={filteredContacts}
                            onEdit={handleEditContact}
                            onDelete={handleDeleteContact}
                        />
                    </div>
                    <div className="lg:col-span-1 h-[85vh]">
                        <AIChat onCommandProcessed={onProcessAiCommand} />
                    </div>
                </div>
            </main>
            <ContactForm 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveContact}
                contactToEdit={editingContact}
            />
        </div>
    );
};

export default Dashboard;
