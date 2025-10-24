import { useState, useEffect, useRef } from "react";
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
import { AppUser, Contact, UserRole, Book, Transaction, Event } from "./types";

const seedDatabase = httpsCallable(functions, 'seedDatabase');

type View = 'contacts' | 'books' | 'transactions' | 'reports' | 'events';

// Utility function to remove undefined values from an object
const removeUndefined = (obj: Record<string, any>) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
    );
};


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
        createdBy: user?.email,
        createdDate: serverTimestamp(),
        lastModifiedDate: serverTimestamp(),
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
          lastModifiedDate: serverTimestamp(),
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
    await addDoc(collection(db, "books"), bookData);
  };
  const updateBook = async (book: Book) => {
    if (!isAdmin) return;
    const bookDoc = doc(db, "books", book.id);
    await updateDoc(bookDoc, { ...book });
  };
  const deleteBook = async (id: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "books", id));
  };

  const addTransaction = async (transactionData: { contactId: string; booksWithQuantity: { book: Book, quantity: number }[], transactionDate?: Date }) => {
    if (!isAdmin) return;
    // THIS LINE IS THE MAIN CHANGE: Destructure the new field
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
      // CRITICAL FIX: Use provided date or serverTimestamp()
      transactionDate: transactionDate ? transactionDate : serverTimestamp(),
    });

    booksWithQuantity.forEach(({ book, quantity }) => {
      const bookRef = doc(db, "books", book.id);
      batch.update(bookRef, { stock: increment(-quantity) });
    });

    await batch.commit();
};
  
  // NEW: Handler for inline transaction field updates
  const updateTransaction = async (transaction: Transaction, updatedData: Partial<Transaction>) => {
      if (!isAdmin) return;
      const transactionDoc = doc(db, "transactions", transaction.id);
      
      // Filter out undefined values (which could occur if updatedData contained one)
      const sanitizedData = removeUndefined(updatedData);

      await updateDoc(transactionDoc, sanitizedData);
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
    await addDoc(collection(db, "events"), { ...eventData, attendeeIds: [] });
  };

  const updateEvent = async (event: Event) => {
    if (!isAdmin) return;
    const eventDoc = doc(db, "events", event.id);
    await updateDoc(eventDoc, { ...event });
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

  // --- REWRITTEN AI Command Processor ---
  const onProcessAiCommand = async (intent: string, data: any): Promise<{ success: boolean; payload?: any; message?: string; targetView?: View }> => {
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
        const firstName = contactData?.firstName || nameParts[0] || 'Unknown';
        const lastName = contactData?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Contact');
        
        const newContact = {
            firstName: firstName,
            lastName: lastName,
            category: contactData?.category || category.OTHER,
            phone: contactData?.phone || 'N/A',
            email: contactData?.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@default.com`,
            notes: contactData?.notes || `Added via AI.`,
        } as Omit<Contact, "id">;

        const result = await addContact(newContact);
        return { ...result, targetView: 'contacts' };
      }
        
      case 'FIND_CONTACT': {
        if (userRole === UserRole.APPLICANT) {
          return { success: false, message: "You do not have permission to view contacts." };
        }
        const { contactIdentifier } = (data || {}) as { contactIdentifier?: string };
        const identifier = (contactIdentifier || '').toLowerCase();
        if (!identifier) {
          return { success: false, message: "Please tell me who you're looking for." };
        }
        const foundContacts = contacts.filter(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
        );
        return { success: true, payload: foundContacts, targetView: 'contacts' };
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
        
        // This is a direct update of a single field from AI, wrap it to match the standard function signature
        const result = await updateContact({ ...contactToUpdate, ...updateData });
        return { ...result, targetView: 'contacts' };
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
          title: bookData?.title || "Untitled",
          author: bookData?.author || "Unknown Author",
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

      case 'FIND_BOOK': {
        const { bookIdentifier } = (data || {}) as { bookIdentifier?: string };
        const identifier = (bookIdentifier || '').toLowerCase();
        if (!identifier) return { success: false, message: "Please specify a book title or ISBN." };
        const foundBooks = books.filter(b => 
          b.title.toLowerCase().includes(identifier) ||
          b.author.toLowerCase().includes(identifier) ||
          b.isbn?.toLowerCase().includes(identifier)
        );
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

        // Filters contain the final, normalized, capitalized filters (e.g., { category: 'Personal', state: 'AL' })
        const filters = updateData || countRequest.filters || {};
        
        const { target } = countRequest;
        let count = 0;
        let message = '';
        
        // Generate the description for the response message
        const filterDescriptions = Object.keys(filters).length > 0
            ? Object.entries(filters).map(([key, value]) => `${key} is '${value}'`).join(' and ')
            : '';

        const viewMap = { 'contacts': 'contacts', 'books': 'books', 'events': 'events' };
        const targetView: View | undefined = viewMap[target as keyof typeof viewMap];

        if (target === 'contacts') {
            let filtered = contacts;
            if (Object.keys(filters).length > 0) { 
                filtered = contacts.filter(c => {
                    let passes = true;
                    
                    // Category Filter (Handles 'not Client' and exact match)
                    if (filters.category) {
                        if (filters.category === 'not Client') {
                            if (c.category === category.CLIENT) passes = false;
                        } else {
                            if (c.category !== filters.category) passes = false;
                        }
                    }
                    
                    // State Filter 
                    if (filters.state && c.state !== filters.state) passes = false;
                    
                    // City Filter
                    if (filters.city && c.city !== filters.city) passes = false;
                    
                    // Zip Code Filter
                    if (filters.zip && c.zip !== filters.zip) passes = false;
                    
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
        const { target, metric, limit = 10 } = metricsRequest;
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
          name: eventData?.name || "Untitled Event",
          date: eventData?.date ? new Date(eventData.date) : new Date(),
          author: eventData?.author || "",
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

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {user ? (
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
              onUpdateTransaction={updateTransaction} // NEW HANDLER
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
        ) : (
          <Auth />
        )}
      </main>
      <footer className="w-full bg-white shadow-inner mt-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          © New South Books 2025 <i>All Rights Reserved.</i>
        </div>
      </footer>
    </div>
  );
}

export default App;
