import React, { useState, useMemo, Fragment } from 'react';
import { Contact, Category, isValidPhone, isValidUrl } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface ContactTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean; // Add isAdmin prop
    onUpdateContact: (contact: Contact) => void; // Add onUpdateContact prop
}

type SortKey = keyof Contact;
type DisplayableContactKey = Exclude<SortKey, 'id' | 'lastModifiedDate' | 'createdDate' | 'createdBy'>;

const ALL_CONTACT_FIELDS: { key: DisplayableContactKey; label: string; hiddenInMobile?: boolean }[] = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'category', label: 'Category' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', hiddenInMobile: true },
    { key: 'city', label: 'City', hiddenInMobile: true },
    { key: 'state', label: 'State', hiddenInMobile: true },
];

const CATEGORY_VALUES = Object.values(Category); // Get all valid category strings

const ITEMS_PER_PAGE = 10;

const ContactTable: React.FC<ContactTableProps> = ({ contacts, onEdit, onDelete, isAdmin, onUpdateContact }) => {
    const [sortKey, setSortKey] = useState<SortKey>('lastName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const sortedContacts = useMemo(() => {
        const sorted = [...contacts].sort((a, b) => {
            const valA = (a[sortKey as keyof typeof a] || '').toString().toLowerCase();
            const valB = (b[sortKey as keyof typeof b] || '').toString().toLowerCase();
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
        setCurrentPage(1); // Reset to first page on sort
    };
    
    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortOrder === 'asc' ? '▲' : '▼';
    };

    const handleFieldUpdate = (contact: Contact, field: keyof Contact, value: string) => {
        if (!isAdmin) return;
        
        // --- START VALIDATION AND CLEANUP ---
        let updatedValue: string | Category | undefined = value.trim();
        
        if (field === 'email') {
            updatedValue = updatedValue.toLowerCase();
        }
        
        // FIX: Treat empty string or "-" as undefined for optional fields (resolves hyphen and Firestore undefined error)
        if (updatedValue === '' || updatedValue === '-') {
            updatedValue = undefined; 
        }

        if (updatedValue !== undefined) {
             // Check phone validation and block update if invalid
             if (field === 'phone' && !isValidPhone(updatedValue as string)) {
                 console.error(`Validation Error: Invalid phone format for input: ${value}`);
                 // NOTE: Returning here prevents onUpdateContact from being called.
                 return; 
             }
             // Check URL validation and block update if invalid
             if (field === 'url' && !isValidUrl(updatedValue as string)) {
                 console.error(`Validation Error: Invalid URL format for input: ${value}`);
                 return; // Block update
             }
        }
        // --- END VALIDATION AND CLEANUP ---
        
        // This is only reached if validation passed OR the value was intentionally set to undefined (empty)
        const updatedContact = { ...contact, [field]: updatedValue };
        onUpdateContact(updatedContact as Contact);
    };

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
                                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer 
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
                            <th scope="col" className="relative px-6 py-3">
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
                                        const isEditable = isAdmin && !isCategory;
                                        
                                        // Determine display value. Show '' if editable and value is missing.
                                        const displayValue = contact[key] || (isEditable ? '' : '-');

                                        return (
                                            <td 
                                                key={key} 
                                                className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 
                                                    ${key === 'firstName' || key === 'lastName' ? 'font-medium text-gray-900' : ''}
                                                    ${hiddenInMobile ? 'hidden lg:table-cell' : ''}
                                                `}
                                            >
                                                {isCategory && isAdmin ? (
                                                    <select
                                                        value={contact.category}
                                                        onChange={(e) => handleFieldUpdate(contact, 'category', e.target.value)}
                                                        className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                    >
                                                        {CATEGORY_VALUES.map((category) => (
                                                            <option key={category} value={category}>{category}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span
                                                        contentEditable={isEditable}
                                                        onBlur={(e) => isEditable && handleFieldUpdate(contact, key as keyof Contact, e.currentTarget.textContent || '')}
                                                        suppressContentEditableWarning={true}
                                                        className={isEditable ? 'inline-block w-full cursor-text' : 'inline-block'}
                                                    >
                                                        {displayValue}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                                {/* Apply consistent display logic and validation to mobile view */}
                                                <p><strong className="font-medium text-gray-800">Phone:</strong> <span 
                                                    contentEditable={isAdmin} 
                                                    onBlur={(e) => handleFieldUpdate(contact, 'phone', e.currentTarget.textContent || '')} 
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {contact.phone || (isAdmin ? '' : '-')}
                                                </span></p>
                                                <p><strong className="font-medium text-gray-800">URL:</strong> <span 
                                                    contentEditable={isAdmin} 
                                                    onBlur={(e) => handleFieldUpdate(contact, 'url', e.currentTarget.textContent || '')} 
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {contact.url || (isAdmin ? '' : '-')}
                                                </span></p>
                                                <p><strong className="font-medium text-gray-800">Address:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'address1', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.address1 || (isAdmin ? '' : '-')}</span> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'address2', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.address2 || (isAdmin ? '' : '-')}</span> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'city', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.city || (isAdmin ? '' : '-')}</span> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'state', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.state || (isAdmin ? '' : '-')}</span> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'zip', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.zip || (isAdmin ? '' : '-')}</span></p>
                                                <p><strong className="font-medium text-gray-800">Notes:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(contact, 'notes', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{contact.notes || (isAdmin ? '' : '-')}</span></p>
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
        </div>
    );
};

export default ContactTable;
