import { useState, useEffect } from "react";
import { auth, db } from "./src/firebaseConfig"; 
import { onAuthStateChanged, User } from "firebase/auth";
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
import { Contact } from "./types";

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
        />
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;