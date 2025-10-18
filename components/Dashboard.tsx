import React, { useState, useMemo, useEffect } from 'react';
import { AppUser, Contact, Book, Transaction, Event } from '../types';
import { User } from 'firebase/auth';
import { httpsCallable } from "firebase/functions";
import { functions, auth, db } from "../src/firebaseConfig";
import ContactTable from "./ContactTable";
import ContactForm from "./ContactForm";
import BookTable from "./BookTable";
import BookForm from "./BookForm";
import TransactionTable from "./TransactionTable";
import TransactionForm from "./TransactionForm";
import EventTable from "./EventTable";
import EventForm from "./EventForm";
import AIChat from "./AIChat";
import LogoutIcon from "./icons/LogoutIcon";
import PlusIcon from "./icons/PlusIcon";
import UserCircleIcon from "./icons/UserCircleIcon";
import BeakerIcon from "./icons/BeakerIcon";
import UserPlusIcon from "./icons/UserPlusIcon";
import AdminPanel from "./AdminPanel";
import Reports from "./Reports";
import AIAssistantTestSuite from "./AIAssistantTestSuite";
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface DashboardProps {
    contacts: Contact[];
    onAddContact: (contactData: Omit<Contact, 'id'>) => Promise<{ success: boolean; message?: string }>;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContact: (id: string) => void;
    books: Book[];
    onAddBook: (bookData: Omit<Book, 'id'>) => void;
    onUpdateBook: (book: Book) => void;
    onDeleteBook: (id: string) => void;
    transactions: Transaction[];
    onAddTransaction: (data: { contactId: string; booksWithQuantity: { book: Book, quantity: number }[] }) => void;
    onUpdateTransaction: (transaction: Transaction, updatedData: Partial<Transaction>) => void; // NEW
    onDeleteTransaction: (id: string) => void;
    events: Event[];
    onAddEvent: (eventData: Omit<Event, 'id'>) => void;
    onUpdateEvent: (event: Event) => void;
    onDeleteEvent: (id: string) => void;
    onUpdateEventAttendees: (eventId: string, contactId: string, isAttending: boolean) => void;
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string; targetView?: View }>;
    onLogout: () => void;
    isAdmin: boolean;
    users: AppUser[];
    currentUser: User;
}

const makeMeAdmin = httpsCallable(functions, 'makeMeAdmin');

type View = 'contacts' | 'books' | 'transactions' | 'reports' | 'events';

