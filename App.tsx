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
} from "firebase/firestore";
import Dashboard from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { AppUser, Contact, Category, UserRole } from "./types";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
          setIsAdmin(userData.role === 'admin');
        } else {
          // If the user doc doesn't exist for some reason, default to applicant
          setUserRole(UserRole.APPLICANT);
          setIsAdmin(false);
        }
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
      // Fetch contacts only if user is a viewer or admin
      const contactsQuery = query(collection(db, "contacts"), orderBy("lastName", "asc"));
      const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
        const contactsList = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as Contact)
        );
        setContacts(contactsList);
      });

      if (userRole === UserRole.ADMIN) {
        const usersQuery = query(collection(db, "users"));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const usersList = snapshot.docs.map(
            (doc) => ({ ...doc.data(), id: doc.id } as AppUser)
          );
          setUsers(usersList);
        });
        // Return a cleanup function for both listeners
        return () => {
          unsubscribeContacts();
          unsubscribeUsers();
        };
      }

      return () => unsubscribeContacts();
    } else {
      setContacts([]);
      setUsers([]); // Clear users on logout or if applicant
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
    return <div>Loading...</div>;
  }

  return (
    <div>
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
    </div>
  );
}

export default App;