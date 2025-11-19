import React, { useState, useMemo, Fragment } from 'react';
import { Contact, Category, isValidEmail, isValidPhone, isValidUrl } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';
import CategoryEditPopup from './CategoryEditPopup'; // <-- FIX: Import new popup

interface ContactTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onUpdateContact: (contact: Contact) => void;
}

type SortKey = keyof Contact;
type DisplayableContactKey = Exclude<SortKey, 'lastModifiedDate' | 'createdDate' | 'createdBy'>;

const ALL_CONTACT_FIELDS: { key: DisplayableContactKey; label: string; hiddenInMobile?: boolean }[] = [
    { key: 'sequentialId', label: 'ID' }, // <-- CHANGED from 'id' to 'sequentialId'
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'suffix', label: 'Suffix', hiddenInMobile: true },
    { key: 'category', label: 'Category' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', hiddenInMobile: true },
    { key: 'city', label: 'City', hiddenInMobile: true },
    { key: 'state', label: 'State', hiddenInMobile: true },
    { key: 'sendTNSBNewsletter', label: 'Newsletter', hiddenInMobile: true },
];

// No longer needed: const CATEGORY_VALUES = Object.values(Category);

const ITEMS_PER_PAGE = 10;

const ContactTable: React.FC<ContactTableProps> = ({ contacts, onEdit, onDelete, isAdmin, onUpdateContact }) => {
    const [sortKey, setSortKey] = useState<SortKey>('lastName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null); // <-- FIX: State for popup

    const sortedContacts = useMemo(() => {
        const sorted = [...contacts].sort((a, b) => {
            let valA: string;
            let valB: string;

            // <-- FIX: Handle sorting for category array
            if (sortKey === 'category') {
                valA = (Array.isArray(a.category) ? a.category : []).join(', ').toLowerCase();
                valB = (Array.isArray(b.category) ? b.category : []).join(', ').toLowerCase();
            } else {
                valA = (a[sortKey as keyof typeof a] || '').toString().toLowerCase();
                valB = (b[sortKey as keyof typeof b] || '').toString().toLowerCase();
            }

            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });
        return sortOrder === 'asc' ? sorted : sorted.reverse();
    }, [contacts, sortKey, sortOrder]);

    const totalPages = Math.ceil(sortedContacts.length / ITEMS_PER_PAGE);

    const paginatedContacts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, sortedContacts]);


    const handleToggleExpand = (contactId: string) => {
        setExpandedContactId(prevId => (prevId === contactId ? null : contactId));
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };
    
    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortOrder === 'asc' ? '▲' : '▼';
    };

    const handleFieldUpdate = (e: React.FocusEvent<HTMLSpanElement>, contact: Contact, field: keyof Contact) => {
        if (!isAdmin) return;
        
        // This function no longer handles 'category'
        if (field === 'category') return; 

        let value = e.currentTarget.textContent;
        const originalValue = contact[field] || '';

        let updatedValue: string | undefined = value?.trim();
        
        if (field === 'email') {
            updatedValue = updatedValue?.toLowerCase();
        }
        
        // --- THIS IS THE BUG ---
        // if (updatedValue === '' || updatedValue === '-') {
        //     updatedValue = undefined; 
        // }

        // --- THIS IS THE FIX ---
        // Only convert the placeholder '-' to undefined. Allow "" to be saved.
        if (updatedValue === '-') {
            updatedValue = undefined; 
        }

        if (updatedValue !== undefined) {
             if (field === 'phone' && !isValidPhone(updatedValue as string)) {
                 alert(`Validation Error: Invalid phone format for input: ${value}`);
                 e.currentTarget.textContent = originalValue as string;
                 return; 
             }
             if (field === 'url' && !isValidUrl(updatedValue as string)) {
                 alert(`Validation Error: Invalid URL format for input: ${value}`);
                 e.currentTarget.textContent = originalValue as string;
                 return; 
             }
             if (field === 'email' && !isValidEmail(updatedValue as string)) {
                alert(`Validation Error: Invalid email format for input: ${value}`);
                e.currentTarget.textContent = originalValue as string;
                return;
             }
        }
        
        const updatedContact = { ...contact, [field]: updatedValue };
        onUpdateContact(updatedContact as Contact);
    };

    // <-- FIX: New handler for saving from the popup
    const handleSaveCategory = (categories: Category[]) => {
        if (!editingCategoryId) return;

        const contactToUpdate = contacts.find(c => c.id === editingCategoryId);
        if (contactToUpdate) {
            onUpdateContact({ ...contactToUpdate, category: categories });
        }
        setEditingCategoryId(null); // Close popup
    };

    // Find the contact being edited for the popup
    const contactForPopup = useMemo(() => {
        if (!editingCategoryId) return undefined;
        return contacts.find(c => c.id === editingCategoryId);
    }, [editingCategoryId, contacts]);

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {ALL_CONTACT_FIELDS.map(({ key, label, hiddenInMobile }) => (
                                <th
                                    key={key}
                                    scope="col"
                                    className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer 
                                        ${hiddenInMobile ? 'hidden lg:table-cell' : ''}
                                    `}
                                    onClick={() => handleSort(key as SortKey)}
                                >
                                    <div className="flex items-center">
                                        {label}
                                        <span className="ml-2 text-gray-400 text-xs">{renderSortArrow(key as SortKey)}</span>
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="relative px-3 py-3">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedContacts.map((contact) => (
                            <Fragment key={contact.id}>
                                <tr className="hover:bg-gray-50 transition-colors duration-150">
                                    {ALL_CONTACT_FIELDS.map(({ key, hiddenInMobile }) => {
                                        const isCategory = key === 'category';
                                        const isNewsletter = key === 'sendTNSBNewsletter';
                                        
                                        // CHANGE THIS LINE: Check for 'sequentialId' instead of 'id'
                                        const isId = key === 'sequentialId'; 
                                        
                                        // FIX: Make ID field non-editable
                                        const isEditable = isAdmin && !isCategory && !isId;
                                        
                                        // <-- FIX: Handle category array display
                                        let displayValue: string | React.ReactNode = '-';
                                        if (isCategory) {
                                            const categories = Array.isArray(contact.category) ? contact.category : [];
                                            let catString = categories.join(', ');

                                            // --- ADD: Logic to display otherCategory text ---
                                            if (categories.includes(Category.OTHER) && contact.otherCategory) {
                                                // Replace "Other" with "Other (specified text)"
                                                catString = categories.map(c => 
                                                    c === Category.OTHER ? `${Category.OTHER} (${contact.otherCategory})` : c
                                                ).join(', ');
                                            }
                                            // --- END ADD ---

                                            if (categories.length > 0) {
                                                displayValue = catString;
                                            }
                                       } else if (isNewsletter) {
                                            const subscribed = !!contact.sendTNSBNewsletter;
                                            displayValue = (
                                                <button
                                                    type="button"
                                                    onClick={() => isAdmin && onUpdateContact({ ...contact, sendTNSBNewsletter: !subscribed })}
                                                    disabled={!isAdmin}
                                                    className={`w-full text-left ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'} ${subscribed ? 'text-green-600' : 'text-red-600'}`}
                                                >
                                                    {subscribed ? 'Yes' : 'No'}
                                                </button>
                                            );
                                        } else {
                                            displayValue = contact[key] || (isEditable ? '' : '-');
                                        }

                                        return (
                                            <td 
                                                key={key} 
                                                className={`px-3 py-4 whitespace-nowrap text-sm text-gray-500 
                                                    ${key === 'firstName' || key === 'lastName' ? 'font-medium text-gray-900' : ''}
                                                    ${hiddenInMobile ? 'hidden lg:table-cell' : ''}
                                                `}
                                            >
                                                {/* --- FIX: New Category display/edit logic --- */}
                                                {isCategory ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => isAdmin && setEditingCategoryId(contact.id)}
                                                        disabled={!isAdmin}
                                                        className={`w-full text-left ${isAdmin ? 'cursor-pointer hover:text-indigo-600' : 'cursor-not-allowed'}`}
                                                    >
                                                        {displayValue}
                                                    </button>
                                                ) : isNewsletter ? (
                                                    displayValue
                                                ) : (
                                                    <span
                                                        contentEditable={isEditable}
                                                        onBlur={(e) => isEditable && handleFieldUpdate(e, contact, key as keyof Contact)}
                                                        suppressContentEditableWarning={true}
                                                        className={isEditable ? 'inline-block w-full cursor-text' : 'inline-block'}
                                                    >
                                                        {displayValue}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button 
                                                onClick={() => handleToggleExpand(contact.id)}
                                                className="lg:hidden px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded hover:bg-indigo-200 transition-colors"
                                            >
                                                {expandedContactId === contact.id ? 'Hide' : 'View'}
                                            </button>
                                            <button onClick={() => onEdit(contact)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                                               <EditIcon className="h-5 w-5"/>
                                            </button>
                                            <button onClick={() => onDelete(contact.id)} className="text-red-600 hover:text-red-900 transition-colors">
                                                <DeleteIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {expandedContactId === contact.id && (
                                    <tr className="lg:hidden bg-gray-50">
                                        <td colSpan={ALL_CONTACT_FIELDS.length + 1} className="px-6 py-4">
                                            <div className="space-y-3 text-sm text-gray-600">
                                                <p><strong className="font-medium text-gray-800">Phone:</strong> <span 
                                                    contentEditable={isAdmin} 
                                                    onBlur={(e) => handleFieldUpdate(e, contact, 'phone')} 
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {contact.phone || (isAdmin ? '' : '-')}
                                                </span></p>
                                                <p><strong className="font-medium text-gray-800">URL:</strong> <span 
                                                    contentEditable={isAdmin} 
                                                    onBlur={(e) => handleFieldUpdate(e, contact, 'url')} 
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {contact.url || (isAdmin ? '' : '-')}
                                                </span></p>
                                                <p>
                                                    <strong className="font-medium text-gray-800">Newsletter:</strong>
                                                    <button
                                                        type="button"
                                                        onClick={() => isAdmin && onUpdateContact({ ...contact, sendTNSBNewsletter: !contact.sendTNSBNewsletter })}
                                                        disabled={!isAdmin}
                                                        className={`ml-2 ${isAdmin ? 'cursor-pointer font-medium' : 'cursor-not-allowed'} ${contact.sendTNSBNewsletter ? 'text-green-600' : 'text-red-600'}`}
                                                    >
                                                        {contact.sendTNSBNewsletter ? 'Subscribed' : 'Not Subscribed'}
                                                    </button>
                                                </p>
                                                <p><strong className="font-medium text-gray-800">Address 1:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'address1')} suppressContentEditableWarning={true}>{contact.address1 || (isAdmin ? '' : '-')}</span></p>

                                                <p><strong className="font-medium text-gray-800">Address 2:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'address2')} suppressContentEditableWarning={true}>{contact.address2 || (isAdmin ? '' : '-')}</span></p>
                                                <p><strong className="font-medium text-gray-800">City, State, Zip:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'city')} suppressContentEditableWarning={true}>{contact.city || ''}</span>, <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'state')} suppressContentEditableWarning={true}>{contact.state || ''}</span> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'zip')} suppressContentEditableWarning={true}>{contact.zip || ''}</span></p>
                                                <p><strong className="font-medium text-gray-800">Notes:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'notes')} suppressContentEditableWarning={true}>{contact.notes || (isAdmin ? '' : '-')}</span></p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination Controls */}
            <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                <div className="flex-1 flex justify-between sm:hidden">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Previous</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, contacts.length)}</span> of <span className="font-medium">{contacts.length}</span> results
                        </p>
                    </div>
                    <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                Previous
                            </button>
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                                Next
                            </button>
                        </nav>
                    </div>
                </div>
            </div>

            {/* --- FIX: Render the popup --- */}
            {contactForPopup && (
                <CategoryEditPopup
                    contact={contactForPopup}
                    onClose={() => setEditingCategoryId(null)}
                    onSave={handleSaveCategory}
                />
            )}
        </div>
    );
};

export default ContactTable;