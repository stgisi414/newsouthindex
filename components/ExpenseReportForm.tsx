import React, { useState, useEffect, useMemo } from 'react';
// FIX: Added .ts and .tsx extensions to local imports
import { ExpenseReport, ExpenseReportItem, Contact, Category, AppUser, UserRole } from '../types.ts';
import { serverTimestamp } from 'firebase/firestore';
import DeleteIcon from './icons/DeleteIcon.tsx';
import PlusIcon from './icons/PlusIcon.tsx';

interface ExpenseReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: Omit<ExpenseReport, 'id'> | ExpenseReport) => void;
  reportToEdit?: ExpenseReport | null;
  contacts: Contact[];
  nextReportNumber: number;
  currentUserEmail: string; // The email of the logged-in user
  users: AppUser[]; // Prop to get admin/bookkeeper roles
}

// Helper to convert Firestore Timestamp to YYYY-MM-DD string
const formatTimestampToInputDate = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return ''; // Handle invalid dates
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return '';
  }
};

const ExpenseReportForm: React.FC<ExpenseReportFormProps> = ({
  isOpen,
  onClose,
  onSave,
  reportToEdit,
  contacts,
  nextReportNumber,
  currentUserEmail,
  users, // Receive users prop
}) => {
  const [reportNumber, setReportNumber] = useState(nextReportNumber);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [contactName, setContactName] = useState('');
  const [contactId, setContactId] = useState('');
  const [items, setItems] = useState<ExpenseReportItem[]>([
    { itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 },
  ]);
  const [dateSubmitted, setDateSubmitted] = useState('');
  const [errors, setErrors] = useState<{ staff?: string }>({}); // <-- ADD: Error state

  // Find the contact associated with the logged-in user's email
  const loggedInContact = useMemo(() => {
    if (!contacts || !currentUserEmail) return undefined;
    return contacts.find(c => c.email && c.email.toLowerCase() === currentUserEmail.toLowerCase());
  }, [contacts, currentUserEmail]);

  // --- FIX: Updated staff filter logic ---
  const staffContacts = useMemo(() => {
    // --- ADD DEBUG LOGS ---
    console.log("--- DEBUGGING STAFF DROPDOWN ---");
    console.log("Users prop (Admins, etc.):", users);
    console.log("Contacts prop (All contacts):", contacts);
    // --- END DEBUG LOGS ---

    if (!contacts || !users) return [];
    
    // Get emails of all admins and bookkeepers from the *users* list
    const internalUserEmails = new Set(
      users
        // --- FIX: Added check for isMasterAdmin ---
        .filter(u => 
          (
            u.role === UserRole.ADMIN || 
            u.role === UserRole.BOOKKEEPER ||
            u.isMasterAdmin === true // <-- THIS IS THE FIX
          ) &&
          u.email 
        )
        .map(u => u.email.toLowerCase())
    );

    // --- ADD DEBUG LOG ---
    console.log("Found Admin/Bookkeeper Emails:", internalUserEmails);
    // --- END DEBUG LOG ---

    // Filter the *contacts* list
    const filtered = contacts.filter(c => 
      // Condition 1: Contact is in "Staff" category
      (c.category && c.category.includes(Category.STAFF)) || 
      // Condition 2: Contact's email is in the list of internal users
      (c.email && internalUserEmails.has(c.email.toLowerCase()))
    );

    // --- ADD DEBUG LOG ---
    console.log("Filtered Contacts (Result):", filtered);
    // --- END DEBUG LOG ---

    // Remove duplicates (just in case)
    const uniqueContacts = Array.from(new Map(filtered.map(c => [c.id, c])).values());
    
    // Sort them alphabetically
    return uniqueContacts.sort((a, b) => 
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );
  }, [contacts, users]); // Added users dependency
  // --- END FIX ---

  useEffect(() => {
    if (isOpen) {
      setErrors({}); // <-- ADD: Clear errors when form opens
      if (reportToEdit) {
        // Editing existing report
        setReportNumber(reportToEdit.reportNumber || 1000);
        setReportDate(formatTimestampToInputDate(reportToEdit.reportDate));
        
        // --- FIX: Use staffContactId and staffName ---
        setContactId(reportToEdit.staffContactId || '');
        setContactName(reportToEdit.staffName || '');
        
        // Ensure items is an array, provide default if not
        setItems(reportToEdit.items && reportToEdit.items.length > 0 ? reportToEdit.items.map(item => ({
          ...item,
          itemDate: formatTimestampToInputDate(item.itemDate) // Ensure itemDate is string
        })) : [{ itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
        setDateSubmitted(formatTimestampToInputDate(reportToEdit.dateSubmitted));
      } else {
        // Creating new report
        setReportNumber(nextReportNumber);
        setReportDate(new Date().toISOString().split('T')[0]);
        
        // Pre-fill user's name if found
        if (loggedInContact) {
          setContactName(`${loggedInContact.firstName} ${loggedInContact.lastName}`);
          setContactId(loggedInContact.id);
        } else {
          // --- FIX: Default to an empty selection ---
          setContactName(''); 
          setContactId('');
        }
        setItems([{ itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
        setDateSubmitted('');
      }
    }
  }, [isOpen, reportToEdit, nextReportNumber, loggedInContact, staffContacts]); // Added staffContacts dependency

  const handleItemChange = (index: number, field: keyof ExpenseReportItem, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === 'cashAmount') {
      newItems[index] = { ...item, [field]: parseFloat(value as string) || 0 };
    } else {
      newItems[index] = { ...item, [field]: value };
    }
    setItems(newItems);
  };

  // --- ADD: Handle staff dropdown change ---
  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedContact = staffContacts.find(c => c.id === selectedId);
    if (selectedContact) {
      setContactId(selectedContact.id);
      setContactName(`${selectedContact.firstName} ${selectedContact.lastName}`);
      if (errors.staff) {
        setErrors(prev => ({ ...prev, staff: undefined })); // Clear error on selection
      }
    } else {
      // --- ADD: Handle deselecting (if they choose the disabled option) ---
      setContactId('');
      setContactName('');
    }
  };

  const addNewItemRow = () => {
    setItems([...items, { itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return; // Don't remove the last row
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.cashAmount) || 0), 0);
  }, [items]);

  // --- ADD: Validation function ---
  const validateForm = (): boolean => {
    const newErrors: { staff?: string } = {};
    if (!contactId || contactId === '') {
      newErrors.staff = 'A staff member must be selected.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return; // Stop submission if validation fails
    }

    const reportData = {
      reportNumber: reportNumber,
      reportDate: reportToEdit ? reportToEdit.reportDate : serverTimestamp(), // Keep original creation date
      
      // --- FIX: Use staffContactId and staffName ---
      staffContactId: contactId,
      staffName: contactName,
      
      items: items.map(item => ({
        ...item,
        itemDate: item.itemDate ? new Date(item.itemDate) : new Date(), // Convert string to Date for Firestore
        cashAmount: Number(item.cashAmount) || 0
      })),
      totalAmount: totalAmount, // Use totalAmount to match type
      dateSubmitted: dateSubmitted ? new Date(dateSubmitted) : null,
      status: dateSubmitted ? 'Submitted' : 'Draft',
    };

    if (reportToEdit) {
      onSave({ ...reportToEdit, ...reportData });
    } else {
      onSave(reportData as Omit<ExpenseReport, 'id'>);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 m-4 max-w-4xl w-full max-h-[90vh] flex flex-col font-serif">
        {/* --- Header --- */}
        <div className="text-center border-b pb-4 mb-4 border-gray-300">
          <h2 className="text-4xl font-bold text-gray-800">NewSouth Books</h2>
          <p className="text-sm text-gray-600">
            P.O. Box 1588, Montgomery, AL 36102 • Tel 334-834-3556 • Fax 334-834-3557 • www.newsouthbooks.com
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
          {/* --- Report Info Header --- */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center">
                <span className="font-bold w-32">Expense Report #</span>
                <span className="px-3 py-1 bg-gray-100 rounded-md">{reportNumber}</span>
              </div>
              <div className="flex items-center">
                <span className="font-bold w-32">Staff Member:</span>
                 {/* --- FIX: Changed to select, NOT disabled --- */}
                <select
                  value={contactId}
                  onChange={handleStaffChange}
                  className={`px-3 py-1 bg-white border ${errors.staff ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`}
                >
                  <option value="" disabled>-- Select Staff --</option>
                  {staffContacts.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName}
                    </option>
                  ))}
                </select>
              </div>
              {errors.staff && (
                <p className="text-red-600 text-sm ml-32">{errors.staff}</p>
              )}
            </div>
            <div className="flex-1 space-y-2 text-right">
              <div className="flex items-center justify-end">
                <span className="font-bold w-32 text-left">Report Date:</span>
                <span className="px-3 py-1 bg-gray-100 rounded-md">{reportDate}</span>
              </div>
              <p className="text-xs text-gray-500 italic ml-auto max-w-xs">
                Instructions: Staple receipts to back of form. Submit form within 10 days of expense.
              </p>
            </div>
          </div>

          {/* --- Line Items Table --- */}
          <h3 className="text-center font-bold text-lg my-4">CASH EXPENSES</h3>
          <div className="w-full">
            <table className="min-w-full">
              <thead className="border-b-2 border-gray-400">
                <tr>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700">Item Date</th>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700 w-full">Item Description</th>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700">Cash Amount</th>
                  <th className="py-2 px-1 text-right text-sm font-bold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={item.itemDate}
                        onChange={(e) => handleItemChange(index, 'itemDate', e.target.value)}
                        className="w-36 border-gray-300 rounded-md shadow-sm text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="e.g., Apple store, new Macbook"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.cashAmount || ''}
                        onChange={(e) => handleItemChange(index, 'cashAmount', e.target.value)}
                        className="w-32 border-gray-300 rounded-md shadow-sm text-sm"
                      />
                    </td>
                    <td className="py-2 px-1 text-right">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-full"
                        >
                          <DeleteIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={addNewItemRow}
              className="mt-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-blue-600"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          {/* --- Totals & Footer --- */}
          <div className="mt-8 pt-4 border-t-2 border-gray-400 flex justify-between">
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Date Submitted (MM/DD/YYYY)
                </label>
                <input
                  type="date"
                  value={dateSubmitted}
                  onChange={(e) => setDateSubmitted(e.target.value)}
                  className="w-36 border-gray-300 rounded-md shadow-sm text-sm"
                />
            </div>
            
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-end">
                <span className="font-bold text-gray-700 w-28">Total Amount:</span>
                <span className="text-lg font-bold text-gray-900 w-32 text-left pl-4">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-end">
                <span className="font-bold text-gray-700 w-28">Less Advance:</span>
                <span className="text-lg font-bold text-gray-900 w-32 text-left pl-4">$0.00</span>
              </div>
              <div className="flex items-center justify-end border-t border-gray-300 pt-2 mt-2">
                <span className="font-bold text-gray-900 w-28">Total Due:</span>
                <span className="text-xl font-bold text-gray-900 w-32 text-left pl-4">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* --- Form Buttons --- */}
        <div className="mt-6 pt-4 border-t flex justify-end space-x-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit} // This will trigger the form's onSubmit
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {reportToEdit ? 'Save Changes' : 'Save Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseReportForm;