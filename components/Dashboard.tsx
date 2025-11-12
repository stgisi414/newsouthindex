import React, { useState, useMemo, useEffect } from 'react';
// FIX: Make sure UserRole is imported
import { AppUser, Contact, ExpenseReport, Category, UserRole } from '../types.ts'; 
import { User } from 'firebase/auth';
import { httpsCallable } from "firebase/functions";
import { functions, auth, db } from "../src/firebaseConfig.ts";
import ContactTable from "./ContactTable.tsx";
import ContactForm from "./ContactForm.tsx";
// Removed Book/Transaction/Event components
import ExpenseReportForm from "./ExpenseReportForm.tsx";
import ExpenseReportTable from "./ExpenseReportTable.tsx";
import AIChat from "./AIChat.tsx";
import LogoutIcon from "./icons/LogoutIcon.tsx";
import PlusIcon from "./icons/PlusIcon.tsx";
import UserCircleIcon from "./icons/UserCircleIcon.tsx";
import BeakerIcon from "./icons/BeakerIcon.tsx";
// import UserPlusIcon from "./icons/UserPlusIcon"; // Not used
import BookOpenIcon from "./icons/BookOpenIcon.tsx"; // Kept for Tutorial button
import AdminPanel from "./AdminPanel.tsx";
// import Reports from "./Reports"; // Removed old reports
import AIAssistantTestSuite from "./AIAssistantTestSuite.tsx";
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import FilterIcon from './icons/FilterIcon.tsx';
import ClipboardIcon from './icons/ClipboardIcon.tsx'; 
import AdvancedFilter, { FilterFieldConfig } from './AdvancedFilter.tsx';

// A simple XIcon for the clear button
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// --- Filter Configs ---
// Kept contacts
const contactFilterConfig: FilterFieldConfig[] = [
  { field: 'firstName', label: 'First Name', type: 'text' },
  { field: 'lastName', label: 'Last Name', type: 'text' },
  { field: 'email', label: 'Email', type: 'text' },
  { field: 'city', label: 'City', type: 'text' },
  { field: 'state', label: 'State', type: 'text' },
  { field: 'zip', label: 'Zip Code', type: 'text' },
  { field: 'category', label: 'Category', type: 'select', options: Object.values(Category) },
  { field: 'sendTNSBNewsletter', label: 'Newsletter', type: 'boolean', }
];

// Removed book, event, transaction configs

// --- Props Interface ---
interface DashboardProps {
    contacts: Contact[];
    onAddContact: (contactData: Omit<Contact, 'id'>) => Promise<{ success: boolean; message?: string }>;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContact: (id: string) => Promise<{ success: boolean; message?: string }>; 

    // Added Expense Report Props
    expenseReports: ExpenseReport[];
    onAddExpenseReport: (report: Omit<ExpenseReport, 'id'>) => void;
    onUpdateExpenseReport: (report: ExpenseReport) => void;
    onDeleteExpenseReport: (id: string) => void;
    
    onProcessAiCommand: (intent: string, data: any) => Promise<{ success: boolean; payload?: any; message?: string; targetView?: View }>;
    onLogout: () => void;
    onShowTutorial: () => void; 
    isAiChatOpen: boolean;
    onToggleAiChat: () => void;
    onForceSync: () => void;
    isAdmin: boolean;
    users: AppUser[];
    currentUser: User;

    // --- !! ADD THESE TWO PROPS !! ---
    // These must be passed down from App.tsx
    currentUserRole: UserRole | null;
    currentUserContactId: string | null;
}

const makeMeAdmin = httpsCallable(functions, 'makeMeAdmin');

// Updated View type
type View = 'contacts' | 'expense-reports' | 'admin' | 'reports'; // 'reports' is unused but kept for type safety

