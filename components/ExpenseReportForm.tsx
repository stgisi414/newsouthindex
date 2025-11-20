import React, { useState, useEffect, useMemo } from 'react';
import { ExpenseReport, ExpenseReportItem, Contact, UserRole } from '../types.ts';
import { serverTimestamp } from 'firebase/firestore';
import DeleteIcon from './icons/DeleteIcon.tsx';
import PlusIcon from './icons/PlusIcon.tsx';
import PrinterIcon from './icons/PrinterIcon.tsx';

interface ExpenseReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: Omit<ExpenseReport, 'id'> | ExpenseReport) => void;
  reportToEdit?: ExpenseReport | null;
  staffContacts: Contact[]; 
  currentUserContactId: string | null; 
  currentUserRole: UserRole | null;  
  isPrintMode: boolean; 
}

// Helper to convert Firestore Timestamp to YYYY-MM-DD string
const formatTimestampToInputDate = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return ''; 
    return date.toISOString().split('T')[0]; 
  } catch {
    return '';
  }
};

const ExpenseReportForm: React.FC<ExpenseReportFormProps> = ({
  isOpen,
  onClose,
  onSave,
  reportToEdit,
  staffContacts, 
  currentUserContactId, 
  currentUserRole,  
  isPrintMode,      
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
        if (!isPrivilegedUser && currentUserContactId) {
          const loggedInStaffContact = staffContacts.find(c => c.id === currentUserContactId);
          if (loggedInStaffContact) {
            setContactId(loggedInStaffContact.id);
            setContactName(`${loggedInStaffContact.firstName} ${loggedInStaffContact.lastName}`);
          }
        } else {
          setContactId('');
          setContactName('');
        }
      }
    }
  }, [isOpen, reportToEdit, staffContacts, currentUserContactId, isPrivilegedUser]);

  const handleItemChange = (index: number, field: keyof ExpenseReportItem, value: string | number) => {
    if (isPrintMode) return; 
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
    if (isPrintMode) return; 
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

  // --- RESTORED HANDLER: Links Input to Dropdown ---
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isPrintMode) return;
      const typedValue = e.target.value;
      
      // Find contact by matching ID (checks both contactNumber and sequentialId)
      const selectedContact = staffContacts.find(c => {
        const idVal = c.contactNumber || c.sequentialId;
        return idVal && idVal.toString() === typedValue;
      });

      if (selectedContact) {
        setContactId(selectedContact.id);
        setContactName(`${selectedContact.firstName} ${selectedContact.lastName}`);
        if (errors.staff) setErrors(prev => ({ ...prev, staff: undefined }));
      } else {
        // Note: We don't strictly clear here to allow typing partial numbers,
        // but the form validation will catch it if 'contactId' remains invalid/empty.
        if (typedValue === '') {
            setContactId('');
            setContactName('');
        }
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
    if (isPrintMode) return true; 
    const newErrors: { staff?: string } = {};
    if (!contactId || contactId === '') {
      newErrors.staff = 'A staff member must be selected.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPrintMode) return; 

    if (!validateForm()) {
      return;
    }

    const reportData = {
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

  // --- UPDATED PRINT MODE STYLES (Mac/Safari Safe) ---
  const printStyles = `
    @media print {
      @page {
        margin: 0.5in;
        size: auto;
      }

      html, body {
        height: auto !important;
        overflow: visible !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Hide everything by default using visibility */
      body {
        visibility: hidden;
      }

      /* 2. Target the modal container specifically */
      .modal-container {
        visibility: visible !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        z-index: 9999 !important;
      }

      /* 3. Target the printable area and all its children */
      #printable-area, #printable-area * {
        visibility: visible !important;
      }
      
      #printable-area {
        position: relative !important;
        width: 100% !important;
        max-width: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      /* 4. Hide controls specifically */
      button, .no-print {
        display: none !important;
      }
      
      /* 5. Ensure inputs look like text */
      input, select, textarea {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        resize: none !important;
        appearance: none !important;
        -webkit-appearance: none !important;
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
          <h2 className="text-4xl font-bold text-gray-800">NewSouth, Inc.</h2>
          <p className="text-sm text-gray-600">
            105 S. Court Street, Montgomery, AL 36104 • www.foranewsouth.com
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
          {/* --- Report Info Header --- */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center">
                <span className="font-bold w-32">Expense Report #</span>
                <span className="px-3 py-1 bg-gray-100 rounded-md print:bg-transparent print:px-0">
                  {reportNumber ? reportNumber : "N/A (Pending Save)"}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-bold w-32">Staff Member:</span>
                
                {!isPrintMode && (
                  <input
                    type="text"
                    placeholder="ID #"
                    // Use either field (migration safety)
                    defaultValue={staffContacts.find(c => c.id === contactId)?.contactNumber || staffContacts.find(c => c.id === contactId)?.sequentialId || ''}
                    onChange={handleIdChange}
                    className="w-24 mr-2 px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-mono"
                    disabled={!isPrivilegedUser && !!currentUserContactId}
                  />
                )}
                
                {isPrintMode ? (
                  <span className="px-3 py-1 print-only-text print:px-0">{contactName || 'N/A'}</span>
                ) : (
                  <select
                    value={contactId}
                    onChange={handleStaffChange}
                    disabled={!isPrivilegedUser && !!currentUserContactId} 
                    className={`flex-1 px-3 py-1 bg-white border ${errors.staff ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm ${(!isPrivilegedUser && !!currentUserContactId) ? 'bg-gray-100' : ''}`}
                  >
                    <option value="" disabled>-- Select via Name --</option>
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
                   <span className="px-3 py-1 print-only-text print:px-0">{reportDate}</span>
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

          {/* === Footer Signature Section === */}
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
              onClick={handleSubmit} 
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