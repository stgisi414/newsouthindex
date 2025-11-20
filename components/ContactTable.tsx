import React, { useState, useMemo, Fragment } from 'react';
import { Contact, Category, isValidEmail, isValidPhone, isValidUrl, PhoneEntry, EmailEntry, AddressEntry } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';
import CategoryEditPopup from './CategoryEditPopup'; 

interface ContactTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onUpdateContact: (contact: Contact) => void;
}

type SortKey = keyof Contact | 'phone' | 'email' | 'city' | 'state';
type DisplayableContactKey = Exclude<SortKey, 'lastModifiedDate' | 'createdDate' | 'createdBy'>;

const ALL_CONTACT_FIELDS: { key: string; label: string; hiddenInMobile?: boolean }[] = [
    { key: 'contactNumber', label: 'ID' }, 
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

const ITEMS_PER_PAGE = 10;

const ContactTable: React.FC<ContactTableProps> = ({ contacts, onEdit, onDelete, isAdmin, onUpdateContact }) => {
    const [sortKey, setSortKey] = useState<SortKey>('lastName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

    // --- HELPER: Get primary data from new arrays ---
    const getPrimary = (contact: Contact, type: 'phones' | 'emails' | 'addresses', field: string) => {
        const list = contact[type] as any[];
        if (!list || list.length === 0) {
             // Fallback to old fields if arrays are empty
             if (type === 'phones' && field === 'number') return (contact as any).phone || '';
             if (type === 'emails' && field === 'address') return (contact as any).email || '';
             if (type === 'addresses') return (contact as any)[field] || '';
             return '';
        }
        // Prioritize 'Main', then the first one
        const primary = list.find(item => item.type === 'Main') || list[0];
        return primary ? primary[field] : '';
    };

    const sortedContacts = useMemo(() => {
        const sorted = [...contacts].sort((a, b) => {
            let valA = '';
            let valB = '';

            if (sortKey === 'category') {
                valA = (Array.isArray(a.category) ? a.category : []).join(', ').toLowerCase();
                valB = (Array.isArray(b.category) ? b.category : []).join(', ').toLowerCase();
            } else if (sortKey === 'phone') {
                valA = getPrimary(a, 'phones', 'number');
                valB = getPrimary(b, 'phones', 'number');
            } else if (sortKey === 'email') {
                valA = getPrimary(a, 'emails', 'address');
                valB = getPrimary(b, 'emails', 'address');
            } else if (sortKey === 'city') {
                valA = getPrimary(a, 'addresses', 'city').toLowerCase();
                valB = getPrimary(b, 'addresses', 'city').toLowerCase();
            } else if (sortKey === 'state') {
                valA = getPrimary(a, 'addresses', 'state').toLowerCase();
                valB = getPrimary(b, 'addresses', 'state').toLowerCase();
            } else if (sortKey === 'contactNumber') {
                // Numerical sort for ID
                return ((a.contactNumber || 0) - (b.contactNumber || 0));
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

    // --- UPDATED: Inline Edit Handler for Arrays ---
    const handleFieldUpdate = (e: React.FocusEvent<HTMLSpanElement>, contact: Contact, field: string) => {
        if (!isAdmin) return;
        if (field === 'category') return; 

        let value = e.currentTarget.textContent;
        let updatedValue: string | undefined = value?.trim();
        
        // Normalize empty dash to undefined/empty
        if (updatedValue === '-') updatedValue = undefined;

        if (updatedValue !== undefined) {
             if (field === 'phone' && !isValidPhone(updatedValue as string)) {
                 alert(`Validation Error: Invalid phone format: ${value}`);
                 e.currentTarget.textContent = getPrimary(contact, 'phones', 'number'); // Revert
                 return; 
             }
             if (field === 'email' && !isValidEmail(updatedValue as string)) {
                alert(`Validation Error: Invalid email format: ${value}`);
                e.currentTarget.textContent = getPrimary(contact, 'emails', 'address'); // Revert
                return;
             }
        }
        
        // Construct Update
        const updatedContact = { ...contact };
        
        // Map flat field edit to the correct array index (0 or Main)
        if (field === 'phone') {
            const phones = [...(contact.phones || [])];
            if (phones.length === 0) phones.push({ type: 'Mobile', number: '' });
            
            const targetIndex = phones.findIndex(p => p.type === 'Main') !== -1 
                ? phones.findIndex(p => p.type === 'Main') 
                : 0;
            
            // FIX: Apply formatter here
            const formattedNumber = formatPhoneNumber(updatedValue || ''); 
            
            phones[targetIndex] = { ...phones[targetIndex], number: formattedNumber };
            updatedContact.phones = phones;
            
            // Force the cell to show the formatted value immediately
            if (e.currentTarget) e.currentTarget.textContent = formattedNumber;
        }
        else if (field === 'email') {
            const emails = [...(contact.emails || [])];
            if (emails.length === 0) emails.push({ type: 'Main', address: '' });
            const targetIndex = emails.findIndex(e => e.type === 'Main') !== -1 
                ? emails.findIndex(e => e.type === 'Main') 
                : 0;
            emails[targetIndex] = { ...emails[targetIndex], address: updatedValue || '' };
            updatedContact.emails = emails;
        }
        else if (['city', 'state', 'zip', 'address1', 'address2'].includes(field)) {
             const addresses = [...(contact.addresses || [])];
             if (addresses.length === 0) addresses.push({ type: 'Main', address1: '', city: '', state: '', zip: '' });
             const targetIndex = addresses.findIndex(a => a.type === 'Main') !== -1 
                ? addresses.findIndex(a => a.type === 'Main') 
                : 0;
             (addresses[targetIndex] as any)[field] = updatedValue || '';
             updatedContact.addresses = addresses;
        }
        else {
            // Standard fields (firstName, lastName, etc.)
            (updatedContact as any)[field] = updatedValue;
        }

        onUpdateContact(updatedContact);
    };

    const handleSaveCategory = (categories: Category[]) => {
        if (!editingCategoryId) return;
        const contactToUpdate = contacts.find(c => c.id === editingCategoryId);
        if (contactToUpdate) {
            onUpdateContact({ ...contactToUpdate, category: categories });
        }
        setEditingCategoryId(null); 
    };

    const contactForPopup = useMemo(() => {
        if (!editingCategoryId) return undefined;
        return contacts.find(c => c.id === editingCategoryId);
    }, [editingCategoryId, contacts]);

    const formatPhoneNumber = (value: string) => {
        if (!value) return value;
        if (value.startsWith('+') || value.startsWith('1')) return value;
        const input = value.replace(/\D/g, '');
        const constrainedInput = input.substring(0, 10);
        
        if (constrainedInput.length < 4) return constrainedInput;
        if (constrainedInput.length < 7) return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3)}`;
        return `(${constrainedInput.slice(0, 3)}) ${constrainedInput.slice(3, 6)}-${constrainedInput.slice(6, 10)}`;
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
                                        const isId = key === 'contactNumber'; 
                                        const isEditable = isAdmin && !isCategory && !isId;
                                        
                                        let displayValue: string | React.ReactNode = '-';
                                        
                                        // --- MAPPING LOGIC ---
                                        if (isId) {
                                            displayValue = contact.contactNumber ? `#${contact.contactNumber}` : '-';
                                        }
                                        else if (isCategory) {
                                            const categories = Array.isArray(contact.category) ? contact.category : [];
                                            let catString = categories.join(', ');
                                            if (categories.includes(Category.OTHER) && contact.otherCategory) {
                                                catString = categories.map(c => 
                                                    c === Category.OTHER ? `${Category.OTHER} (${contact.otherCategory})` : c
                                                ).join(', ');
                                            }
                                            if (categories.length > 0) displayValue = catString;
                                       } 
                                       else if (key === 'phone') {
                                            displayValue = getPrimary(contact, 'phones', 'number');
                                       }
                                       else if (key === 'email') {
                                            displayValue = getPrimary(contact, 'emails', 'address');
                                       }
                                       else if (['city', 'state'].includes(key)) {
                                            displayValue = getPrimary(contact, 'addresses', key);
                                       }
                                       else if (isNewsletter) {
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
                                            displayValue = (contact as any)[key] || (isEditable ? '' : '-');
                                        }

                                        return (
                                            <td 
                                                key={key} 
                                                className={`px-3 py-4 whitespace-nowrap text-sm text-gray-500 
                                                    ${key === 'firstName' || key === 'lastName' ? 'font-medium text-gray-900' : ''}
                                                    ${hiddenInMobile ? 'hidden lg:table-cell' : ''}
                                                `}
                                            >
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
                                                        onBlur={(e) => isEditable && handleFieldUpdate(e, contact, key)}
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
                                                <p><strong className="font-medium text-gray-800">Phone:</strong> 
                                                    <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'phone')} suppressContentEditableWarning={true}>
                                                        {getPrimary(contact, 'phones', 'number')}
                                                    </span>
                                                </p>
                                                <p><strong className="font-medium text-gray-800">Email:</strong> 
                                                    <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(e, contact, 'email')} suppressContentEditableWarning={true}>
                                                        {getPrimary(contact, 'emails', 'address')}
                                                    </span>
                                                </p>
                                                <p>
                                                    <strong className="font-medium text-gray-800">Address:</strong>
                                                    {getPrimary(contact, 'addresses', 'address1')} {getPrimary(contact, 'addresses', 'city')}, {getPrimary(contact, 'addresses', 'state')}
                                                </p>
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