const Dashboard: React.FC<DashboardProps> = ({ 
    contacts, 
    onAddContact, 
    onUpdateContact, 
    onDeleteContact, 
    expenseReports, 
    onAddExpenseReport, 
    onUpdateExpenseReport, 
    onDeleteExpenseReport, 
    onProcessAiCommand, 
    onLogout, 
    onShowTutorial, 
    isAiChatOpen, 
    onToggleAiChat,
    onForceSync,
    isAdmin, 
    users, 
    currentUser,
    currentUserRole,
    currentUserContactId
}) => {
    
    // --- State ---
    const [currentView, setCurrentView] = useState<View>('contacts');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false); // For Contacts
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    
    // Added Expense Report State
    const [isExpenseReportFormOpen, setIsExpenseReportFormOpen] = useState(false);
    const [expenseReportToEdit, setExpenseReportToEdit] = useState<ExpenseReport | null>(null);

    const [printMode, setPrintMode] = useState(false);

    // Removed states for book, transaction, event forms
    
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [adminStatus, setAdminStatus] = useState<string | null>(null);
    const [aiSearchResults, setAiSearchResults] = useState<any[] | null>(null);
    const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);
    const [shouldShowBecomeAdmin, setShouldShowBecomeAdmin] = useState(false);
    
    // State for filtered contacts
    const [filteredContacts, setFilteredContacts] = useState(contacts);
    // Removed filtered state for books, events, transactions

    // --- AI & View Handlers ---
    const handleAiSearch = (results: any[], view: View) => {
      setAiSearchResults(results);
      setCurrentView(view);
    };

    const handleViewChange = (view: View) => {
        setCurrentView(view);
        setAiSearchResults(null);
        setSearchQuery('');
    };

    const handleClearAiFilter = () => {
        setAiSearchResults(null);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (aiSearchResults) {
            setAiSearchResults(null);
        }
    };

    // --- Memos ---
    // This memo now handles filtering for the manual search bar
    const manuallyFilteredContacts = useMemo(() => {
        // If contacts array isn't ready, return empty
        if (!contacts) return [];
        return contacts.filter(contact =>
            `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.category}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
    }, [contacts, searchQuery]);
    
    // This determines what is *actually* shown in the table
    const finalContactsList = useMemo(() => {
        if (aiSearchResults && currentView === 'contacts') {
            return aiSearchResults as Contact[];
        }
        // If advanced filter is active (i.e. filteredContacts is different from original contacts)
        // This check might be brittle if contacts load after filteredContacts is set.
        // A better check might be needed if advanced filter state is managed inside that component.
        // For now, assuming filteredContacts is the source of truth from AdvancedFilter.
        if (filteredContacts) { 
            return filteredContacts;
        }
        return manuallyFilteredContacts;
    }, [aiSearchResults, currentView, contacts, filteredContacts, manuallyFilteredContacts]);

    // --- !! ADD THIS 'useMemo' HOOK !! ---
    // This is the fix for the "Unknown User" bug.
    const staffContacts = useMemo(() => {
        // Get all contact IDs from users who have a staff-level role
        const staffUserContactIds = new Set(
            users
                .filter(user => 
                    user.contactId && (
                        user.role === UserRole.STAFF ||
                        user.role === UserRole.ADMIN ||
                        user.role === UserRole.BOOKKEEPER ||
                        user.role === UserRole.MASTER_ADMIN
                    )
                )
                .map(user => user.contactId)
        );
        
        // Filter the main contacts list to get the full contact objects
        return contacts.filter(contact => staffUserContactIds.has(contact.id));

    }, [users, contacts]); // This recalculates only when users or contacts change

    // Removed memos for books, transactions, events

    // --- AI Command Processor ---
    const processAndHandleAiCommand = async (intent: string, data: any) => {
        const result = await onProcessAiCommand(intent, data); 
        if (result.targetView) {
            const targetView = result.targetView as View;
            if (result.payload && Array.isArray(result.payload)) {
                setAiSearchResults(result.payload);
            } else {
                setAiSearchResults(null);
            }
            setSearchQuery('');
            setCurrentView(targetView);
        }
        return result;
    };

    // --- Contact Handlers ---
    const handleNewContact = () => {
        setEditingContact(null);
        setIsFormOpen(true);
    };

    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setIsFormOpen(true);
    };

    const handleDeleteContact = (id: string) => {
        // Use custom modal later
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

    // --- Expense Report Handlers (Modified) ---
    const handleNewExpenseReport = () => {
        setExpenseReportToEdit(null);
        setIsExpenseReportFormOpen(true);
        setPrintMode(false); // --- ADD THIS ---
    };

    // --- !! MODIFY THIS HANDLER !! ---
    const handleEditExpenseReport = (report: ExpenseReport, options: { isPrinting: boolean } = { isPrinting: false }) => {
        setExpenseReportToEdit(report);
        setIsExpenseReportFormOpen(true);
        setPrintMode(options.isPrinting); // --- MODIFY THIS ---
    };

    const handleSaveExpenseReport = (reportData: Omit<ExpenseReport, 'id'> | ExpenseReport) => {
        if ('id' in reportData) {
            onUpdateExpenseReport(reportData as ExpenseReport);
        } else {
            onAddExpenseReport(reportData);
        }
        setIsExpenseReportFormOpen(false);
        setPrintMode(false); // --- ADD THIS ---
    };

    const handleDeleteExpenseReport = (id: string) => {
        if (window.confirm("Are you sure you want to delete this expense report?")) {
            onDeleteExpenseReport(id);
        }
    };

    // Calculate next report number
    const nextReportNumber = useMemo(() => {
        if (!expenseReports || expenseReports.length === 0) return 1001;
        const max = Math.max(...expenseReports.map(r => r.reportNumber || 0));
        return max + 1;
    }, [expenseReports]);

    // Removed all handlers for Book, Transaction, Event

    // --- Admin Handlers ---
    useEffect(() => {
        const checkAdminExists = async () => {
            const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
            const querySnapshot = await getDocs(q);
            setShouldShowBecomeAdmin(querySnapshot.empty);
        };
        if (!isAdmin) {
            checkAdminExists();
        }
    }, [isAdmin]);

    const handleMakeAdmin = async () => {
        setAdminStatus("Attempting to sync admin permissions...");
        try {
            await makeMeAdmin();
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

     // Update filtered state when the original data changes
     useEffect(() => setFilteredContacts(contacts), [contacts]);
     // Removed useEffects for books, events, transactions

     // Determine which filter config and data to use
     let currentFilterConfig: FilterFieldConfig[] = [];
     let currentData: any[] = [];
     let currentSetFilteredData: React.Dispatch<React.SetStateAction<any[]>> = () => {};

     // This switch only selects the config for the AdvancedFilter component
     switch (currentView) {
       case 'contacts':
         currentFilterConfig = contactFilterConfig;
         currentData = contacts; // Pass original data to filter component
         currentSetFilteredData = setFilteredContacts; // Callback updates filtered contacts
         break;
       case 'expense-reports':
         // No filter config for expense reports yet
         break;
       // Removed cases for books, events, transactions
     }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src="/newsouthbookslogo.jpg" alt="NewSouth Books Logo" className="h-12 w-auto" />
                            <h1 className="text-3xl font-bold leading-tight text-gray-900">NewSouth Index</h1>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={onShowTutorial}
                                className="flex items-center px-3 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm"
                            >
                                <BookOpenIcon className="h-5 w-5 sm:mr-2" />
                                <span className="hidden sm:inline">Help & Tutorial</span>
                            </button>
                            <button
                                onClick={onLogout}
                                className="flex items-center px-3 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors text-sm"
                            >
                                <LogoutIcon className="h-5 w-5 sm:mr-2" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-0">
                {/* Top Tab Navigation */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto scrollbar-hidden" aria-label="Tabs">
                        <button onClick={() => handleViewChange('contacts')} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${currentView === 'contacts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Contacts</button>
                        
                        <button
                            onClick={() => handleViewChange('expense-reports')}
                            className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center ${currentView === 'expense-reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            <ClipboardIcon className="h-5 w-5 mr-2" />
                            Expense Reports
                        </button>
                        
                        {/* Removed Book, Transaction, Event, Report tabs */}
                    </nav>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Main content column */}
                    <div className={isAiChatOpen ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
                        
                        {/* Admin Status Messages */}
                        {adminStatus && <p className="text-sm text-center text-gray-600 p-2 bg-gray-100 rounded-md">{adminStatus}</p>}
                        
                        {/* Admin Panel (inline) */}
                        {isAdmin && currentView === 'admin' && <AdminPanel users={users} currentUser={currentUser} onForceSync={onForceSync} />}
                        
                        {/* Test Suite (inline) */}
                        {process.env.NODE_ENV !== 'production' && isTestSuiteOpen && <AIAssistantTestSuite onProcessAiCommand={onProcessAiCommand} />}

                        {/* Top Button Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleViewChange('admin')}
                                            className={`flex items-center justify-center p-2 sm:px-4 sm:py-2 font-semibold rounded-lg shadow-md transition-colors ${currentView === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                                        >
                                            <UserCircleIcon className="h-5 w-5 sm:mr-2" />
                                            <span className="hidden sm:inline">Admin Panel</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={onToggleAiChat}
                                        className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                                    >
                                        <span className="hidden sm:inline">{isAiChatOpen ? 'Hide AI' : 'Show AI'}</span>
                                        <span className="sm:hidden">{isAiChatOpen ? 'Hide' : 'Show'} AI</span>
                                    </button>

                                    {process.env.NODE_ENV !== 'production' && (
                                        <button
                                            onClick={() => setIsTestSuiteOpen(prev => !prev)}
                                            className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-yellow-400 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-300 transition-colors"
                                        >
                                            <BeakerIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">{isTestSuiteOpen ? 'Hide Test Suite' : 'Show Test Suite'}</span>
                                        </button>
                                    )}

                                    {/* "New" Buttons */}
                                    {isAdmin && currentView === 'contacts' && (
                                        <button onClick={handleNewContact} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Contact</span>
                                        </button>
                                    )}
                                    {currentView === 'expense-reports' && (
                                        <button onClick={handleNewExpenseReport} className="flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                                            <PlusIcon className="h-5 w-5 sm:mr-2 md:hidden" />
                                            <span className="hidden sm:inline">New Report</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* "Become Admin" Button */}
                            {!isAdmin && shouldShowBecomeAdmin && (
                                <div className="flex items-center gap-4">
                                    <p className="text-gray-600">No admin account detected.</p>
                                    <button
                                        onClick={handleMakeAdmin}
                                        className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition-colors"
                                    >
                                        Become First Admin
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Advanced Filter */}
                        {currentView === 'contacts' && currentFilterConfig.length > 0 && (
                            <AdvancedFilter
                                data={currentData}
                                filterConfig={currentFilterConfig}
                                onFilterChange={currentSetFilteredData}
                                initialOpen={false}
                            />
                        )}

                        {/* AI Search Result Banner */}
                        {aiSearchResults && currentView !== 'reports' && (
                            <div className="flex items-center justify-between p-3 my-4 bg-blue-100 border border-blue-300 text-blue-800 rounded-lg shadow-sm">
                                <div className="flex items-center">
                                    <FilterIcon className="h-5 w-5 mr-2" />
                                    <span className="font-medium text-sm">
                                        {`Showing ${aiSearchResults.length} result(s) from AI search.`}
                                    </span>
                                </div>
                                <button
                                    onClick={handleClearAiFilter}
                                    className="flex items-center px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                                >
                                    <XIcon className="h-4 w-4 mr-1" />
                                    Clear Filter
                                </button>
                            </div>
                        )}

                        {/* --- Main View Content --- */}
                        {currentView === 'contacts' && (
                            <ContactTable 
                                contacts={finalContactsList} // Use the final list
                                onEdit={handleEditContact} 
                                onDelete={handleDeleteContact} 
                                isAdmin={isAdmin} 
                                onUpdateContact={onUpdateContact} 
                            />
                        )}
                        
                        {/* --- !! MODIFY THIS !! --- */}
                        {currentView === 'expense-reports' && (
                             <ExpenseReportTable
                                reports={expenseReports}
                                onEdit={handleEditExpenseReport} // Now matches new signature
                                onDelete={handleDeleteExpenseReport}
                                isAdmin={isAdmin}
                                currentUserRole={currentUserRole} // Pass this prop
                            />
                        )}
                        {/* Admin view is now inline, so no table here */}
                    </div>

                    {/* AI Chat Column */}
                    {isAiChatOpen && (
                        <div className="lg:col-span-1 space-y-4">
                            <div className="h-[calc(85vh-4rem)]"> {/* Adjust height as needed */}
                                <AIChat
                                    onProcessCommand={processAndHandleAiCommand}
                                    isAdmin={isAdmin}
                                    currentUser={currentUser}
                                    onAiSearch={handleAiSearch} // This prop might not be used anymore
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            {isFormOpen && (
                <ContactForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSaveContact}
                    contactToEdit={editingContact}
                />
            )}
            
            {isExpenseReportFormOpen && (
                <ExpenseReportForm
                    isOpen={isExpenseReportFormOpen}
                    // --- MODIFY onClose ---
                    onClose={() => {
                        setIsExpenseReportFormOpen(false);
                        setPrintMode(false); // Add this
                    }}
                    onSave={handleSaveExpenseReport}
                    reportToEdit={expenseReportToEdit}
                    
                    // --- THESE ARE THE CRITICAL PROP CHANGES ---
                    // REPLACE 'contacts' and 'users' with 'staffContacts'
                    staffContacts={staffContacts}
                    // ADD the new props
                    currentUserContactId={currentUserContactId}
                    currentUserRole={currentUserRole}
                    isPrintMode={printMode}

                    // REMOVE these old props
                    // contacts={contacts} 
                    // nextReportNumber={nextReportNumber}
                    // currentUserEmail={currentUser?.email || ''}
                    // users={users}
                />
            )}
            
            {/* Removed BookForm, TransactionForm, EventForm modals */}
        </div>
    );
};

export default Dashboard;