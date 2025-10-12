import React, { useState, useMemo } from 'react';
import { AppUser, Contact } from '../types';
import { User } from 'firebase/auth';
import ContactTable from './ContactTable';
import ContactForm from './ContactForm';
import AIChat from './AIChat';
import PlusIcon from './icons/PlusIcon';
import logo from '../public/newsouthbookslogo.jpg';
import AdminPanel from './AdminPanel';

interface DashboardProps {
    contacts: Contact[];
    onAddContact: (contactData: Omit<Contact, 'id'>) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContact: (id: string) => void;
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any }>;
    onLogout: () => void;
    isAdmin: boolean;
    users: AppUser[];
    currentUser: User;
}

const Dashboard: React.FC<DashboardProps> = ({ contacts, onAddContact, onUpdateContact, onDeleteContact, onProcessAiCommand, onLogout, isAdmin, users, currentUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(true);

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
                   <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src={logo} alt="New South Books Logo" className="h-12 w-auto" />
                            <h1 className="text-3xl font-bold leading-tight text-gray-900">New South Index</h1>
                        </div>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors text-sm"
                        >
                            Logout
                        </button>
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
                            {isAdmin && (
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setIsAdminPanelOpen(prev => !prev)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                                    >
                                        {isAdminPanelOpen ? 'Hide Admin' : 'Show Admin'}
                                    </button>
                                    <button
                                        onClick={handleNewContact}
                                        className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                    >
                                       <PlusIcon className="h-5 w-5 mr-2" />
                                       New Contact
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {isAdmin && isAdminPanelOpen && <AdminPanel users={users} currentUser={currentUser} />}

                        <ContactTable 
                            contacts={filteredContacts}
                            onEdit={isAdmin ? handleEditContact : () => {}}
                            onDelete={isAdmin ? handleDeleteContact : () => {}}
                        />
                    </div>
                    {/* UPDATED: AI Chat column with toggle button */}
                    <div className="lg:col-span-1 space-y-4">
                        <button
                            onClick={() => setIsAiChatOpen(prev => !prev)}
                            className="w-full px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                        >
                            {isAiChatOpen ? 'Hide AI Assistant' : 'Show AI Assistant'}
                        </button>
                        {isAiChatOpen && (
                            <div className="h-[calc(85vh-4rem)]">
                                <AIChat onCommandProcessed={onProcessAiCommand} isAdmin={isAdmin} />
                            </div>
                        )}
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