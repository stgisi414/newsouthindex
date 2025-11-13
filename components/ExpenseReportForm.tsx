import React, { useState, useEffect, useMemo } from 'react';
import { ExpenseReport, ExpenseReportItem, Contact, UserRole } from '../types.ts';
import { serverTimestamp } from 'firebase/firestore';
import DeleteIcon from './icons/DeleteIcon.tsx';
import PlusIcon from './icons/PlusIcon.tsx';
import PrinterIcon from './icons/PrinterIcon.tsx'; // Import PrinterIcon

// --- NEW PROPS INTERFACE ---
interface ExpenseReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: Omit<ExpenseReport, 'id'> | ExpenseReport) => void;
  reportToEdit?: ExpenseReport | null;
  staffContacts: Contact[]; // <-- RECEIVES THE ALREADY-FILTERED LIST
  currentUserContactId: string | null; // <-- NEW PROP
  currentUserRole: UserRole | null;  // <-- NEW PROP
  isPrintMode: boolean; // <-- NEW PROP
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
  staffContacts, // <-- USE THE PROP
  currentUserContactId, // <-- USE THE PROP
  currentUserRole,  // <-- USE THE PROP
  isPrintMode,      // <-- USE THE PROP
}) => {
  const [reportNumber, setReportNumber] = useState(0);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [contactName, setContactName] = useState('');
  const [contactId, setContactId] = useState('');
  const [items, setItems] = useState<ExpenseReportItem[]>([
    { itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 },
  ]);
  const [dateSubmitted, setDateSubmitted] = useState('');
  const [errors, setErrors] = useState<{ staff?: string }>({});

  // --- BUGGY useMemo HOOKS (loggedInContact, staffContacts) ARE REMOVED ---

  // Check if current user is admin/bookkeeper
  const isPrivilegedUser = useMemo(() => {
    return (
      currentUserRole === UserRole.MASTER_ADMIN ||
      currentUserRole === UserRole.ADMIN ||
      currentUserRole === UserRole.BOOKKEEPER
    );
  }, [currentUserRole]);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (reportToEdit) {
        // --- EDITING ---
        setReportNumber(reportToEdit.reportNumber || 1000);
        setReportDate(formatTimestampToInputDate(reportToEdit.reportDate));
        setContactId(reportToEdit.staffContactId || '');
        setContactName(reportToEdit.staffName || '');
        setItems(reportToEdit.items && reportToEdit.items.length > 0 ? reportToEdit.items.map(item => ({
          ...item,
          itemDate: formatTimestampToInputDate(item.itemDate)
        })) : [{ itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
        setDateSubmitted(formatTimestampToInputDate(reportToEdit.dateSubmitted));
      } else {
        // --- CREATING NEW ---
        setReportNumber(0);
        setReportDate(new Date().toISOString().split('T')[0]);
        setItems([{ itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
        setDateSubmitted('');

        // Pre-fill user's name IF they are not an admin/bookkeeper
        // If they are an admin, force them to select from the list.
        if (!isPrivilegedUser && currentUserContactId) {
          const loggedInStaffContact = staffContacts.find(c => c.id === currentUserContactId);
          if (loggedInStaffContact) {
            setContactId(loggedInStaffContact.id);
            setContactName(`${loggedInStaffContact.firstName} ${loggedInStaffContact.lastName}`);
          }
        } else {
          // Admin/Bookkeeper or unlinked user starts blank
          setContactId('');
          setContactName('');
        }
      }
    }
  }, [isOpen, reportToEdit, staffContacts, currentUserContactId, isPrivilegedUser]);

  const handleItemChange = (index: number, field: keyof ExpenseReportItem, value: string | number) => {
    if (isPrintMode) return; // Don't allow edits in print mode
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === 'cashAmount') {
      newItems[index] = { ...item, [field]: parseFloat(value as string) || 0 };
    } else {
      newItems[index] = { ...item, [field]: value };
    }
    setItems(newItems);
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isPrintMode) return; // Don't allow edits in print mode
    const selectedId = e.target.value;
    const selectedContact = staffContacts.find(c => c.id === selectedId);
    if (selectedContact) {
      setContactId(selectedContact.id);
      setContactName(`${selectedContact.firstName} ${selectedContact.lastName}`);
      if (errors.staff) {
        setErrors(prev => ({ ...prev, staff: undefined }));
      }
    } else {
      setContactId('');
      setContactName('');
    }
  };

  const addNewItemRow = () => {
    if (isPrintMode) return;
    setItems([...items, { itemDate: new Date().toISOString().split('T')[0], description: '', cashAmount: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (isPrintMode || items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.cashAmount) || 0), 0);
  }, [items]);

  const validateForm = (): boolean => {
    if (isPrintMode) return true; // Don't validate in print mode
    const newErrors: { staff?: string } = {};
    if (!contactId || contactId === '') {
      newErrors.staff = 'A staff member must be selected.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPrintMode) return; // Don't save in print mode

    if (!validateForm()) {
      return;
    }

    const reportData = {
      // FIX: Use the date from state, not the original reportToEdit date
      reportDate: new Date(reportDate),
      
      staffContactId: contactId,
      staffName: contactName,
      
      items: items.map(item => ({
        ...item,
        itemDate: item.itemDate ? new Date(item.itemDate) : new Date(),
        cashAmount: Number(item.cashAmount) || 0
      })),
      totalAmount: totalAmount,
      dateSubmitted: dateSubmitted ? new Date(dateSubmitted) : null,
      status: dateSubmitted ? 'Submitted' : 'Draft',
    };

    if (reportToEdit) {
      onSave({ 
        ...reportToEdit, 
        ...reportData,
        // Make sure 'createdAt' and 'createdBy' are preserved
        createdAt: reportToEdit.createdAt, 
        createdBy: reportToEdit.createdBy,
      });
    } else {
      onSave(reportData as Omit<ExpenseReport, 'id'>);
    }
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  // --- PRINT MODE STYLES ---
  // These styles will hide UI elements and format for printing
  const printStyles = `
    @media print {
      /* 1. Kill Browser Margins */
      @page {
        margin: 0;
        size: auto;
      }

      /* 2. Reset Global Layout */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
        background: white !important;
      }

      /* 3. Hide everything and collapse their space */
      body * {
        visibility: hidden;
        height: 0; /* Prevents ghost content from creating extra pages */
        overflow: hidden; /* Clips any hidden content */
      }

      /* 4. Resurrect the Modal Container */
      /* We must specifically override the 'fixed', 'p-4', 'flex' classes */
      .modal-container {
        visibility: visible !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        padding: 0 !important; /* Removes the "Space at Top" */
        width: 100% !important;
        height: auto !important;
        display: block !important; /* Disables flex centering */
        background: white !important;
        inset: 0 !important;
        z-index: 9999 !important;
      }

      /* 5. Style the Actual Report Content */
      #printable-area {
        visibility: visible !important;
        position: relative !important;
        height: auto !important;
        width: 100% !important;
        margin: 0 !important; /* Removes the "m-4" causing overflow */
        
        /* Add a safe printing padding manually so it looks good */
        padding: 20px 40px !important; 
        
        box-shadow: none !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
      }

      /* 6. Ensure children of the report are visible and take up space */
      #printable-area * {
        visibility: visible !important;
        height: auto !important;
        overflow: visible !important;
      }

      /* 7. Hide Buttons explicitly */
      button, .no-print {
        display: none !important;
      }
    }
  `;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4 modal-container">
      <style>{printStyles}</style>
      <div 
        id="printable-area" 
        className="bg-white rounded-lg shadow-2xl p-6 m-4 max-w-4xl w-full max-h-[90vh] flex flex-col font-serif modal-content"
      >
        
        {/* --- Header --- */}
        <div className="text-center border-b pb-4 mb-4 border-gray-300 print-header">
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
                <span className="px-3 py-1 bg-gray-100 rounded-md">
                  {reportNumber ? reportNumber : "N/A (Pending Save)"}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-bold w-32">Staff Member:</span>
                
                {/* --- THIS IS THE KEY FIX --- */}
                {/* Show text in print mode, dropdown otherwise */}
                {isPrintMode ? (
                  <span className="px-3 py-1 print-only-text">{contactName || 'N/A'}</span>
                ) : (
                  <select
                    value={contactId}
                    onChange={handleStaffChange}
                    // Disable if not a privileged user AND they are assigned a contact
                    disabled={!isPrivilegedUser && !!currentUserContactId} 
                    className={`px-3 py-1 bg-white border ${errors.staff ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm ${(!isPrivilegedUser && !!currentUserContactId) ? 'bg-gray-100' : ''}`}
                  >
                    <option value="" disabled>-- Select Staff --</option>
                    {/* THIS NOW USES THE 'staffContacts' PROP */}
                    {staffContacts.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.firstName} {staff.lastName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {errors.staff && !isPrintMode && (
                <p className="text-red-600 text-sm ml-32">{errors.staff}</p>
              )}
            </div>
            <div className="flex-1 space-y-2 text-right">
              <div className="flex items-center justify-end">
                <span className="font-bold w-32 text-left">Report Date:</span>
                {isPrintMode ? (
                   <span className="px-3 py-1 print-only-text">{reportDate}</span>
                ) : (
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-36 border-gray-300 rounded-md shadow-sm text-sm"
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 italic ml-auto max-w-xs no-print">
                Instructions: Staple receipts to back of form. Submit form within 10 days of expense.
              </p>
            </div>
          </div>

          {/* --- Line Items Table --- */}
          <h3 className="text-center font-bold text-lg my-4">CASH EXPENSES</h3>
          <div className="w-full print-table">
            <table className="min-w-full">
              <thead className="border-b-2 border-gray-400">
                <tr>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700">Item Date</th>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700 w-full">Item Description</th>
                  <th className="py-2 px-2 text-left text-sm font-bold text-gray-700">Cash Amount</th>
                  <th className="py-2 px-1 text-right text-sm font-bold text-gray-700 no-print"></th>
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
                        disabled={isPrintMode}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="e.g., Apple store, new Macbook"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm"
                        disabled={isPrintMode}
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
                        disabled={isPrintMode}
                      />
                    </td>
                    <td className="py-2 px-1 text-right no-print">
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
              className="mt-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-blue-600 no-print"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          {/* --- Totals & Footer --- */}
          <div className="mt-8 pt-4 border-t-2 border-gray-400 flex justify-between print-totals">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Date Submitted (MM/DD/YYYY)
              </label>
              <input
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                className="w-36 border-gray-300 rounded-md shadow-sm text-sm"
                disabled={isPrintMode}
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

          {/* === ADD THIS NEW SECTION === */}
          <div className="mt-16 grid grid-cols-2 gap-x-12 gap-y-8 pt-12 border-t border-gray-300">
            <div className="space-y-2">
              <span className="block w-full h-8 border-b border-gray-400"></span>
              <label className="block text-sm font-medium text-gray-700">Your Signature</label>
            </div>
            <div className="space-y-2">
              <span className="block w-full h-8 border-b border-gray-400"></span>
              <label className="block text-sm font-medium text-gray-700">Approved by:</label>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Advance Check #</label>
              <span className="block w-full h-8 border-b border-gray-400"></span>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Reimb Ck #</label>
              <span className="block w-full h-8 border-b border-gray-400"></span>
            </div>
          </div>
          {/* === END NEW SECTION === */}
        </form>

        {/* --- Form Buttons --- */}
        <div className="mt-6 pt-4 border-t flex justify-between items-center flex-shrink-0 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <PrinterIcon className="h-5 w-5 mr-2" />
            Print
          </button>
          <div className="space-x-4">
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
    </div>
  );
};

export default ExpenseReportForm;