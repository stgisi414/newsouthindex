import { useState, useEffect } from "react";
import { auth, db } from "./src/firebaseConfig";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
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
  getDoc,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import Dashboard from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { AppUser, Contact, Category, UserRole, Book, Transaction, Event } from "./types";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const idTokenResult = await currentUser.getIdTokenResult(true);
        const roleFromToken = (idTokenResult.claims.role as UserRole) || UserRole.APPLICANT;
        
        setUserRole(roleFromToken);
        setIsAdmin(roleFromToken === UserRole.ADMIN);

      } else {
        setUserRole(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && userRole !== UserRole.APPLICANT) {
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

      let unsubscribeUsers = () => {};
      if (userRole === UserRole.ADMIN) {
        const usersQuery = query(collection(db, "users"));
        unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          setUsers(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as AppUser)));
        });
      }

      return () => {
        unsubscribeContacts();
        unsubscribeBooks();
        unsubscribeTransactions();
        unsubscribeUsers();
        unsubscribeEvents();
      };
    } else {
      setContacts([]);
      setUsers([]);
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

  const updateContact = async (contactId: string, updatedData: Partial<Contact>) => {
    if (!isAdmin) {
      return { success: false, message: "Sorry, only admins can update contacts." };
    }
    try {
      const contactDoc = doc(db, "contacts", contactId);
      await updateDoc(contactDoc, {
        ...updatedData,
        lastModifiedDate: serverTimestamp(),
      });
      return { success: true, message: "Contact updated successfully." };
    } catch (error) {
      console.error("Error updating contact:", error);
      return { success: false, message: "There was an error updating the contact." };
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

  const addTransaction = async (transactionData: { contactId: string; booksWithQuantity: { book: Book, quantity: number }[] }) => {
    if (!isAdmin) return;
    const { contactId, booksWithQuantity } = transactionData;
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
      transactionDate: serverTimestamp(),
    });

    booksWithQuantity.forEach(({ book, quantity }) => {
      const bookRef = doc(db, "books", book.id);
      batch.update(bookRef, { stock: increment(-quantity) });
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

  const onProcessAiCommand = async (intent: string, data: any): Promise<{ success: boolean; payload?: any; message?: string }> => {
    switch (intent) {
      case 'ADD_CONTACT': {
        const contactData = data.contactData || {};
        const identifier = data.contactIdentifier || 'Unknown';
        
        const nameParts = identifier.split(' ').filter(p => p.length > 0);
        const firstName = contactData.firstName || nameParts[0] || 'Unknown';
        const lastName = contactData.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Contact');
        
        const newContact = {
            firstName: firstName,
            lastName: lastName,
            category: contactData.category || Category.OTHER,
            phone: contactData.phone || 'N/A',
            email: contactData.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@default.com`,
            notes: contactData.notes || `Added via AI.`,
        } as Omit<Contact, "id">;

        return await addContact(newContact);
      }
        
      case 'FIND_CONTACT': {
        if (userRole === UserRole.APPLICANT) {
          return { success: false, message: "You do not have permission to view contacts." };
        }
        const identifier = (data.contactIdentifier || '').toLowerCase();
        if (!identifier) {
          return { success: false, message: "Please tell me who you're looking for." };
        }
        const foundContacts = contacts.filter(c => 
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
        );
        return { success: true, payload: foundContacts };
      }

      case 'UPDATE_CONTACT': {
        if (!isAdmin) {
          return { success: false, message: "I'm sorry, but only admins can update contacts." };
        }
        const identifier = (data.contactIdentifier || '').toLowerCase();
        if (!identifier) {
          return { success: false, message: "I'm not sure which contact you want to update. Please specify a name or email." };
        }

        const foundContacts = contacts.filter(c => 
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
          c.email?.toLowerCase().includes(identifier)
        );

        if (foundContacts.length === 0) {
          return { success: false, message: `I couldn't find a contact matching "${data.contactIdentifier}".` };
        }

        if (foundContacts.length > 1) {
          return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
        }

        const contactToUpdate = foundContacts[0];
        const updateData = data.updateData || {};
        
        return await updateContact(contactToUpdate.id, updateData);
      }

      case 'DELETE_CONTACT': {
        if (!isAdmin) {
          return { success: false, message: "I'm sorry, but only admins can delete contacts." };
        }
        const identifier = (data.contactIdentifier || '').toLowerCase();
        if (!identifier) {
          return { success: false, message: "I'm not sure which contact you want to delete. Please specify a name or email." };
        }
        
        const foundContacts = contacts.filter(c => 
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(identifier) ||
          c.email?.toLowerCase().includes(identifier)
        );

        if (foundContacts.length === 0) {
          return { success: false, message: `I couldn't find a contact matching "${data.contactIdentifier}".` };
        }

        if (foundContacts.length > 1) {
          return { success: false, message: "I found multiple contacts matching that name. Can you be more specific?" };
        }

        const contactToDelete = foundContacts[0];
        
        return await deleteContact(contactToDelete.id);
      }

      case 'ADD_BOOK': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can add books." };
        const bookData = data.bookData || {};
        const newBook = {
          title: bookData.title || "Untitled",
          author: bookData.author || "Unknown Author",
          isbn: bookData.isbn || "",
          publisher: bookData.publisher || "",
          price: bookData.price || 0,
          stock: bookData.stock || 0,
        } as Omit<Book, "id">;
        await addBook(newBook);
        return { success: true, message: `Successfully added the book "${newBook.title}".` };
      }

      case 'FIND_BOOK': {
        const identifier = (data.bookIdentifier || '').toLowerCase();
        if (!identifier) return { success: false, message: "Please specify a book title or ISBN." };
        const foundBooks = books.filter(b => 
          b.title.toLowerCase().includes(identifier) ||
          b.author.toLowerCase().includes(identifier) ||
          b.isbn?.toLowerCase().includes(identifier)
        );
        return { success: true, payload: foundBooks };
      }

      case 'UPDATE_BOOK': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can update books." };
        const identifier = (data.bookIdentifier || '').toLowerCase();
        const foundBooks = books.filter(b => b.title.toLowerCase().includes(identifier));
        if (foundBooks.length === 0) return { success: false, message: `Could not find a book matching "${data.bookIdentifier}".`};
        if (foundBooks.length > 1) return { success: false, message: "Found multiple books with that title, please be more specific."};
        const bookToUpdate = foundBooks[0];
        await updateBook({ ...bookToUpdate, ...data.updateData });
        return { success: true, message: `Successfully updated "${bookToUpdate.title}".` };
      }

      case 'DELETE_BOOK': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can delete books." };
        const identifier = (data.bookIdentifier || '').toLowerCase();
        const foundBooks = books.filter(b => b.title.toLowerCase().includes(identifier));
        if (foundBooks.length === 0) return { success: false, message: `Could not find a book matching "${data.bookIdentifier}".`};
        if (foundBooks.length > 1) return { success: false, message: "Found multiple books with that title, please be more specific."};
        await deleteBook(foundBooks[0].id);
        return { success: true, message: `Successfully deleted "${foundBooks[0].title}".` };
      }

      case 'CREATE_TRANSACTION': {
         // This would be complex to handle via AI and is better suited for the form.
         return { success: false, message: "Please use the 'New Transaction' form to log a sale." };
      }

      case 'ADD_EVENT': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can add events." };
        const eventData = data.eventData || {};
        const newEvent = {
          name: eventData.name || "Untitled Event",
          date: eventData.date ? new Date(eventData.date) : new Date(),
          author: eventData.author || "",
          description: eventData.description || "",
        } as Omit<Event, "id">;
        await addEvent(newEvent);
        return { success: true, message: `Successfully scheduled the event "${newEvent.name}".` };
      }

      case 'FIND_EVENT': {
        const identifier = (data.eventIdentifier || '').toLowerCase();
        if (!identifier) return { success: false, message: "Please specify an event name." };
        const foundEvents = events.filter(e => 
          e.name.toLowerCase().includes(identifier)
        );
        return { success: true, payload: foundEvents };
      }

      case 'UPDATE_EVENT': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can update events." };
        const identifier = (data.eventIdentifier || '').toLowerCase();
        const foundEvents = events.filter(e => e.name.toLowerCase().includes(identifier));
        if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${data.eventIdentifier}".`};
        if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific."};
        const eventToUpdate = foundEvents[0];
        const updateData = data.updateData || {};
        if (updateData.date) {
            updateData.date = new Date(updateData.date);
        }
        await updateEvent({ ...eventToUpdate, ...updateData });
        return { success: true, message: `Successfully updated "${eventToUpdate.name}".` };
      }

      case 'DELETE_EVENT': {
        if (!isAdmin) return { success: false, message: "Sorry, only admins can delete events." };
        const identifier = (data.eventIdentifier || '').toLowerCase();
        const foundEvents = events.filter(e => e.name.toLowerCase().includes(identifier));
        if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${data.eventIdentifier}".`};
        if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific."};
        await deleteEvent(foundEvents[0].id);
        return { success: true, message: `Successfully deleted "${foundEvents[0].name}".` };
      }

      case 'ADD_ATTENDEE':
      case 'REMOVE_ATTENDEE': {
          if (!isAdmin) return { success: false, message: "Sorry, only admins can manage attendees." };
          const eventIdentifier = (data.eventIdentifier || '').toLowerCase();
          const contactIdentifier = (data.contactIdentifier || '').toLowerCase();

          if (!eventIdentifier || !contactIdentifier) {
              return { success: false, message: "Please specify both an event and a contact." };
          }
          
          const foundEvents = events.filter(e => e.name.toLowerCase().includes(eventIdentifier));
          if (foundEvents.length === 0) return { success: false, message: `Could not find an event matching "${data.eventIdentifier}".` };
          if (foundEvents.length > 1) return { success: false, message: "Found multiple events with that name, please be more specific." };
          
          const foundContacts = contacts.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactIdentifier));
          if (foundContacts.length === 0) return { success: false, message: `Could not find a contact matching "${data.contactIdentifier}".` };
          if (foundContacts.length > 1) return { success: false, message: "Found multiple contacts with that name, please be more specific." };
          
          const eventToUpdate = foundEvents[0];
          const contactToUpdate = foundContacts[0];
          const isAttending = intent === 'ADD_ATTENDEE';

          await updateEventAttendees(eventToUpdate.id, contactToUpdate.id, isAttending);

          const actionText = isAttending ? "added" : "removed";
          return { success: true, message: `Successfully ${actionText} ${contactToUpdate.firstName} ${contactToUpdate.lastName} ${isAttending ? 'to' : 'from'} the event "${eventToUpdate.name}".` };
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
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {user ? (
          userRole === UserRole.APPLICANT ? (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
              <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Waiting for Approval</h2>
                <p className="text-gray-600">Your account is pending approval from an administrator.</p>
                <button
                  onClick={handleLogout}
                  className="mt-6 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Dashboard
              contacts={contacts}
              onAddContact={addContact}
              onUpdateContact={(contact) => updateContact(contact.id, contact)}
              onDeleteContact={deleteContact}
              books={books}
              onAddBook={addBook}
              onUpdateBook={updateBook}
              onDeleteBook={deleteBook}
              transactions={transactions}
              onAddTransaction={addTransaction}
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
          )
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