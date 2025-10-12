import React, { useState, useEffect, useMemo } from 'react';
import { Contact, Book } from '../types';

interface TransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transactionData: { contactId: string; booksWithQuantity: { book: Book; quantity: number }[] }) => void;
    contacts: Contact[];
    books: Book[];
}

const TransactionForm: React.FC<TransactionFormProps> = ({ isOpen, onClose, onSave, contacts, books }) => {
    const [contactId, setContactId] = useState('');
    const [selectedBooks, setSelectedBooks] = useState<Map<string, { book: Book; quantity: number }>>(new Map());
    const [bookSearch, setBookSearch] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!isOpen) {
            setContactId('');
            setSelectedBooks(new Map());
            setBookSearch('');
            setErrors({});
        }
    }, [isOpen]);

    const filteredBooks = useMemo(() => {
        if (!bookSearch) return books.filter(b => b.stock > 0);
        return books.filter(book =>
            book.stock > 0 &&
            ((book.title || '').toLowerCase().includes(bookSearch.toLowerCase()) ||
            (book.author || '').toLowerCase().includes(bookSearch.toLowerCase()))
        );
    }, [books, bookSearch]);

    const totalPrice = useMemo(() => {
        return Array.from(selectedBooks.values()).reduce((sum, { book, quantity }) => sum + (book.price * (quantity || 0)), 0);
    }, [selectedBooks]);

    if (!isOpen) {
        return null;
    }

    const handleBookToggle = (book: Book) => {
        const newSelection = new Map(selectedBooks);
        if (newSelection.has(book.id)) {
            newSelection.delete(book.id);
        } else {
            newSelection.set(book.id, { book, quantity: 1 });
        }
        setSelectedBooks(newSelection);
    };

    const handleQuantityChange = (bookId: string, newQuantityValue: number) => {
        const newSelection = new Map(selectedBooks);
        const item = newSelection.get(bookId);
        if (item) {
            // FIX: Allow NaN for empty inputs, but ensure it's at least 0 and not more than stock.
            const quantity = isNaN(newQuantityValue) ? NaN : Math.max(0, Math.min(newQuantityValue, item.book.stock));
            newSelection.set(bookId, { ...item, quantity });
            setSelectedBooks(newSelection);
        }
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!contactId) newErrors.contactId = 'A customer must be selected.';
        if (selectedBooks.size === 0) newErrors.books = 'At least one book must be selected.';
        // Also check if any selected book has a quantity of 0 or NaN
        for (const { quantity } of selectedBooks.values()) {
            if (isNaN(quantity) || quantity <= 0) {
                newErrors.books = 'All selected books must have a quantity of at least 1.';
                break;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSave({
                contactId,
                booksWithQuantity: Array.from(selectedBooks.values()).map(item => ({...item, quantity: item.quantity || 0}))
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">New Transaction</h2>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                        <div>
                            <label htmlFor="contactId" className="block text-sm font-medium text-gray-700">Customer</label>
                            <select id="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.contactId ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}>
                                <option value="">Select a customer...</option>
                                {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                            </select>
                            {errors.contactId && <p className="text-red-500 text-xs mt-1">{errors.contactId}</p>}
                        </div>

                        <div>
                            <label htmlFor="bookSearch" className="block text-sm font-medium text-gray-700">Search Books</label>
                            <input type="text" id="bookSearch" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder="Search by title or author..." className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            {errors.books && <p className="text-red-500 text-xs mt-1">{errors.books}</p>}
                        </div>

                        <div className="border border-gray-200 rounded-md h-64 overflow-y-auto">
                            {filteredBooks.map(book => (
                                <div key={book.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                    <div className="flex items-center">
                                        <input type="checkbox" checked={selectedBooks.has(book.id)} onChange={() => handleBookToggle(book)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                                        <div className="ml-3 text-sm">
                                            <label className="font-medium text-gray-900">{book.title}</label>
                                            <p className="text-gray-500">{book.author} - ${book.price.toFixed(2)} (In stock: {book.stock})</p>
                                        </div>
                                    </div>
                                    {selectedBooks.has(book.id) && (
                                        // FIX: Allow empty string for NaN values and set min to 0
                                        <input type="number" min="0" max={book.stock} value={isNaN(selectedBooks.get(book.id)?.quantity || 0) ? '' : selectedBooks.get(book.id)?.quantity} onChange={(e) => handleQuantityChange(book.id, parseInt(e.target.value, 10))} className="w-20 text-center border-gray-300 rounded-md shadow-sm" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t">
                        <div className="text-lg font-semibold text-right mb-4">
                            Total: ${totalPrice.toFixed(2)}
                        </div>
                        <div className="flex justify-end space-x-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Transaction</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionForm;