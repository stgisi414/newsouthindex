import React, { useState, useEffect } from 'react';
import { Contact, Category, isValidEmail, isValidPhone, isValidUrl, isValidZip, isValidState } from '../types';

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
        middleInitial: '',
        lastName: '',
        suffix: '',
        category: Category.OTHER,
        phone: '',
        email: '',
        url: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
    };

    const [formState, setFormState] = useState<Omit<Contact, 'id'>>(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (contactToEdit) {
            setFormState({
                ...contactToEdit,
                category: contactToEdit.category || initialFormState.category,
                phone: contactToEdit.phone || '', // Ensure no nulls for phone field
                url: contactToEdit.url || '', // Ensure no nulls for url field
            });
        } else {
            setFormState(initialFormState);
        }
    }, [contactToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        // List of fields to auto-capitalize (First letter of each word)
        const fieldsToCapitalize = ['firstName', 'lastName', 'city'];
        
        let processedValue = value;

        if (fieldsToCapitalize.includes(name)) {
            processedValue = value.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        }
        
        if (name === 'state') {
            processedValue = value.toUpperCase().substring(0, 2);
        }


        setFormState(prev => ({ ...prev, [name]: processedValue }));
    };
    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        
        // --- Required Fields ---
        if (!formState.firstName) newErrors.firstName = 'First name is required.';
        if (!formState.lastName) newErrors.lastName = 'Last name is required.';
        if (!formState.email) newErrors.email = 'Email is required.';
        
        // --- Format Validations ---
        if (formState.email && !isValidEmail(formState.email)) newErrors.email = 'Email is invalid.';
        if (formState.phone && !isValidPhone(formState.phone)) newErrors.phone = 'Phone format is invalid (use only digits, at least 7).';
        if (formState.url && !isValidUrl(formState.url)) newErrors.url = 'URL is invalid.';
        if (formState.zip && !isValidZip(formState.zip)) newErrors.zip = 'Zip code must be 5 or 5-4 digits.';
        if (formState.state && !isValidState(formState.state)) newErrors.state = 'State must be a 2-letter abbreviation.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            // Filter out empty strings/nulls before saving (Firestore best practice)
            const cleanedState = Object.fromEntries(
                Object.entries(formState).filter(([, value]) => value !== '' && value !== null)
            );
            
            onSave(contactToEdit ? { ...cleanedState, id: contactToEdit.id } as Contact : cleanedState as Omit<Contact, 'id'>);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-3xl w-full max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{contactToEdit ? 'Edit Contact' : 'New Contact'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Name Fields */}
                        <div className="md:col-span-1">
                            <label htmlFor="honorific" className="block text-sm font-medium text-gray-700">Honorific</label>
                            <input type="text" id="honorific" name="honorific" value={formState.honorific || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
                            <input type="text" id="firstName" name="firstName" value={formState.firstName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="middleInitial" className="block text-sm font-medium text-gray-700">MI</label>
                            <input type="text" id="middleInitial" name="middleInitial" value={formState.middleInitial || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" maxLength={1} />
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                            <input type="text" id="lastName" name="lastName" value={formState.lastName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="suffix" className="block text-sm font-medium text-gray-700">Suffix</label>
                            <input type="text" id="suffix" name="suffix" value={formState.suffix || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>

                        {/* Contact Fields */}
                        <div className="md:col-span-2">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                            <input type="tel" id="phone" name="phone" value={formState.phone || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                            <input type="email" id="email" name="email" value={formState.email} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>
                        <div className="md:col-span-4">
                            <label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label>
                            <input type="text" id="url" name="url" value={formState.url || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.url ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url}</p>}
                        </div>

                        {/* Address Fields */}
                        <div className="md:col-span-4">
                            <label htmlFor="address1" className="block text-sm font-medium text-gray-700">Address 1</label>
                            <input type="text" id="address1" name="address1" value={formState.address1 || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-4">
                            <label htmlFor="address2" className="block text-sm font-medium text-gray-700">Address 2</label>
                            <input type="text" id="address2" name="address2" value={formState.address2 || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                            <input type="text" id="city" name="city" value={formState.city || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
                            <input type="text" id="state" name="state" value={formState.state || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.state ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} maxLength={2} />
                            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="zip" className="block text-sm font-medium text-gray-700">Zip</label>
                            <input type="text" id="zip" name="zip" value={formState.zip || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.zip ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} maxLength={10} />
                            {errors.zip && <p className="text-red-500 text-xs mt-1">{errors.zip}</p>}
                        </div>

                        {/* Other Fields */}
                        <div className="md:col-span-4">
                             <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                             <select id="category" name="category" value={formState.category} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        
                        <div className="md:col-span-4">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={formState.notes || ''}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
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
