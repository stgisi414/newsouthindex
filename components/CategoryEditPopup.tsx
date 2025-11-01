import React, { useState } from 'react';
import { Contact, Category } from '../types';

interface CategoryEditPopupProps {
    contact: Contact;
    onSave: (categories: Category[]) => void;
    onClose: () => void;
}

const CategoryEditPopup: React.FC<CategoryEditPopupProps> = ({ contact, onSave, onClose }) => {
    // Ensure contact.category is always an array for the state
    const [selectedCategories, setSelectedCategories] = useState<Category[]>(
        Array.isArray(contact.category) ? contact.category : []
    );

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const category = value as Category;

        setSelectedCategories(prev => {
            if (checked) {
                return [...prev, category];
            } else {
                return prev.filter(cat => cat !== category);
            }
        });
    };

    const handleSave = () => {
        onSave(selectedCategories);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 m-4 max-w-md w-full">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Edit Categories for {contact.firstName} {contact.lastName}
                </h3>
                
                <div className="space-y-2">
                    {Object.values(Category).map(cat => (
                        <div key={cat} className="flex items-center">
                            <input
                                id={`popup-category-${cat}`}
                                name="category"
                                type="checkbox"
                                value={cat}
                                checked={selectedCategories.includes(cat)}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor={`popup-category-${cat}`} className="ml-3 block text-sm text-gray-900">
                                {cat}
                            </label>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CategoryEditPopup;