
import React, { useState, useEffect } from 'react';
import { Contact, Category } from '../types';

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Omit<Contact, 'id'> | Contact) => void;
    contactToEdit?: Contact | null;
}

const ContactForm: React.FC<ContactFormProps> = ({ isOpen, onClose, onSave, contactToEdit }) => {
    const initialFormState = {
        honorific: '',
        firstName: '',
        lastName: '',
        category: Category.OTHER,
        phone: '',
        email: '',
        address: '',
        notes: '',
    };

    // FIX: Explicitly type the form state to be compatible with the Contact type.
    // This resolves the type mismatch where `contactToEdit` has optional properties
    // but the inferred state type from `initialFormState` required all properties.
    const [formState, setFormState] = useState<Omit<Contact, 'id'>>(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (contactToEdit) {
            setFormState(contactToEdit);
        } else {
            setFormState(initialFormState);
        }
    }, [contactToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formState.firstName) newErrors.firstName = 'First name is required';
        if (!formState.lastName) newErrors.lastName = 'Last name is required';
        if (!formState.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formState.email)) {
            newErrors.email = 'Email is invalid';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSave(contactToEdit ? { ...formState, id: contactToEdit.id } : formState);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-2xl w-full max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{contactToEdit ? 'Edit Contact' : 'New Contact'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries({
                            honorific: { label: 'Honorific', type: 'text' },
                            firstName: { label: 'First Name', type: 'text', required: true },
                            lastName: { label: 'Last Name', type: 'text', required: true },
                            phone: { label: 'Phone', type: 'tel' },
                            email: { label: 'Email', type: 'email', required: true },
                            address: { label: 'Address', type: 'text', fullWidth: true },
                        }).map(([name, { label, type, required, fullWidth }]) => (
                            <div key={name} className={fullWidth ? 'md:col-span-2' : ''}>
                                <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                                <input
                                    type={type}
                                    id={name}
                                    name={name}
                                    value={(formState as any)[name] || ''}
                                    onChange={handleChange}
                                    className={`mt-1 block w-full px-3 py-2 bg-white border ${errors[name] ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                                />
                                {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
                            </div>
                        ))}

                        <div className="md:col-span-2">
                             <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                             <select id="category" name="category" value={formState.category} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        
                        <div className="md:col-span-2">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={formState.notes || ''}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Save Contact
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactForm;