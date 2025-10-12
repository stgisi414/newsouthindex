import React, { useState, useMemo } from 'react';
import { AppUser, Contact, Book, Transaction } from '../types';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../src/firebaseConfig';
import ContactTable from './ContactTable';
import ContactForm from './ContactForm';
import BookTable from './BookTable';
import BookForm from './BookForm';
import TransactionTable from './TransactionTable';
import TransactionForm from './TransactionForm';
import AIChat from './AIChat';
import PlusIcon from './icons/PlusIcon';
import logo from '../public/newsouthbookslogo.jpg';
import AdminPanel from './AdminPanel';

interface DashboardProps {
    contacts: Contact[];
    onAddContact: (contactData: Omit<Contact, 'id'>) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContact: (id: string) => void;
    books: Book[];
    onAddBook: (bookData: Omit<Book, 'id'>) => void;
    onUpdateBook: (book: Book) => void;
    onDeleteBook: (id: string) => void;
    transactions: Transaction[];
    onAddTransaction: (data: { contactId: string; books: Book[] }) => void;
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any }>;
    onLogout: () => void;
    isAdmin: boolean;
    users: AppUser[];
    currentUser: User;
}

const makeMeAdmin = httpsCallable(functions, 'makeMeAdmin');

type View = 'contacts' | 'books' | 'transactions';

const Dashboard: React.FC<DashboardProps> = ({ contacts, onAddContact, onUpdateContact, onDeleteContact, books, onAddBook, onUpdateBook, onDeleteBook, transactions, onAddTransaction, onProcessAiCommand, onLogout, isAdmin, users, currentUser }) => {
    const [currentView, setCurrentView] = useState<View>('contacts');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [isBookFormOpen, setIsBookFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(true);
    const [adminStatus, setAdminStatus] = useState<string | null>(null);

    const filteredContacts = useMemo(() => {
        return contacts.filter(contact =>
            `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.category}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [contacts, searchQuery]);

    const filteredBooks = useMemo(() => {
        return books.filter(book =>
            `${book.title} ${book.author} ${book.isbn}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [books, searchQuery]);

    const handleNewBook = () => {
        setEditingBook(null);
        setIsBookFormOpen(true);
    };

    const handleEditBook = (book: Book) => {
        setEditingBook(book);
        setIsBookFormOpen(true);
    };

    const handleSaveBook = (bookData: Omit<Book, 'id'> | Book) => {
        if ('id' in bookData) {
            onUpdateBook(bookData);
        } else {
            onAddBook(bookData);
        }
        setIsBookFormOpen(false);
    };
    
    const handleSaveTransaction = (data: { contactId: string; books: Book[] }) => {
        onAddTransaction(data);
        setIsTransactionFormOpen(false);
    };

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

    const handleMakeAdmin = async () => {
        setAdminStatus("Attempting to sync admin permissions...");
        try {
          const result: any = await makeMeAdmin();
          setAdminStatus("Success! Forcing a permissions refresh...");
    
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
          }
          
          window.location.reload();
    
        } catch (error: any) {
          console.error("Make admin error:", error);
          setAdminStatus(`Error: ${error.message}`);
        }
    };

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
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button onClick={() => setCurrentView('contacts')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${currentView === 'contacts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Contacts</button>
                        <button onClick={() => setCurrentView('books')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${currentView === 'books' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Book Inventory</button>
                        <button onClick={() => setCurrentView('transactions')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${currentView === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Transactions</button>
                    </nav>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                {isAdmin ? (
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <button
                                            onClick={() => setIsAdminPanelOpen(prev => !prev)}
                                            className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                                        >
                                            {isAdminPanelOpen ? 'Hide Admin' : 'Show Admin'}
                                        </button>
                                        
                                        {currentView === 'contacts' && (
                                            <button onClick={handleNewContact} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"><PlusIcon className="h-5 w-5 mr-2" />New Contact</button>
                                        )}
                                        {currentView === 'books' && (
                                            <button onClick={handleNewBook} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"><PlusIcon className="h-5 w-5 mr-2" />New Book</button>
                                        )}
                                        {currentView === 'transactions' && (
                                            <button onClick={() => setIsTransactionFormOpen(true)} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"><PlusIcon className="h-5 w-5 mr-2" />New Transaction</button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleMakeAdmin}
                                            className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                                        >
                                            Become First Admin
                                        </button>
                                    </div>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder={`Search ${currentView}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {adminStatus && <p className="text-sm text-center text-gray-600 p-2 bg-gray-100 rounded-md">{adminStatus}</p>}

                        {isAdmin && isAdminPanelOpen && <AdminPanel users={users} currentUser={currentUser} />}

                        {currentView === 'contacts' && <ContactTable contacts={filteredContacts} onEdit={isAdmin ? handleEditContact : () => {}} onDelete={isAdmin ? handleDeleteContact : () => {}} />}
                        {currentView === 'books' && <BookTable books={filteredBooks} onEdit={isAdmin ? handleEditBook : () => {}} onDelete={isAdmin ? onDeleteBook : () => {}} />}
                        {currentView === 'transactions' && <TransactionTable transactions={transactions} />}
                    </div>
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
            <BookForm 
                isOpen={isBookFormOpen} 
                onClose={() => setIsBookFormOpen(false)} 
                onSave={handleSaveBook} 
                bookToEdit={editingBook} 
            />
            <TransactionForm 
                isOpen={isTransactionFormOpen}
                onClose={() => setIsTransactionFormOpen(false)}
                onSave={handleSaveTransaction}
                contacts={contacts}
                books={books}
            />
        </div>
    );
};

export default Dashboard;