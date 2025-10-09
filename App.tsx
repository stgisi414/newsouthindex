import { useState, useEffect } from "react";
import { auth, db } from "./src/firebaseConfig"; 
import { onAuthStateChanged, User, signOut } from "firebase/auth"; // FIX 1: Add signOut
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import Dashboard from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { Contact, Category } from "./types";

// --- Main App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch contacts if a user is logged in
    if (user) {
      fetchContacts(user.uid);
    } else {
      // Clear contacts if user logs out
      setContacts([]);
    }
  }, [user]);

  // --- Firestore CRUD Functions ---

  const getContactsCollection = (uid: string) => {
    return collection(db, "users", uid, "contacts");
  };

  /**
   * Fetches all contacts for the current user from Firestore.
   */
  const fetchContacts = async (uid: string) => {
    try {
      const contactsCollection = getContactsCollection(uid);
      const q = query(contactsCollection, orderBy("lastName", "asc"));
      const snapshot = await getDocs(q);
      const contactsList = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Contact)
      );
      setContacts(contactsList);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  /**
   * Adds a new contact to Firestore.
   * @param contactData - The new contact's data, without createdDate or lastModifiedDate.
   */
  const addContact = async (contactData: Omit<Contact, "id" | "createdDate" | "lastModifiedDate">) => {
    if (!user) return;
    try {
      const contactsCollection = getContactsCollection(user.uid);
      await addDoc(contactsCollection, {
        ...contactData,
        createdBy: user.email, // Or user.displayName
        createdDate: serverTimestamp(),
        lastModifiedDate: serverTimestamp(),
      });
      fetchContacts(user.uid); // Refresh list
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  /**
   * Updates an existing contact in Firestore.
   * @param contactId - The ID of the contact to update.
   * @param updatedData - The fields to update.
   */
  const updateContact = async (contactId: string, updatedData: Partial<Contact>) => {
    if (!user) return;
    try {
      const contactDoc = doc(db, "users", user.uid, "contacts", contactId);
      await updateDoc(contactDoc, {
        ...updatedData,
        lastModifiedDate: serverTimestamp(),
      });
      fetchContacts(user.uid); // Refresh list
    } catch (error) {
      console.error("Error updating contact:", error);
    }
  };

  /**
   * Deletes a contact from Firestore.
   * @param contactId - The ID of the contact to delete.
   */
  const deleteContact = async (contactId: string) => {
    if (!user) return;
    try {
      const contactDoc = doc(db, "users", user.uid, "contacts", contactId);
      await deleteDoc(contactDoc);
      fetchContacts(user.uid); // Refresh list
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

  const onProcessAiCommand = async (intent: string, data: any): Promise<{ success: boolean; payload?: any }> => {
    switch (intent) {
      case 'ADD_CONTACT': { // ADDED: Opening block scope
        const contactData = data.contactData || {};
        const identifier = data.contactIdentifier || 'Unknown';
        
        // Attempt to parse name from identifier if separate name fields are missing
        const nameParts = identifier.split(' ').filter(p => p.length > 0);
        const firstName = contactData.firstName || nameParts[0] || 'Unknown';
        const lastName = contactData.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Contact');
        const defaultEmail = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}@default.com`;


        const newContact = {
            // Optional fields use AI data or empty string
            honorific: contactData.honorific || '',
            
            // Required fields are guaranteed to have a value
            firstName: firstName,
            lastName: lastName,
            category: contactData.category || Category.OTHER,
            phone: contactData.phone || 'N/A',
            email: contactData.email || defaultEmail,
            
            // Optional fields
            address: contactData.address || '',
            notes: contactData.notes || `Added via AI Assistant. Request for ${identifier}.`,
        } as Omit<Contact, "id" | "createdDate" | "lastModifiedDate">;

        await addContact(newContact);
        return { success: true };
      } // ADDED: Closing block scope
        
      case 'FIND_CONTACT': { // ADDED: Opening block scope
        const identifier = (data.contactIdentifier || '').toLowerCase();
        const foundContacts = contacts.filter(c => 
            c.firstName?.toLowerCase().includes(identifier) ||
            c.lastName?.toLowerCase().includes(identifier) ||
            c.email?.toLowerCase().includes(identifier)
        );
        // The found contacts are passed as payload for the AIChat to display.
        return { success: true, payload: foundContacts };
      } // ADDED: Closing block scope

      case 'UPDATE_CONTACT':
        // NOTE: In a complete application, logic to find the contact's ID 
        // based on data.contactIdentifier would be implemented here,
        // followed by calling updateContact(id, data.updateData).
        console.log(`[AI-COMMAND]: Skipping UPDATE - Needs implementation to find ID for: ${data.contactIdentifier}`);
        return { success: true };

      case 'DELETE_CONTACT':
        // NOTE: In a complete application, logic to find the contact's ID 
        // based on data.contactIdentifier would be implemented here,
        // followed by calling onDeleteContact(id).
        console.log(`[AI-COMMAND]: Skipping DELETE - Needs implementation to find ID for: ${data.contactIdentifier}`);
        return { success: true };

      case 'GENERAL_QUERY':
      case 'UNSURE':
      default:
        // No side effect needed for these intents.
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
    return <div>Loading...</div>; // Or a spinner component
  }

  return (
    <div>
      {user ? (
        <Dashboard
          contacts={contacts}
          onAddContact={addContact}
          onUpdateContact={updateContact}
          onDeleteContact={deleteContact}
          onProcessAiCommand={onProcessAiCommand}
          onLogout={handleLogout} // ADDITION: Pass the logout handler
        />
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;