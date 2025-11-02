  import React, { useState, useEffect, useRef } from "react"; // Added React
  import { auth, db, functions } from "./src/firebaseConfig";
  import { onAuthStateChanged, User, signOut } from "firebase/auth";
  import { httpsCallable } from "firebase/functions";
  import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    onSnapshot,
    writeBatch,
    increment,
    arrayUnion,
    arrayRemove,
    getDoc,
  } from "firebase/firestore";
  import Dashboard from "./components/Dashboard";
  import { Auth } from "./components/Auth";
  import { AppUser, Contact, UserRole, Book, Transaction, Event, Category } from "./types"; // Import Category

  const seedDatabase = httpsCallable(functions, 'seedDatabase');

  type View = 'contacts' | 'books' | 'transactions' | 'reports' | 'events';

  // Utility function to remove undefined values from an object
  const removeUndefined = (obj: Record<string, any>) => {
      return Object.fromEntries(
          Object.entries(obj).filter(([, value]) => value !== undefined)
      );
  };

  // Utility function to capitalize the first letter of each word
  const capitalize = (s: string) => {
      if (!s) return s;
      return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // --- NEW APPLICANT MODAL COMPONENT ---
  // This component will be shown instead of the Dashboard for applicants
  const ApplicantModal: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg text-center">
          <img
            src="/newsouthbookslogo.jpg"
            alt="NewSouth Books Logo"
            className="w-auto h-16 mx-auto"
          />
          <h2 className="text-2xl font-bold text-gray-900">
            Access Pending
          </h2>
          <p className="text-gray-600">
            Your account has been created successfully, but is currently awaiting
            approval.
          </p>
          <p className="text-sm text-gray-500">
            An administrator must promote your role to 'Viewer' before you
            can access the dashboard.
          </p>
          <div className="pt-4">
            <button
              onClick={onLogout}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  };
  // --- END OF NEW COMPONENT ---


  function App() {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<Event[]>([]);
    const seeded = useRef(false);

    // NEW: Separate useEffect to listen for all users (required for 'Become First Admin' check, even for applicants)
    useEffect(() => {
      let unsubscribeUsers = () => {};
      if (user) {
        const usersQuery = query(collection(db, "users"));
        unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          setUsers(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as AppUser)));
        });
        return () => unsubscribeUsers();
      } else {
        setUsers([]);
      }
    }, [user]);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          const idTokenResult = await currentUser.getIdTokenResult(true);
          const roleFromToken = (idTokenResult.claims.role as UserRole) || UserRole.APPLICANT;
          
          setUserRole(roleFromToken);
          setIsAdmin(roleFromToken === UserRole.ADMIN);

          if (import.meta.env.DEV && roleFromToken !== UserRole.APPLICANT && !seeded.current) {
            seeded.current = true;
            console.log("In dev environment, attempting to seed database...");
            try {
              const result = await seedDatabase();
              console.log("Seeder function result:", result.data);
            } catch (error) {
              console.error("Error calling seeder function:", error);
            }
          }

        } else {
          setUserRole(null);
          setIsAdmin(false);
          seeded.current = false;
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

    useEffect(() => {
      if (user && userRole !== UserRole.APPLICANT) {
        // --- START CONNECTIVITY CHECKS ---
        console.log("Running initial connectivity checks...");

        // Check Firestore connectivity (simple read)
        const checkFirestore = async () => {
            if (!user) return; // Should not happen here, but good practice
            try {
                const userDocRef = doc(db, "users", user.uid);
                await getDoc(userDocRef); // Attempt to get the user document
                console.log("%cFirestore connectivity check: SUCCESS", "color: green");
            } catch (error: any) {
                console.error("%cFirestore connectivity check: FAILED", "color: red", error);
                // Log specific details if available
                if (error.code) console.error("Firestore Error Code:", error.code);
                if (error.message) console.error("Firestore Error Message:", error.message);
            }
        };

        // Check Functions connectivity (simple callable function)
        // We'll use a dummy function or just call makeMeAdmin and expect a specific error if it fails early
        const checkFunctions = async () => {
             // Use processCommand as a test target as makeMeAdmin requires auth context that might not be ready
             const testCommand = httpsCallable(functions, 'processCommand');
             try {
                 // Send a harmless command
                 await testCommand({ command: "hello" });
                 // We don't care about the Gemini result, just that the call didn't fail due to network/CORS
                 console.log("%cFunctions connectivity check: SUCCESS (Able to call)", "color: green");
             } catch (error: any) {
                 console.error("%cFunctions connectivity check: FAILED", "color: red", error);
                 if (error.code) console.error("Functions Error Code:", error.code);
                 if (error.message) console.error("Functions Error Message:", error.message);
             }
        };

        // Run the checks
        checkFirestore();
        checkFunctions();
        // --- END CONNECTIVITY CHECKS ---

        const contactsQuery = query(collection(db, "contacts"), orderBy("lastName", "asc"));
        const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
          setContacts(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Contact)));
        });

        const booksQuery = query(collection(db, "books"), orderBy("title", "asc"));
        const unsubscribeBooks = onSnapshot(booksQuery, (snapshot) => {
          setBooks(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Book)));
        });

        const transactionsQuery = query(collection(db, "transactions"), orderBy("transactionDate", "desc"));
        const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          setTransactions(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Transaction)));
        });

        const eventsQuery = query(collection(db, "events"), orderBy("date", "desc"));
        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
          setEvents(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Event)));
        });

        return () => {
          unsubscribeContacts();
          unsubscribeBooks();
          unsubscribeTransactions();
          unsubscribeEvents();
        };
      } else {
        setContacts([]);
        setBooks([]);
        setTransactions([]);
        setEvents([]);
      }
    }, [user, userRole]);

    const addContact = async (contactData: Omit<Contact, "id">) => {
      if (!isAdmin) {
        return { success: false, message: "Sorry, only admins can add new contacts." };
      }
       try {
        await addDoc(collection(db, "contacts"), {
          ...contactData,
          createdAt: serverTimestamp(),
          createdBy: user?.email,
          lastModifiedAt: serverTimestamp(),
          lastModifiedBy: user?.email,
        });
        return { success: true, message: `Successfully added ${contactData.firstName} ${contactData.lastName}.` };
      } catch (error) {
        console.error("Error adding contact:", error);
        return { success: false, message: "An error occurred while adding the contact." };
      }
    };

    const updateContact = async (contact: Contact) => {
      if (!isAdmin) return;
      try {
        const contactDoc = doc(db, "contacts", contact.id);
        
        // FIX: Filter out 'undefined' values before sending to Firestore
        const updateData = removeUndefined({
            ...contact,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
        
        await updateDoc(contactDoc, updateData);
      } catch (error) {
          console.error("Error updating contact:", error);
      }
    };

    const deleteContact = async (contactId: string) => {
      if (!isAdmin) {
        return { success: false, message: "Sorry, only admins can delete contacts." };
      }
      try {
        const contactDoc = doc(db, "contacts", contactId);
        await deleteDoc(contactDoc);
        return { success: true, message: "Contact deleted successfully." };
      } catch (error) {
        console.error("Error deleting contact:", error);
        return { success: false, message: "There was an error deleting the contact." };
      }
    };
    
    const addBook = async (bookData: Omit<Book, "id">) => {
        if (!isAdmin) return;
        const cleanBookData = removeUndefined(bookData);
        
        // --- FIX: The object { ... } goes *after* the collection() call
        await addDoc(collection(db, "books"), {
            ...cleanBookData,
            createdAt: serverTimestamp(),
            createdBy: user?.email,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
    };

    const updateBook = async (book: Book) => {
        if (!isAdmin) return;
        const bookDoc = doc(db, "books", book.id);
        
        // This is perfect. No changes needed.
        const updateData = removeUndefined({
            ...book,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
            
        await updateDoc(bookDoc, updateData);
    };
    const deleteBook = async (id: string) => {
      if (!isAdmin) return;
      await deleteDoc(doc(db, "books", id));
    };

    const addTransaction = async (transactionData: { contactId: string; booksWithQuantity: { book: Book, quantity: number }[], transactionDate?: Date }) => {
        if (!isAdmin) return;
        const { contactId, booksWithQuantity, transactionDate } = transactionData;
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return;

        const totalPrice = booksWithQuantity.reduce((sum, { book, quantity }) => sum + (book.price * quantity), 0);
            
        const batch = writeBatch(db);
        const transactionRef = doc(collection(db, "transactions"));

        batch.set(transactionRef, {
            contactId,
            contactName: `${contact.firstName} ${contact.lastName}`,
            books: booksWithQuantity.map(({ book, quantity }) => ({ 
                id: book.id, 
                title: book.title, 
                price: book.price, 
                quantity 
            })),
            totalPrice,
            transactionDate: transactionDate ? transactionDate : serverTimestamp(),
            
            // --- FIX: Add this metadata ---
            createdAt: serverTimestamp(),
            createdBy: user?.email,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });

        booksWithQuantity.forEach(({ book, quantity }) => {
            const bookRef = doc(db, "books", book.id);
            batch.update(bookRef, { stock: increment(-quantity) });
        });

        await batch.commit();
    };
        
    const updateTransaction = async (transaction: Transaction, updatedData: Partial<Transaction>) => {
        if (!isAdmin) return;
        const transactionDoc = doc(db, "transactions", transaction.id);
        
        const sanitizedData = removeUndefined(updatedData);

        // --- FIX: Add metadata to the update ---
        await updateDoc(transactionDoc, {
            ...sanitizedData,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
    };

    const deleteTransaction = async (transactionId: string) => {
      if (!isAdmin) return;
      const transactionToDelete = transactions.find(t => t.id === transactionId);
      if (!transactionToDelete) return;

      const batch = writeBatch(db);

      const transactionRef = doc(db, "transactions", transactionId);
      batch.delete(transactionRef);

      transactionToDelete.books.forEach(bookInTransaction => {
        const bookRef = doc(db, "books", bookInTransaction.id);
        batch.update(bookRef, { stock: increment(bookInTransaction.quantity) });
      });

      await batch.commit();
    };

    const addEvent = async (eventData: Omit<Event, "id">) => {
        if (!isAdmin) return;

        // --- FIX: Add metadata fields ---
        await addDoc(collection(db, "events"), {
            ...eventData,
            attendeeIds: [],
            createdAt: serverTimestamp(),
            createdBy: user?.email,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
    };

    const updateEvent = async (event: Event) => {
        if (!isAdmin) return;
        const eventDoc = doc(db, "events", event.id);

        // --- FIX: Add metadata fields ---
        await updateDoc(eventDoc, {
            ...event,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: user?.email,
        });
    };

    const deleteEvent = async (id: string) => {
      if (!isAdmin) return;
      await deleteDoc(doc(db, "events", id));
    };

    const updateEventAttendees = async (eventId: string, contactId: string, isAttending: boolean) => {
        if (!isAdmin) return;
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
            attendeeIds: isAttending ? arrayUnion(contactId) : arrayRemove(contactId),
        });
    };

    const getDateRangeFromTimeframe = (timeframe: string): { start: Date, end: Date } => {
        let end = new Date(); // Use 'let' instead of 'const'
        end.setHours(23, 59, 59, 999);
        let start = new Date();

        timeframe = timeframe.toLowerCase();

        if (timeframe === "today") {
            start.setHours(0, 0, 0, 0); // Start of today
        } else if (timeframe === "yesterday") {
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1); // End of yesterday
            end.setHours(23, 59, 59, 999);
        } else if (timeframe === "this week") {
            const dayOfWeek = start.getDay(); // 0 (Sun) - 6 (Sat)
            start.setDate(start.getDate() - dayOfWeek); // Go back to Sunday
            start.setHours(0, 0, 0, 0);
            // End remains end of today
        } else if (timeframe === "last week") {
            start.setDate(start.getDate() - start.getDay() - 7); // Go back to previous Sunday
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6); // End of the previous Saturday
            end.setHours(23, 59, 59, 999);
        } else if (timeframe === "this month") {
            start.setDate(1); // First day of the current month
            start.setHours(0, 0, 0, 0);
            // End remains end of today
        } else if (timeframe === "last month") {
            start = new Date(end.getFullYear(), end.getMonth() - 1, 1); // First day of last month
            start.setHours(0, 0, 0, 0);
            end = new Date(end.getFullYear(), end.getMonth(), 0); // Last day of last month
            end.setHours(23, 59, 59, 999);
        } else if (timeframe === "year-to-date" || timeframe === "this year") {
            start = new Date(end.getFullYear(), 0, 1); // January 1st of current year
            start.setHours(0, 0, 0, 0);
            // End remains end of today
        } else {
            // Default: If timeframe is unrecognized, maybe default to "today" or handle error
            start.setHours(0, 0, 0, 0);
        }

        return { start, end };
    };

    // --- REWRITTEN AI Command Processor ---
    const onProcessAiCommand = async (intent: string, data: any): Promise<{ success: boolean; payload?: any; message?: string; targetView?: View }> => {
      // Log exactly what was received
      console.log('%c[App.tsx Received Intent/Data]', 'color: blue; font-weight: bold;', { intent, data });
      console.log('%c[FRONTEND LOG] Processing AI Command:', 'color: green; font-weight: bold;', { intent, data });
      switch (intent) {
        case 'DELETE_TRANSACTION': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can delete transactions." };
          const { transactionIdentifier } = (data || {}) as { transactionIdentifier?: { contactName?: string, date?: string } };
          const contactName = transactionIdentifier?.contactName?.toLowerCase();
          
          if (!contactName) return { success: false, message: "Please specify a contact name for the transaction to delete." };

          const foundTransactions = transactions.filter(t => t.contactName.toLowerCase().includes(contactName));

          if (foundTransactions.length === 0) return { success: false, message: `Could not find any transactions for "${contactName}".` };
          if (foundTransactions.length > 1) return { success: false, message: `Found multiple transactions for "${contactName}". Please be more specific.` };
          
          await deleteTransaction(foundTransactions[0].id);
          return { success: true, message: `Successfully deleted transaction for ${foundTransactions[0].contactName}.`, targetView: 'transactions' };
        }
        case 'FIND_TRANSACTION': {
          const { transactionIdentifier } = (data || {}) as { transactionIdentifier?: { contactName?: string, date?: string } };
          const contactName = transactionIdentifier?.contactName?.toLowerCase();
          
          if (!contactName) return { success: false, message: "Please specify a contact name to find transactions." };

          const foundTransactions = transactions.filter(t => t.contactName.toLowerCase().includes(contactName));
          return { success: true, payload: foundTransactions, targetView: 'transactions' };
        }
        case 'ADD_CONTACT': {
            const { contactData } = (data || {}) as { contactData?: any };
            const { contactIdentifier } = (data || {}) as { contactIdentifier?: string };
            
            const nameParts = (contactIdentifier || '').split(' ').filter(p => p.length > 0);
            
            // Get the raw names, which might be lowercase
            const rawFirstName = contactData?.firstName || nameParts[0] || 'Unknown';
            const rawLastName = contactData?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Contact');
            
            // --- FIX: Handle category array ---
            // The AI will now send an array for category, based on our new tool definition.
            let categoryToSave: Category[];
            if (Array.isArray(contactData?.category) && contactData.category.length > 0) {
                categoryToSave = contactData.category;
            } else if (contactData?.category && typeof contactData.category === 'string') {
                // Fallback in case AI still sends a string (e.g., from old 'addContact' tool)
                categoryToSave = [contactData.category as Category];
            } else {
                // Default if not provided
                categoryToSave = [Category.OTHER];
            }
            // --- End Fix ---

            // Create the new contact with capitalized names
            const newContact = {
                firstName: capitalize(rawFirstName),
                lastName: capitalize(rawLastName),
                // --- FIX: Use middleName and assign category array ---
                middleName: contactData?.middleName || '', // Use middleName
                category: categoryToSave,
                // --- End Fix ---
                phone: contactData?.phone || 'N/A',
                email: contactData?.email || `${rawFirstName.toLowerCase()}.${rawLastName.toLowerCase()}@default.com`,
                notes: contactData?.notes || `Added via AI.`,
                // Add address fields from contactData, providing defaults if necessary
                address1: contactData?.address1 || '', // Use empty string if not provided
                address2: contactData?.address2 || '', // Assuming address2 might exist
                city: capitalize(contactData?.city || ''), // Capitalize city if present
                state: contactData?.state?.toUpperCase() || '', // Uppercase state if present
                zip: contactData?.zip || '',
            } as Omit<Contact, "id">;

            const result = await addContact(newContact);
            // The result.message will now use the capitalized names from newContact
            return { ...result, targetView: 'contacts' };
        }
          
        case 'FIND_CONTACT': {
            if (userRole === UserRole.APPLICANT) {
                return { success: false, message: "You do not have permission to view contacts." };
            }
            
            // --- FIX: Change filters type to 'any' to handle both string and array ---
            const { contactIdentifier, filters } = (data || {}) as { contactIdentifier?: string, filters?: any };
            // --- End Fix ---
            
            const identifier = (contactIdentifier || '').toLowerCase();
            
            let foundContacts = contacts;
            let message = "";
            let hasIdentifier = !!identifier;
            let hasFilters = false;
            const filterDescriptions: string[] = []; // To build the message

            // 1. Apply Filters First
            if (filters) {
                // --- FIX: Updated Category Filter Logic (Handles Array AND String) ---
                if (filters.category) {
                    hasFilters = true;
                    let filterCategories: string[] = [];

                    // Standardize the filter to an array
                    if (Array.isArray(filters.category) && filters.category.length > 0) {
                        filterCategories = filters.category.map((fc: string) => fc.toLowerCase());
                        filterDescriptions.push(`category '${filters.category.join(', ')}'`);
                    } else if (typeof filters.category === 'string') {
                        // This handles the current bug
                        filterCategories = [filters.category.toLowerCase()];
                        filterDescriptions.push(`category '${filters.category}'`);
                    }

                    if (filterCategories.length > 0) {
                        foundContacts = foundContacts.filter(c => {
                            // Get the contact's categories in lowercase, ensuring it's an array
                            const contactCategories = (Array.isArray(c.category) ? c.category : []).map(cc => cc.toLowerCase());
                            // Check if *any* of the contact's categories match *any* of the filter categories
                            return contactCategories.some(cc => filterCategories.includes(cc));
                        });
                    }
                }
                // --- End Fix ---

                if (filters.state) {
                    hasFilters = true;
                    const stateFilter = filters.state.toLowerCase();
                    foundContacts = foundContacts.filter(c => c.state?.toLowerCase() === stateFilter);
                    filterDescriptions.push(`state '${filters.state.toUpperCase()}'`);
                }
                if (filters.city) {
                    hasFilters = true;
                    const cityFilter = filters.city.toLowerCase();
                    foundContacts = foundContacts.filter(c => c.city?.toLowerCase().includes(cityFilter));
                    filterDescriptions.push(`city '${filters.city}'`);
                }
            }
            
            // 2. Apply Identifier Search on *already filtered* results
            if (hasIdentifier) {
                foundContacts = foundContacts.filter(c =>
                    `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
                    c.email?.toLowerCase().includes(identifier)
                );
            }
            
            // 3. Build Response Message
            if (foundContacts.length === 0) {
                if (hasIdentifier && hasFilters) {
                    message = `I couldn't find any contacts matching "${contactIdentifier}" with ${filterDescriptions.join(' and ')}.`;
                } else if (hasIdentifier) {
                    message = `I couldn't find any contacts matching "${contactIdentifier}".`;
                } else if (hasFilters) {
                    message = `I couldn't find any contacts with ${filterDescriptions.join(' and ')}.`;
                } else {
                    message = "I couldn't find any contacts."; // Should not happen if just "find contacts"
                }
            } else if (foundContacts.length > 1) {
                if (hasIdentifier && !hasFilters) {
                    message = `I found ${foundContacts.length} contacts matching "${contactIdentifier}". Displaying all.`;
                } else if (hasFilters) {
                    message = `I found ${foundContacts.length} contacts matching ${filterDescriptions.join(' and ')}.`;
                } else {
                    message = `Found ${foundContacts.length} contacts.`;
                }
            } else {
                // Found 1 contact
                message = `I found 1 contact: ${foundContacts[0].firstName} ${foundContacts[0].lastName}.`;
            }

            return { success: true, message: message, payload: foundContacts, targetView: 'contacts' };
        }

        case 'UPDATE_CONTACT': {
            if (!isAdmin) {
                return { success: false, message: "I'm sorry, but only admins can update contacts." };
            }
            const { contactIdentifier, updateData } = (data || {}) as { contactIdentifier?: string, updateData?: Partial<Contact> };
            const identifier = (contactIdentifier || '').toLowerCase();
            if (!identifier) {
                return { success: false, message: "I'm not sure which contact you want to update. Please specify a name or email." };
            }

            const foundContacts = contacts.filter(c => 
                `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
                c.email?.toLowerCase().includes(identifier)
            );

            if (foundContacts.length === 0) {
                return { success: false, message: `I couldn't find a contact matching "${contactIdentifier}".` };
            }

            if (foundContacts.length > 1) {
                return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
            }

            const contactToUpdate = foundContacts[0];
            
            // This line is correct. 
            // `updateData` will be (for example) { category: ["Customer", "Vendor"] }
            // The spread operator will merge this, overwriting the old contactToUpdate.category
            await updateContact({ ...contactToUpdate, ...updateData }); 
            return { success: true, message: `Updated ${contactToUpdate.firstName}`, targetView: 'contacts' };
        }

        case 'DELETE_CONTACT': {
          if (!isAdmin) {
            return { success: false, message: "I'm sorry, but only admins can delete contacts." };
          }
          const { contactIdentifier } = (data || {}) as { contactIdentifier?: string };
          const identifier = (contactIdentifier || '').toLowerCase();
          if (!identifier) {
            return { success: false, message: "I'm not sure which contact you want to delete. Please specify a name or email." };
          }
          
          const foundContacts = contacts.filter(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
          );

          if (foundContacts.length === 0) {
            return { success: false, message: `I couldn't find a contact matching "${contactIdentifier}".` };
          }

          if (foundContacts.length > 1) {
            return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
          }

          const contactToDelete = foundContacts[0];
          
          const result = await deleteContact(contactToDelete.id);
          return { ...result, targetView: 'contacts' };
        }

        case 'ADD_BOOK': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can add books." };
          const { bookData } = (data || {}) as { bookData?: Partial<Book> };
          
          const newBook = {
            title: capitalize(bookData?.title || "Untitled"),
            author: capitalize(bookData?.author || "Unknown Author"),
            isbn: bookData?.isbn || "",
            publisher: bookData?.publisher || "",
            price: bookData?.price || 0,
            stock: bookData?.stock || 0,
            genre: bookData?.genre || "",
            publicationYear: bookData?.publicationYear || undefined,
          } as Omit<Book, "id">;
          await addBook(newBook);
          return { success: true, message: `Successfully added the book "${newBook.title}".`, targetView: 'books' };
        }

        case 'FIND_BOOK': { // Or 'FIND_BOOKS' if you created a new intent
            const { bookIdentifier, filters } = (data || {}) as { bookIdentifier?: string, filters?: { genre?: string; publicationYearRange?: { start?: number; end?: number } } };
            const identifier = (bookIdentifier || '').toLowerCase();
            let foundBooks = books; // Start with all books

            // Apply filters if they exist
            if (filters) {
                if (filters.genre) {
                    const genreLower = filters.genre.toLowerCase();
                    foundBooks = foundBooks.filter(b => b.genre?.toLowerCase().includes(genreLower));
                }
                if (filters.publicationYearRange && filters.publicationYearRange.start && filters.publicationYearRange.end) {
                    const startYear = filters.publicationYearRange.start;
                    const endYear = filters.publicationYearRange.end;
                    foundBooks = foundBooks.filter(b => b.publicationYear && b.publicationYear >= startYear && b.publicationYear <= endYear);
                }
            }
            // Apply identifier search *after* filtering (or combine logic)
            else if (identifier) {
                foundBooks = foundBooks.filter(b =>
                    b.title.toLowerCase().includes(identifier) ||
                    b.author.toLowerCase().includes(identifier) ||
                    b.isbn?.toLowerCase().includes(identifier)
                );
            } else if (!filters) {
                 // Handle case where neither identifier nor filters were provided
                 return { success: false, message: "Please specify book details or filters to search for." };
            }

            // Return the filtered results
            return { success: true, payload: foundBooks, targetView: 'books' };
        }

        case 'UPDATE_BOOK': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can update books." };
          const { bookIdentifier, updateData } = (data || {}) as { bookIdentifier?: string, updateData?: Partial<Book> };
          const identifier = (bookIdentifier || '').toLowerCase();
          
          const foundBooks = books.filter(b => b.title.toLowerCase().includes(identifier));
          if (foundBooks.length === 0) return { success: false, message: `Could not find a book matching "${bookIdentifier}".`};
          if (foundBooks.length > 1) return { success: false, message: "Found multiple books with that title, please be more specific."};
          const bookToUpdate = foundBooks[0];
          await updateBook({ ...bookToUpdate, ...updateData });
          return { success: true, message: `Successfully updated "${bookToUpdate.title}".`, targetView: 'books' };
        }
        
        case 'COUNT_DATA': {
            if (userRole === UserRole.APPLICANT) {
                return { success: false, message: "You do not have permission to view this information." };
            }
            
            const { countRequest, updateData } = (data || {}) as { countRequest?: any, updateData?: any };

            if (!countRequest?.target) {
                return { success: false, message: "I'm sorry, I couldn't understand the count request." };
            }

            // Filters contain the final, normalized, capitalized filters (e.g., { category: ['Customer'], state: 'AL' })
            const filters = updateData || countRequest.filters || {};
            
            const { target } = countRequest;
            let count = 0;
            let message = '';
            
            // --- FIX: Generate filter descriptions, handling BOTH array and string ---
            const filterDescriptions = Object.keys(filters).length > 0
                ? Object.entries(filters).map(([key, value]) => {
                    if (key === 'category') {
                        if (Array.isArray(value)) {
                            if (value.includes('not Customer')) {
                                return "category is 'not Customer'";
                            }
                            return `category is '${value.join(', ')}'`;
                        }
                        // Handle the case where it's still a string
                        return `category is '${value}'`; 
                    }
                    return `${key} is '${value}'`;
                }).join(' and ')
                : '';
            // --- END FIX ---

            const viewMap = { 'contacts': 'contacts', 'books': 'books', 'events': 'events' };
            const targetView: View | undefined = viewMap[target as keyof typeof viewMap];

            if (target === 'contacts') {
                let filtered = contacts;
                
                if (Object.keys(filters).length > 0) {
                    filtered = contacts.filter(c => {
                        let passes = true;
                        const contactCategories = (Array.isArray(c.category) ? c.category : []).map(cat => cat.toLowerCase());

                        // --- FIX: Category Filter (Handles BOTH Array and String) ---
                        if (filters.category) {
                            let filterCategories: string[] = [];
                            
                            // Standardize the filter to an array
                            if (Array.isArray(filters.category)) {
                                filterCategories = filters.category.map((fc: string) => fc.toLowerCase());
                            } else if (typeof filters.category === 'string') {
                                // This handles the current bug
                                filterCategories = [filters.category.toLowerCase()];
                            }

                            if (filterCategories.length > 0) {
                                if (filterCategories.includes('not customer')) {
                                    // Handle "not Customer"
                                    if (contactCategories.includes(Category.Customer.toLowerCase())) {
                                        passes = false;
                                    }
                                } else {
                                    // Check if *at least one* of the contact's categories is present in the filter categories
                                    const match = filterCategories.some(fc => contactCategories.includes(fc));
                                    if (!match) {
                                        passes = false;
                                    }
                                }
                            }
                        }
                        // --- END FIX ---

                        // --- FIX: Added missing State, City, and Zip filters ---
                        if (filters.state) {
                            if (c.state?.toLowerCase() !== filters.state.toLowerCase()) {
                                passes = false;
                            }
                        }
                        
                        if (filters.city) {
                            if (c.city?.toLowerCase() !== filters.city.toLowerCase()) {
                                passes = false;
                            }
                        }
                        
                        if (filters.zip) {
                            if (c.zip?.toLowerCase() !== filters.zip.toLowerCase()) {
                                passes = false;
                            }
                        }
                        // --- END FIX ---
                        
                        return passes;
                    });
                }
                count = filtered.length;
                message = `There are ${count} contacts${filterDescriptions ? ` where ${filterDescriptions}` : ' in total'}.`;
            } else if (target === 'books') {
              let filtered = books;
              if (Object.keys(filters).length > 0) {
                  filtered = books.filter(b => {
                      let passes = true;
                      
                      if (filters.author && b.author !== filters.author) passes = false;
                      if (filters.genre && b.genre !== filters.genre) passes = false;
                      if (filters.stock === 0 && b.stock !== 0) passes = false;
                      if (filters.publisher && b.publisher !== filters.publisher) passes = false;
                      if (filters.publicationYear && b.publicationYear !== filters.publicationYear) passes = false;
                      
                      // *** CRITICAL: ADD PRICE FILTER LOGIC ***
                      if (passes && filters.priceFilter) {
                          const filterStr = filters.priceFilter.toString().toLowerCase().replace(/ /g, ''); 
                          const price = b.price;

                          if (filterStr.startsWith('<')) {
                              const limit = parseFloat(filterStr.slice(1));
                              if (price >= limit) passes = false; 
                          } else if (filterStr.startsWith('>')) {
                              const limit = parseFloat(filterStr.slice(1));
                              if (price <= limit) passes = false; 
                          } else if (filterStr.includes('-')) {
                              const [minStr, maxStr] = filterStr.split('-');
                              const min = parseFloat(minStr);
                              const max = parseFloat(maxStr);
                              if (price < min || price > max) passes = false;
                          }
                      }
                      // *** END PRICE FILTER LOGIC ***

                      return passes;
                  });
              }
              count = filtered.length;
              message = `There are ${count} books${filterDescriptions ? ` where ${filterDescriptions}` : ' in total'}.`;
          } else if (target === 'events') {
              let filtered = events;
              if (Object.keys(filters).length > 0) {
                  filtered = events.filter(e => {
                      let passes = true;
                      
                      // Author Filter (Guaranteed by backend to be present for names like Jane Doe)
                      if (filters.author && e.author !== filters.author) passes = false;
                      
                      // Location Filter
                      if (filters.location && e.location !== filters.location) passes = false;
                      
                      // Name Filter (Use includes for partial matches like "Poetry")
                      if (filters.name && !e.name.includes(filters.name)) passes = false;
                      
                      return passes;
                  });
              }
              count = filtered.length;
              message = `There are ${count} events${filterDescriptions ? ` where ${filterDescriptions}` : ' in total'}.`;
          } else {
              return { success: false, message: "I'm sorry, I can only count contacts, books, and events right now." };
          }

          const result = { success: true, message };
          console.log('%c[FRONTEND LOG] Count Result:', 'color: green;', result);
          return { ...result, targetView };
        }

        case 'METRICS_DATA': {
          if (userRole === UserRole.APPLICANT) {
            return { success: false, message: "You do not have permission to view this information." };
          }
          const { metricsRequest } = (data || {}) as { metricsRequest?: any }; // FIXED: Safely destructure
          if (!metricsRequest) {
            return { success: false, message: "I'm sorry, I couldn't understand the metrics request." };
          }
          const { target, metric, limit = 10, filters = {}, timeframe = "today" /* Default timeframe */ } = metricsRequest;
          if (target === 'customers' && metric === 'top-spending') {
              const customerSpending: { [key: string]: { name: string; total: number } } = {};
              transactions.forEach(t => {
                  if (!customerSpending[t.contactId]) {
                      customerSpending[t.contactId] = { name: t.contactName, total: 0 };
                  }
                  customerSpending[t.contactId].total += t.totalPrice;
              });
              const topCustomers = Object.values(customerSpending).sort((a, b) => b.total - a.total).slice(0, limit);
              return { success: true, payload: topCustomers, message: `Here are the top ${limit} customers by spending.`, targetView: 'reports' };
          }
          if (target === 'books' && metric === 'top-selling') {
              const bookSales: { [key: string]: { title: string; quantity: number } } = {};
              transactions.forEach(t => {
                  t.books.forEach(bookInTransaction => {
                      if (!bookSales[bookInTransaction.id]) {
                          const bookInfo = books.find(b => b.id === bookInTransaction.id);
                          bookSales[bookInTransaction.id] = { title: bookInfo?.title || 'Unknown Book', quantity: 0 };
                      }
                      bookSales[bookInTransaction.id].quantity += bookInTransaction.quantity;
                  });
              });
              const bestSellingBooks = Object.values(bookSales).sort((a, b) => b.quantity - a.quantity).slice(0, limit);
              return { success: true, payload: bestSellingBooks, message: `Here are the top ${limit} best-selling books.`, targetView: 'reports' };
          }
          if (target === 'books' && metric === 'total-stock') {
              // Calculate total stock by summing the stock of all books
              const totalStock = books.reduce((sum, book) => sum + book.stock, 0);
              return { 
                  success: true, 
                  payload: { total: totalStock },
                  message: `The total stock across all books is ${totalStock}.`, 
                  targetView: 'reports' 
              };
          }
          if (target === 'books' && metric === 'total-inventory-value') {
               const totalValue = books.reduce((sum, book) => sum + (book.price * book.stock), 0);
               return {
                   success: true,
                   // payload: { totalValue: totalValue.toFixed(2) }, // Optional payload
                   message: `The total retail value of your current inventory is $${totalValue.toFixed(2)}.`,
                   targetView: 'reports'
               };
            }
          if (target === 'events' && metric === 'upcoming') {
             const today = new Date();
             today.setHours(0, 0, 0, 0); // Set to start of today for comparison

             const upcomingEvents = events
                 .map(e => ({ // Convert Firestore Timestamps to JS Dates if necessary
                    ...e,
                    jsDate: e.date?.toDate ? e.date.toDate() : (e.date instanceof Date ? e.date : null)
                 }))
                 .filter(e => e.jsDate && e.jsDate >= today) // Filter for today or later
                 .sort((a, b) => a.jsDate!.getTime() - b.jsDate!.getTime()); // Sort by date ascending

             if (upcomingEvents.length > 0) {
                 const nextEvent = upcomingEvents[0];
                 const eventDate = nextEvent.jsDate!.toLocaleDateString();
                 const eventTime = nextEvent.time || 'N/A';
                 const eventLocation = nextEvent.location || 'N/A';
                 const eventAuthor = nextEvent.author ? ` by ${nextEvent.author}` : '';
                 // Return only the *next* event (limit = 1 from the few-shot example)
                 return {
                     success: true,
                     payload: [nextEvent], // Send as array for consistency with other FIND results
                     message: `The next event is "${nextEvent.name}"${eventAuthor} on ${eventDate} at ${eventTime}, Location: ${eventLocation}.`,
                     targetView: 'events'
                 };
             } else {
                 return { success: true, message: "There are no upcoming events scheduled.", targetView: 'events' };
             }
          }
          if (target === 'books' && metric === 'average-price') {
             let filteredBooks = books;
             let filterDescription = "";

             // Apply filters (currently supports genre, add 'format' if needed)
             if (filters.genre) {
                 const genreLower = filters.genre.toLowerCase();
                 filteredBooks = books.filter(b => b.genre?.toLowerCase().includes(genreLower));
                 filterDescription = ` for the genre "${filters.genre}"`;
             }
             // Example if you add format:
             // else if (filters.format) {
             //     const formatLower = filters.format.toLowerCase();
             //     filteredBooks = books.filter(b => b.format?.toLowerCase() === formatLower); // Assuming 'format' field exists
             //     filterDescription = ` for the format "${filters.format}"`;
             // }

             if (filteredBooks.length === 0) {
                 return { success: true, message: `Could not find any books${filterDescription} to calculate an average price.`, targetView: 'reports' };
             }

             const totalPrice = filteredBooks.reduce((sum, book) => sum + book.price, 0);
             const averagePrice = totalPrice / filteredBooks.length;

             return {
                 success: true,
                 // payload: { averagePrice: averagePrice.toFixed(2), count: filteredBooks.length }, // Optional payload
                 message: `The average price${filterDescription} is $${averagePrice.toFixed(2)} (based on ${filteredBooks.length} book(s)).`,
                 targetView: 'reports'
             };
          }
          if (target === 'contacts' && metric === 'vip-members') {
            const vipThreshold = 500; // Define your VIP spending threshold
            const customerSpending: { [key: string]: number } = {};
            transactions.forEach(t => {
                customerSpending[t.contactId] = (customerSpending[t.contactId] || 0) + t.totalPrice;
            });

            const vipContactIds = Object.entries(customerSpending)
                .filter(([_, total]) => total >= vipThreshold)
                .map(([contactId, _]) => contactId);

            const vipContacts = contacts.filter(c => vipContactIds.includes(c.id));

            if (vipContacts.length > 0) {
                 return {
                     success: true,
                     payload: vipContacts, // Send the list of VIP contacts
                     message: `Found ${vipContacts.length} VIP members (spent $${vipThreshold}+).`,
                     targetView: 'contacts' // Go to contacts view to show them
                 };
            } else {
                 return { success: true, message: `No contacts currently meet the VIP criteria (spent $${vipThreshold}+).`, targetView: 'contacts' };
            }
          }
          if (target === 'contacts' && metric === 'lapsed-customers') {
            const timeframe = metricsRequest.timeframe || "6 months"; // Default if not specified
            let monthsToSubtract = 6;
            if (timeframe.includes("1 year")) {
                monthsToSubtract = 12;
            } // Add more conditions if needed (e.g., "3 months")

            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsToSubtract);
            cutoffDate.setHours(0, 0, 0, 0); // Start of the day

            // Find the latest transaction date for each contact
            const lastPurchaseDate: { [key: string]: Date } = {};
            transactions.forEach(t => {
                const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : (t.transactionDate instanceof Date ? t.transactionDate : null);
                if (transactionDate) {
                    if (!lastPurchaseDate[t.contactId] || transactionDate > lastPurchaseDate[t.contactId]) {
                        lastPurchaseDate[t.contactId] = transactionDate;
                    }
                }
            });

            // Filter contacts: include those who have *never* purchased OR whose last purchase was *before* the cutoff
            const lapsedContacts = contacts.filter(c => {
                 // Exclude categories that shouldn't lapse (optional)
                 // if (c.category === Category.VENDOR || c.category === Category.MEDIA) return false;

                 const lastDate = lastPurchaseDate[c.id];
                 return !lastDate || lastDate < cutoffDate;
            });


            if (lapsedContacts.length > 0) {
                 return {
                     success: true,
                     payload: lapsedContacts,
                     message: `Found ${lapsedContacts.length} customers who haven't made a purchase in the last ${monthsToSubtract} months.`,
                     targetView: 'contacts'
                 };
            } else {
                 return { success: true, message: `All relevant contacts have made a purchase within the last ${monthsToSubtract} months.`, targetView: 'contacts' };
            }
          }
          if (target === 'transactions' && metric === 'total-revenue') {
              const { start, end } = getDateRangeFromTimeframe(timeframe);
              let totalRevenue = 0;

              transactions.forEach(t => {
                  const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : (t.transactionDate instanceof Date ? t.transactionDate : null);
                  if (transactionDate && transactionDate >= start && transactionDate <= end) {
                      totalRevenue += t.totalPrice;
                  }
              });

              return {
                  success: true,
                  message: `Total revenue for ${timeframe} is $${totalRevenue.toFixed(2)}.`,
                  targetView: 'reports'
              };
          }
          if (target === 'contacts' && metric === 'purchased-by-criteria') {
              const criteria = metricsRequest.criteria || {};
              const contactFilters = metricsRequest.filters || {}; // e.g., { contact_category: 'Loyalty Member' }

              let relevantBookIds = new Set<string>();

              // 1. Find books matching the criteria
              if (criteria.book_author) {
                  const authorLower = criteria.book_author.toLowerCase();
                  books.forEach(book => {
                      if (book.author.toLowerCase().includes(authorLower)) {
                          relevantBookIds.add(book.id);
                      }
                  });
              } else if (criteria.book_genre) {
                  const genreLower = criteria.book_genre.toLowerCase();
                   books.forEach(book => {
                      if (book.genre?.toLowerCase().includes(genreLower)) {
                          relevantBookIds.add(book.id);
                      }
                  });
              } // Add more criteria like title if needed

              if (relevantBookIds.size === 0) {
                   return { success: true, message: "Couldn't find any books matching the specified criteria." };
              }

              // 2. Find transactions containing those books to get customer IDs
              const customerIds = new Set<string>();
              transactions.forEach(t => {
                  t.books.forEach(bookInTransaction => {
                      if (relevantBookIds.has(bookInTransaction.id)) {
                          customerIds.add(t.contactId);
                      }
                  });
              });

              if (customerIds.size === 0) {
                   return { success: true, message: "Found books matching criteria, but no customers have purchased them yet." };
              }

              // 3. Filter contacts based on IDs and any additional contact filters
              let finalContacts = contacts.filter(c => customerIds.has(c.id));
              let filterDescription = "";

              if (contactFilters.contact_category) {
                   const categoryLower = contactFilters.contact_category.toLowerCase();
                   // Adjust category mapping if needed
                   const targetCategory = categoryLower === 'loyalty member' ? Category.CLIENT : categoryLower; // Example: map 'loyalty' to 'client'
                   finalContacts = finalContacts.filter(c => c.category?.toLowerCase() === targetCategory);
                   filterDescription = ` who are category '${contactFilters.contact_category}'`;
              }

              if (finalContacts.length > 0) {
                  let criteriaDesc = "";
                  if (criteria.book_author) criteriaDesc = `books by ${criteria.book_author}`;
                  else if (criteria.book_genre) criteriaDesc = `${criteria.book_genre} books`;

                   return {
                       success: true,
                       payload: finalContacts,
                       message: `Found ${finalContacts.length} contacts${filterDescription} who purchased ${criteriaDesc}.`,
                       targetView: 'contacts'
                   };
              } else {
                   return { success: true, message: `Found customers who purchased the items, but none matched the additional filters${filterDescription}.`, targetView: 'contacts' };
              }
          }
          if (target === 'customers' && metric === 'lifetime-value') {
              const identifier = (metricsRequest.contactIdentifier || '').toLowerCase();
              if (!identifier) {
                  return { success: false, message: "Please specify a customer to calculate their lifetime value." };
              }
              
              const foundContacts = contacts.filter(c => 
                  `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier)
              );

              if (foundContacts.length === 0) {
                  return { success: false, message: `I couldn't find a contact matching "${identifier}".` };
              }
              if (foundContacts.length > 1) {
                  return { success: false, message: `Found multiple contacts matching "${identifier}". Please be more specific.` };
              }

              const contact = foundContacts[0];
              const lifetimeValue = transactions
                  .filter(t => t.contactId === contact.id)
                  .reduce((sum, t) => sum + t.totalPrice, 0);

              return {
                  success: true,
                  message: `The lifetime value of ${contact.firstName} ${contact.lastName} is $${lifetimeValue.toFixed(2)}.`,
                  targetView: 'reports'
              };
          }
          if (target === 'contacts' && metric === 'recent-customers') {
              // Find the latest transaction date for each contact
              const lastPurchaseDate: { [key: string]: Date } = {};
              transactions.forEach(t => {
                  const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : (t.transactionDate instanceof Date ? t.transactionDate : null);
                  if (transactionDate) {
                      if (!lastPurchaseDate[t.contactId] || transactionDate > lastPurchaseDate[t.contactId]) {
                          lastPurchaseDate[t.contactId] = transactionDate;
                      }
                  }
              });
              
              // Sort customers by that date, descending
              const sortedCustomerIds = Object.entries(lastPurchaseDate)
                  .sort((a, b) => b[1].getTime() - a[1].getTime()) // Sort by date descending
                  .map(entry => entry[0]);

              // Get the full contact objects
              const recentContacts = sortedCustomerIds
                  .map(id => contacts.find(c => c.id === id))
                  .filter((c): c is Contact => !!c) // Remove undefined
                  .slice(0, limit); // Apply limit

              return { success: true, payload: recentContacts, message: `Here are the ${recentContacts.length} most recent customers.`, targetView: 'contacts' };
          }

          if (target === 'contacts' && metric === 'new-customer-count') {
              // PREREQUISITE: This assumes you add a 'createdAt' field (as a Date or Timestamp) 
              // to your Contact objects when they are created.
              if (!contacts[0]?.createdAt) {
                  return { success: false, message: "I can't calculate new customers without a 'createdAt' date field on the contact records." };
              }
              
              const { start, end } = getDateRangeFromTimeframe(timeframe); 
              
              const newContacts = contacts.filter(c => {
                   const createdDate = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt instanceof Date ? c.createdAt : null);
                   return createdDate && createdDate >= start && createdDate <= end;
              });
              
              return { 
                success: true, 
                message: `Found ${newContacts.length} new contacts for ${timeframe}.`, 
                payload: newContacts, // Send the list in case user wants to see them
                targetView: 'contacts' 
              };
          }
          return { success: false, message: "I'm sorry, I can't calculate those metrics." };
        }

        case 'DELETE_BOOK': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can delete books." };
          const { bookIdentifier } = (data || {}) as { bookIdentifier?: string }; // FIXED: Safely destructure
          const identifier = (bookIdentifier || '').toLowerCase();
          const foundBooks = books.filter(b => b.title.toLowerCase().includes(identifier));
          if (foundBooks.length === 0) return { success: false, message: `Could not find a book matching "${bookIdentifier}".`};
          if (foundBooks.length > 1) return { success: false, message: "Found multiple books with that title, please be more specific."};
          await deleteBook(foundBooks[0].id);
          return { success: true, message: `Successfully deleted "${foundBooks[0].title}".`, targetView: 'books' };
        }
        case 'CREATE_TRANSACTION': {
           return { success: false, message: "Please use the 'New Transaction' form to log a sale.", targetView: 'transactions' };
        }
        case 'ADD_EVENT': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can add events." };
          const { eventData } = (data || {}) as { eventData?: Partial<Event> }; // FIXED: Safely destructure
          const newEvent = {
            name: capitalize(eventData?.name || "Untitled Event"),
            date: eventData?.date ? new Date(eventData.date) : new Date(),
            author: capitalize(eventData?.author || ""),
            description: eventData?.description || "",
          } as Omit<Event, "id">;
          await addEvent(newEvent);
          return { success: true, message: `Successfully scheduled the event "${newEvent.name}".`, targetView: 'events' };
        }

        case 'FIND_EVENT': {
          const { eventIdentifier } = (data || {}) as { eventIdentifier?: string }; // FIXED: Safely destructure
          const identifier = (eventIdentifier || '').toLowerCase();
          if (!identifier) return { success: false, message: "Please specify an event name." };
          const foundEvents = events.filter(e => 
            e.name.toLowerCase().includes(identifier) ||
            e.description?.toLowerCase().includes(identifier) ||
            e.author?.toLowerCase().includes(identifier)
          );

          const enrichedEvents = foundEvents.map(e => {
              const attendees = (e.attendeeIds || [])
                  .map(id => contacts.find(c => c.id === id))
                  .filter((c): c is Contact => !!c)
                  .map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email }));
              
              return {
                  ...e,
                  date: e.date?.toDate().toISOString().split('T')[0],
                  attendees: attendees,
              };
          });

          return { success: true, payload: enrichedEvents, targetView: 'events' };
        }

        case 'UPDATE_EVENT': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can update events." };
          const { eventIdentifier, updateData } = (data || {}) as { eventIdentifier?: string, updateData?: Partial<Event> }; // FIXED: Safely destructure
          const identifier = (eventIdentifier || '').toLowerCase();
          const foundEvents = events.filter(e => e.name.toLowerCase().includes(identifier));
          if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${eventIdentifier}".`};
          if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific."};
          const eventToUpdate = foundEvents[0];
          if (updateData?.date) {
              updateData.date = new Date(updateData.date);
          }
          await updateEvent({ ...eventToUpdate, ...updateData });
          return { success: true, message: `Successfully updated "${eventToUpdate.name}".`, targetView: 'events' };
        }

        case 'DELETE_EVENT': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can delete events." };
          const { eventIdentifier } = (data || {}) as { eventIdentifier?: string }; // FIXED: Safely destructure
          const identifier = (eventIdentifier || '').toLowerCase();
          const foundEvents = events.filter(e => e.name.toLowerCase().includes(identifier));
          if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${eventIdentifier}".`};
          if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific."};
          await deleteEvent(foundEvents[0].id);
          return { success: true, message: `Successfully deleted "${foundEvents[0].name}".`, targetView: 'events' };
        }

        case 'ADD_ATTENDEE':
        case 'REMOVE_ATTENDEE': {
            if (!isAdmin) return { success: false, message: "Sorry, only admins can manage attendees." };
            const { eventIdentifier, contactIdentifier } = (data || {}) as { eventIdentifier?: string, contactIdentifier?: string }; // FIXED: Safely destructure
            const eventIdentifierLower = (eventIdentifier || '').toLowerCase();
            const contactIdentifierLower = (contactIdentifier || '').toLowerCase();
            if (!eventIdentifierLower || !contactIdentifierLower) {
                return { success: false, message: "Please specify both an event and a contact." };
            }
            const foundEvents = events.filter(e => e.name.toLowerCase().includes(eventIdentifierLower));
            if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${eventIdentifier}".` };
            if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific." };
            const foundContacts = contacts.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactIdentifierLower));
            if (foundContacts.length === 0) return { success: false, message: `Could not find a contact matching "${contactIdentifier}".` };
            if (foundContacts.length > 1) return { success: false, message: "Found multiple contacts with that name, please be more specific." };
            const eventToUpdate = foundEvents[0];
            const contactToUpdate = foundContacts[0];
            const isAttending = intent === 'ADD_ATTENDEE';
            await updateEventAttendees(eventToUpdate.id, contactToUpdate.id, isAttending);
            const actionText = isAttending ? "added" : "removed";
            return { success: true, message: `Successfully ${actionText} ${contactToUpdate.firstName} ${contactToUpdate.lastName} ${isAttending ? 'to' : 'from'} the event "${eventToUpdate.name}".`, targetView: 'events' };
        }

        case 'LOG_INTERACTION': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can log interactions." };
          
          const { contactIdentifier, interactionData } = (data || {}) as { contactIdentifier?: string, interactionData?: { type?: string, notes?: string } };
          const identifier = (contactIdentifier || '').toLowerCase();

          if (!identifier || !interactionData?.notes) {
              return { success: false, message: "Please specify a contact and the notes you want to log." };
          }

          // Find the contact (using logic from UPDATE_CONTACT)
          const foundContacts = contacts.filter(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
          );

          if (foundContacts.length === 0) {
            return { success: false, message: `I couldn't find a contact matching "${contactIdentifier}".` };
          }
          if (foundContacts.length > 1) {
            return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
          }
          
          const contactToUpdate = foundContacts[0];
          const type = interactionData?.type?.toUpperCase() || 'NOTE';
          const newNote = `[${new Date().toLocaleDateString()} - ${type}]: ${interactionData.notes}`;
          
          // Prepend the new note to existing notes
          const existingNotes = contactToUpdate.notes || '';
          const updatedNotes = `${newNote}\n${existingNotes}`.trim();

          // Call your existing updateContact function
          await updateContact({ ...contactToUpdate, notes: updatedNotes });
          
          return { success: true, message: `Logged interaction for ${contactToUpdate.firstName}.`, targetView: 'contacts' };
        }

      case 'GET_CUSTOMER_SUMMARY': {
          if (userRole === UserRole.APPLICANT) {
            return { success: false, message: "You do not have permission to view customer summaries." };
          }
          const { contactIdentifier } = (data || {}) as { contactIdentifier?: string };
          const identifier = (contactIdentifier || '').toLowerCase();

          if (!identifier) {
              return { success: false, message: "Please specify a contact to get their summary." };
          }

          // Find the contact
          const foundContacts = contacts.filter(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
          );

          if (foundContacts.length === 0) {
            return { success: false, message: `I couldn't find a contact matching "${contactIdentifier}".` };
          }
          if (foundContacts.length > 1) {
            return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
          }

          const contact = foundContacts[0];
          
          // 1. Get Transactions and Lifetime Value
          const contactTransactions = transactions.filter(t => t.contactId === contact.id);
          const lifetimeValue = contactTransactions.reduce((sum, t) => sum + t.totalPrice, 0);

          // 2. Get Events Attending
          const contactEvents = events
            .filter(e => e.attendeeIds?.includes(contact.id))
            .map(e => ({ id: e.id, name: e.name, date: e.date })); // Just get key info

          // 3. Combine into a summary payload
          const summary = {
              contactDetails: contact,
              lifetimeValue: lifetimeValue.toFixed(2),
              transactionCount: contactTransactions.length,
              transactions: contactTransactions.slice(0, 5), // Send last 5 for preview
              eventsAttending: contactEvents,
          };

          // This payload can be used to populate a modal or a dedicated summary view
          return { 
              success: true, 
              payload: summary, 
              message: `Here is the summary for ${contact.firstName} ${contact.lastName}.`,
              targetView: 'contacts' // Or a new 'summary' view if you build one
          };
        }

        default:
          return { success: true };
      }
    };

    const handleLogout = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error signing out:", error);
      }
    };

    if (loading) {
      return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    const renderContent = () => {
      // 1. If user is not logged in, show Auth page
      if (!user) {
        return <Auth />;
      }
      // 2. If user is logged in BUT is an applicant, show the pending modal
      if (userRole === UserRole.APPLICANT) {
        return <ApplicantModal onLogout={handleLogout} />;
      }
      // 3. If user is logged in AND is a Viewer or Admin, show the Dashboard
      return (
        <Dashboard
          contacts={contacts}
          onAddContact={addContact}
          onUpdateContact={updateContact}
          onDeleteContact={deleteContact}
          books={books}
          onAddBook={addBook}
          onUpdateBook={updateBook}
          onDeleteBook={deleteBook}
          transactions={transactions}
          onAddTransaction={addTransaction}
          onUpdateTransaction={updateTransaction}
          onDeleteTransaction={deleteTransaction}
          events={events}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onUpdateEventAttendees={updateEventAttendees}
          onProcessAiCommand={onProcessAiCommand}
          onLogout={handleLogout}
          isAdmin={isAdmin}
          users={users}
          currentUser={user}
        />
      );
    };

    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-grow">
          {/* This single function call now handles all logic */}
          {renderContent()}
        </main>
        <footer className="w-full bg-white shadow-inner mt-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
            © NewSouth Books 2025 <i>All Rights Reserved.</i>
          </div>
        </footer>
      </div>
    );
  }

  export default App;