const Dashboard: React.FC<DashboardProps> = ({ contacts, onAddContact, onUpdateContact, onDeleteContact, books, onAddBook, onUpdateBook, onDeleteBook, transactions, onAddTransaction, onUpdateTransaction, onDeleteTransaction, events, onAddEvent, onUpdateEvent, onDeleteEvent, onUpdateEventAttendees, onProcessAiCommand, onLogout, isAdmin, users, currentUser }) => {
    const [currentView, setCurrentView] = useState<View>('contacts');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [isBookFormOpen, setIsBookFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null); // NEW STATE
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(true);
    const [adminStatus, setAdminStatus] = useState<string | null>(null);
    const hasAdmins = useMemo(() => users.some(user => user.isAdmin), [users]);
    const [aiSearchResults, setAiSearchResults] = useState<any[] | null>(null);
    const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);
    const [shouldShowBecomeAdmin, setShouldShowBecomeAdmin] = useState(false);

    const handleAiSearch = (results: any[], view: View) => {
      setAiSearchResults(results);
      setCurrentView(view);
    };

    const handleViewChange = (view: View) => {
        setCurrentView(view);
        setAiSearchResults(null);
        setSearchQuery('');
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (aiSearchResults) {
            setAiSearchResults(null);
        }
    };

    const filteredContacts = useMemo(() => {
        if (aiSearchResults && currentView === 'contacts') {
            return aiSearchResults as Contact[];
        }
        return contacts.filter(contact =>
            `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.category}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [contacts, searchQuery, aiSearchResults, currentView]);

    const filteredBooks = useMemo(() => {
        if (aiSearchResults && currentView === 'books') {
            return aiSearchResults as Book[];
        }
        return books.filter(book =>
            `${book.title} ${book.author} ${book.isbn}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [books, searchQuery, aiSearchResults, currentView]);

    const filteredTransactions = useMemo(() => {
        if (aiSearchResults && currentView === 'transactions') {
            return aiSearchResults as Transaction[];
        }
        return transactions.filter(transaction =>
            transaction.contactName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [transactions, searchQuery, aiSearchResults, currentView]);

    const filteredEvents = useMemo(() => {
        if (aiSearchResults && currentView === 'events') {
            return aiSearchResults as Event[];
        }
        return events;
    }, [events, aiSearchResults, currentView]);

    // Wrapper function to process the AI command and handle the view switch based on the result
    const processAndHandleAiCommand = async (intent: string, data: any) => {
        // 1. Process the command via the App.tsx function
        const result = await onProcessAiCommand(intent, data); 

        // 2. Handle the view switch based on the result
        if (result.targetView) {
            const isSearchOrCount = ['FIND_CONTACT', 'FIND_BOOK', 'FIND_EVENT', 'FIND_TRANSACTION', 'COUNT_DATA'].includes(intent);

            if (isSearchOrCount && result.payload) {
                setAiSearchResults(result.payload);
                setCurrentView(result.targetView);
                setSearchQuery('');
            } else {
                setAiSearchResults(null);
                setSearchQuery('');
                setCurrentView(result.targetView);
            }
        }
        return result;
    };

    const handleNewTransaction = () => {
        setEditingTransaction(null);
        setIsTransactionFormOpen(true);
    };

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setIsTransactionFormOpen(true);
    };
    
    // Updated handler to accept the transaction to edit/null
    const handleSaveTransaction = (data: { transactionToEdit?: Transaction | null; contactId: string; booksWithQuantity: { book: Book, quantity: number }[] }) => {
        const { transactionToEdit, ...rest } = data;
        if (transactionToEdit) {
            // Note: Since TransactionForm handles the diff logic for updating stock correctly,
            // we will create a new transaction on edit in Firestore, and let App.tsx handle
            // the compensation logic for stock/original transaction deletion.
            onDeleteTransaction(transactionToEdit.id); // Delete the old one (which refunds stock)
            onAddTransaction(rest); // Add the new one (which deducts new stock)
            // This simplifies the UI logic but requires the atomic transaction logic in App.tsx
        } else {
            onAddTransaction(rest);
        }
        setIsTransactionFormOpen(false);
        setEditingTransaction(null); // Clear editing state
    };


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

    const handleNewEvent = () => {
        setEditingEvent(null);
        setIsEventFormOpen(true);
    };

    const handleEditEvent = (event: Event) => {
        setEditingEvent(event);
        setIsEventFormOpen(true);
    };

    const handleSaveEvent = (eventData: Omit<Event, 'id'> | Event) => {
        if ('id' in eventData) {
            onUpdateEvent(eventData);
        } else {
            onAddEvent(eventData);
        }
        setIsEventFormOpen(false);
    };

    useEffect(() => {
        const checkAdminExists = async () => {
            // This query is very efficient and checks if at least one admin document exists in the entire collection.
            const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
            const querySnapshot = await getDocs(q);
            // If the query result is empty, no admins exist, so we should show the button.
            setShouldShowBecomeAdmin(querySnapshot.empty);
        };

        // Only run this check if the current user is NOT an admin.
        if (!isAdmin) {
            checkAdminExists();
        }
    }, [isAdmin]);

    const handleMakeAdmin = async () => {
        setAdminStatus("Attempting to sync admin permissions...");
        try {
          // Use httpsCallable again
          const result: any = await makeMeAdmin();
          setAdminStatus("Success! Forcing a permissions refresh...");

          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true); // Force refresh token
          }
          window.location.reload(); // Reload page

        } catch (error: any) {
          console.error("Make admin error (callable):", error);
          setAdminStatus(`Error: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src="/newsouthbookslogo.jpg" alt="New South Books Logo" className="h-12 w-auto" />
                            <h1 className="text-3xl font-bold leading-tight text-gray-900">New South Index</h1>
                        </div>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors text-sm"
                        >
                            <LogoutIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-0">
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto scrollbar-hidden" aria-label="Tabs">
                        <button onClick={() => handleViewChange('contacts')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'contacts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Contacts</button>
                        <button onClick={() => handleViewChange('books')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'books' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Book Inventory</button>
                        <button onClick={() => handleViewChange('transactions')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Transactions</button>
                        <button onClick={() => handleViewChange('events')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'events' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Events</button>
                        <button onClick={() => handleViewChange('reports')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Reports</button>
                    </nav>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {adminStatus && <p className="text-sm text-center text-gray-600 p-2 bg-gray-100 rounded-md">{adminStatus}</p>}

                        {isAdmin && isAdminPanelOpen && <AdminPanel users={users} currentUser={currentUser} />}

                        {import.meta.env.DEV && isTestSuiteOpen && <AIAssistantTestSuite onProcessAiCommand={onProcessAiCommand} />}

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                {isAdmin ? (
                                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                                        <button
                                          onClick={() => setIsAdminPanelOpen(prev => !prev)}
                                          className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                                        >
                                          <UserCircleIcon className="h-5 w-5 sm:mr-2" />
                                          <span className="hidden sm:inline">{isAdminPanelOpen ? 'Hide Admin' : 'Show Admin'}</span>
                                        </button>

                                        {import.meta.env.DEV && (
                                          <button
                                            onClick={() => setIsTestSuiteOpen(prev => !prev)}
                                            className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-yellow-400 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-300 transition-colors"
                                          >
                                            <BeakerIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">{isTestSuiteOpen ? 'Hide Test Suite' : 'Show Test Suite'}</span>
                                          </button>
                                        )}
                                        
                                        {currentView === 'contacts' && (
                                          <button onClick={handleNewContact} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Contact</span>
                                          </button>
                                        )}
                                        {currentView === 'books' && (
                                          <button onClick={handleNewBook} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Book</span>
                                          </button>
                                        )}
                                        {currentView === 'transactions' && (
                                          <button onClick={handleNewTransaction} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Transaction</span>
                                          </button>
                                        )}
                                        {currentView === 'events' && (
                                          <button onClick={handleNewEvent} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Event</span>
                                          </button>
                                        )}
                                      </div>
                                ) : (
                                    shouldShowBecomeAdmin && (
                                        <div className="flex items-center gap-4">
                                            <p className="text-gray-600">No admin account detected.</p>
                                            <button
                                                onClick={handleMakeAdmin}
                                                className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                                            >
                                                Become First Admin
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                            {currentView !== 'reports' && (
                                <input
                                    type="text"
                                    placeholder={`Search ${currentView}...`}
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            )}
                        </div>

                        {currentView === 'contacts' && <ContactTable contacts={filteredContacts} onEdit={handleEditContact} onDelete={handleDeleteContact} isAdmin={isAdmin} onUpdateContact={onUpdateContact} />}
                        {currentView === 'books' && <BookTable books={filteredBooks} onEdit={handleEditBook} onDelete={onDeleteBook} isAdmin={isAdmin} onUpdateBook={onUpdateBook} />}
                        {/* UPDATED PROPS */}
                        {currentView === 'transactions' && <TransactionTable transactions={filteredTransactions} onEdit={handleEditTransaction} onDelete={onDeleteTransaction} isAdmin={isAdmin} onUpdateTransaction={onUpdateTransaction} />} 
                        {currentView === 'events' && <EventTable events={events} contacts={contacts} onEdit={handleEditEvent} onDelete={onDeleteEvent} onUpdateAttendees={onUpdateEventAttendees} isAdmin={isAdmin} onUpdateEvent={onUpdateEvent} />}
                        {currentView === 'reports' && <Reports contacts={contacts} transactions={transactions} books={books} />}
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
                                <AIChat 
                                    onCommandProcessed={processAndHandleAiCommand}
                                    isAdmin={isAdmin} 
                                    currentUser={currentUser} 
                                    onAiSearch={handleAiSearch}
                                />
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
                transactionToEdit={editingTransaction} // NEW PROP
            />
            <EventForm 
                isOpen={isEventFormOpen}
                onClose={() => setIsEventFormOpen(false)}
                onSave={handleSaveEvent}
                eventToEdit={editingEvent}
            />
        </div>
    );
};

export default Dashboard;
