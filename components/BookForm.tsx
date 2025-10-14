import React, { useState, useEffect } from 'react';
import { Book } from '../types';

interface BookFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (book: Omit<Book, 'id'> | Book) => void;
    bookToEdit?: Book | null;
}

const BookForm: React.FC<BookFormProps> = ({ isOpen, onClose, onSave, bookToEdit }) => {
    const initialFormState = {
        title: '',
        author: '',
        isbn: '',
        publisher: '',
        price: 0,
        stock: 0,
    };

    const [formState, setFormState] = useState<Omit<Book, 'id'>>(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (bookToEdit) {
            setFormState(bookToEdit);
        } else {
            setFormState(initialFormState);
        }
    }, [bookToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        // FIX: Remove '|| 0' to allow the input to be cleared.
        // This will result in NaN for empty number fields, which we'll handle.
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };
    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formState.title) newErrors.title = 'Title is required';
        if (!formState.author) newErrors.author = 'Author is required';
        if (formState.price < 0) newErrors.price = 'Price cannot be negative';
        if (formState.stock < 0) newErrors.stock = 'Stock cannot be negative';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            // FIX: Create a clean version of the state for saving,
            // converting any NaN values from empty inputs back to 0.
            const dataToSave = {
                ...formState,
                price: isNaN(formState.price) ? 0 : formState.price,
                stock: isNaN(formState.stock) ? 0 : formState.stock,
            };
            onSave(bookToEdit ? { ...dataToSave, id: bookToEdit.id } : dataToSave);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-lg w-full max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{bookToEdit ? 'Edit Book' : 'New Book'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" id="title" name="title" value={formState.title} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.title ? 'border-red-500' : 'border-gray-300'} rounded-md`} required />
                        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                    </div>
                    <div>
                        <label htmlFor="author" className="block text-sm font-medium text-gray-700">Author</label>
                        <input type="text" id="author" name="author" value={formState.author} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.author ? 'border-red-500' : 'border-gray-300'} rounded-md`} required />
                        {errors.author && <p className="text-red-500 text-xs mt-1">{errors.author}</p>}
                    </div>
                    <div>
                        <label htmlFor="isbn" className="block text-sm font-medium text-gray-700">ISBN</label>
                        <input type="text" id="isbn" name="isbn" value={formState.isbn || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="publisher" className="block text-sm font-medium text-gray-700">Publisher</label>
                        <input type="text" id="publisher" name="publisher" value={formState.publisher || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="genre" className="block text-sm font-medium text-gray-700">Genre</label>
                            <input type="text" id="genre" name="genre" value={formState.genre || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="publicationYear" className="block text-sm font-medium text-gray-700">Year</label>
                            <input type="number" id="publicationYear" name="publicationYear" value={formState.publicationYear || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
                            {/* FIX: Show an empty string if the value is NaN */}
                            <input type="number" id="price" name="price" value={isNaN(formState.price) ? '' : formState.price} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.price ? 'border-red-500' : 'border-gray-300'} rounded-md`} step="0.01" />
                            {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                        </div>
                        <div>
                            <label htmlFor="stock" className="block text-sm font-medium text-gray-700">Stock</label>
                            {/* FIX: Show an empty string if the value is NaN */}
                            <input type="number" id="stock" name="stock" value={isNaN(formState.stock) ? '' : formState.stock} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.stock ? 'border-red-500' : 'border-gray-300'} rounded-md`} />
                             {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Book</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookForm;