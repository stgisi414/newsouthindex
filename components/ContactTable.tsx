import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface ContactTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    onDelete: (id: string) => void;
}

// FIX/ADDITION: Define keys based on the entire Contact interface to ensure all fields are available for sorting
type SortKey = keyof Contact;
type DisplayableContactKey = Exclude<SortKey, 'id'>;

// ADDITION: Define the full list of headers for all displayable contact fields
const ALL_CONTACT_FIELDS: { key: DisplayableContactKey; label: string; hiddenInMobile?: boolean }[] = [
    { key: 'honorific', label: 'Title', hiddenInMobile: true },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'category', label: 'Category' },
    { key: 'phone', label: 'Phone', hiddenInMobile: true },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address', hiddenInMobile: true },
    { key: 'notes', label: 'Notes', hiddenInMobile: true },
];

const ContactTable: React.FC<ContactTableProps> = ({ contacts, onEdit, onDelete }) => {
    const [sortKey, setSortKey] = useState<SortKey>('lastName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const sortedContacts = useMemo(() => {
        const sorted = [...contacts].sort((a, b) => {
            // Updated to correctly handle comparisons on potentially missing optional properties
            const valA = (a[sortKey as keyof typeof a] || '').toString().toLowerCase();
            const valB = (b[sortKey as keyof typeof b] || '').toString().toLowerCase();
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });
        return sortOrder === 'asc' ? sorted : sorted.reverse();
    }, [contacts, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };
    
    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) return null;
        return sortOrder === 'asc' ? '▲' : '▼';
    };

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* UPDATED: Iterate over the new ALL_CONTACT_FIELDS array */}
                            {ALL_CONTACT_FIELDS.map(({ key, label, hiddenInMobile }) => (
                                <th
                                    key={key}
                                    scope="col"
                                    // ADDED: Tailwind classes for mobile responsiveness
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
                        {sortedContacts.map((contact) => (
                            <tr key={contact.id} className="hover:bg-gray-50 transition-colors duration-150">
                                {/* UPDATED: Iterate and display all fields */}
                                {ALL_CONTACT_FIELDS.map(({ key, hiddenInMobile }) => (
                                    <td 
                                        key={key} 
                                        className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 
                                            ${key === 'firstName' || key === 'lastName' ? 'font-medium text-gray-900' : ''}
                                            ${hiddenInMobile ? 'hidden lg:table-cell' : ''}
                                        `}
                                    >
                                        {/* Display the value or '-' if null/undefined */}
                                        {contact[key] || '-'}
                                    </td>
                                ))}
                                {/* Action buttons column remains the same */}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4">
                                        <button onClick={() => onEdit(contact)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                                           <EditIcon className="h-5 w-5"/>
                                        </button>
                                        <button onClick={() => onDelete(contact.id)} className="text-red-600 hover:text-red-900 transition-colors">
                                            <DeleteIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ContactTable;