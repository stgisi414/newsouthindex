import React, { useState, useEffect, useMemo } from 'react';
import { Contact, Book, Transaction } from '../types';

interface TransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { transactionToEdit?: Transaction | null; contactId: string; booksWithQuantity: { book: Book; quantity: number }[] }) => void;
    contacts: Contact[];
    books: Book[];
    transactionToEdit?: Transaction | null; // NEW prop
}

const TransactionForm: React.FC<TransactionFormProps> = ({ isOpen, onClose, onSave, contacts, books, transactionToEdit }) => {
    const initialDate = new Date().toISOString().split('T')[0];
    const [contactId, setContactId] = useState('');
    const [selectedBooks, setSelectedBooks] = useState<Map<string, { book: Book; quantity: number }>>(new Map());
    const [bookSearch, setBookSearch] = useState('');
    const [transactionDate, setTransactionDate] = useState(initialDate); // NEW STATE
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!isOpen) {
            setContactId('');
            setSelectedBooks(new Map());
            setBookSearch('');
            setErrors({});
            setTransactionDate(initialDate); // RESET DATE
        } else if (transactionToEdit) {
            setContactId(transactionToEdit.contactId);
            const initialMap = new Map<string, { book: Book; quantity: number }>();
            transactionToEdit.books.forEach(tBook => {
                const fullBook = books.find(b => b.id === tBook.id);
                if (fullBook) {
                    initialMap.set(tBook.id, { book: fullBook, quantity: tBook.quantity });
                }
            });
            setSelectedBooks(initialMap);
            // SET DATE FROM TRANSACTION
            const dateObj = transactionToEdit.transactionDate?.toDate ? transactionToEdit.transactionDate.toDate() : new Date();
            setTransactionDate(dateObj.toISOString().split('T')[0]); 
        }
    }, [isOpen, transactionToEdit, books]);

    const filteredBooks = useMemo(() => {
        // Include books that are currently selected, even if out of stock
        const selectedBookIds = Array.from(selectedBooks.keys());
        
        return books.filter(book => {
            const isSelected = selectedBookIds.includes(book.id);
            const isAvailable = book.stock > 0;
            const matchesSearch = !bookSearch || (
                (book.title || '').toLowerCase().includes(bookSearch.toLowerCase()) ||
                (book.author || '').toLowerCase().includes(bookSearch.toLowerCase())
            );
            
            // Show if selected OR if available and matches search
            return isSelected || (isAvailable && matchesSearch);
        });
    }, [books, bookSearch, selectedBooks]);

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
            // For new selection, set quantity to 1
            newSelection.set(book.id, { book, quantity: 1 });
        }
        setSelectedBooks(newSelection);
    };

    const handleQuantityChange = (bookId: string, newQuantityValue: number) => {
        const newSelection = new Map(selectedBooks);
        const item = newSelection.get(bookId);
        
        if (item) {
            let quantity = isNaN(newQuantityValue) ? 0 : Math.floor(newQuantityValue);
            
            // When editing, we need to consider the current quantity already in the transaction
            const originalQuantity = transactionToEdit?.books.find(b => b.id === bookId)?.quantity || 0;
            
            // Available stock is: (current stock) + (original quantity in this transaction)
            const maxAllowed = item.book.stock + originalQuantity;
            
            // Clamp the new quantity between 1 and the max allowed (or 0 if deleting)
            quantity = Math.max(0, Math.min(quantity, maxAllowed));

            // Remove if quantity is set to 0, otherwise update
            if (quantity === 0) {
                 newSelection.delete(bookId);
            } else {
                newSelection.set(bookId, { ...item, quantity });
            }
            setSelectedBooks(newSelection);
        }
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!contactId) newErrors.contactId = 'A customer must be selected.';
        if (selectedBooks.size === 0) newErrors.books = 'At least one book must be selected.';
        // NEW DATE VALIDATION
        if (!transactionDate || isNaN(new Date(transactionDate).getTime())) newErrors.transactionDate = 'A valid date is required.';

        for (const { book, quantity } of selectedBooks.values()) {
            if (quantity === 0 || isNaN(quantity)) {
                newErrors.books = `Quantity for "${book.title}" cannot be zero.`;
                break;
            }
            // Additional check for maximum stock constraint (handled by handler, but good to double check on submit)
            const originalQuantity = transactionToEdit?.books.find(b => b.id === book.id)?.quantity || 0;
            if (quantity > (book.stock + originalQuantity)) {
                 newErrors.books = `Quantity for "${book.title}" exceeds available stock.`;
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
                transactionToEdit,
                contactId,
                booksWithQuantity: Array.from(selectedBooks.values()).map(item => ({...item, quantity: item.quantity || 0})),
                transactionDate: new Date(transactionDate), // PASS DATE OBJECT TO SAVE HANDLER
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{transactionToEdit ? 'Edit Transaction' : 'New Transaction'}</h2>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                        <div>
                            <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
                            <input 
                                type="date" 
                                id="transactionDate" 
                                name="transactionDate" 
                                value={transactionDate} 
                                onChange={(e) => setTransactionDate(e.target.value)} 
                                className={`mt-1 block w-full px-3 py-2 border ${errors.transactionDate ? 'border-red-500' : 'border-gray-300'} rounded-md`} 
                                required 
                            />
                            {errors.transactionDate && <p className="text-red-500 text-xs mt-1">{errors.transactionDate}</p>}
                        </div>
                        <div>
                            <label htmlFor="contactId" className="block text-sm font-medium text-gray-700">Customer <span className="text-red-500">*</span></label>
                            {/* Disable customer change if editing an existing transaction to maintain integrity */}
                            <select id="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!!transactionToEdit} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.contactId ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${transactionToEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
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
                            {filteredBooks.map(book => {
                                const isSelected = selectedBooks.has(book.id);
                                const currentItem = selectedBooks.get(book.id);
                                const maxStock = book.stock + (transactionToEdit?.books.find(b => b.id === book.id)?.quantity || 0);

                                return (
                                    <div key={book.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                                        <div className="flex items-center">
                                            <input type="checkbox" checked={isSelected} onChange={() => handleBookToggle(book)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                                            <div className="ml-3 text-sm">
                                                <label className="font-medium text-gray-900">{book.title}</label>
                                                <p className="text-gray-500">{book.author} - ${book.price.toFixed(2)} (In stock: {book.stock})</p>
                                            </div>
                                        </div>
                                        {isSelected && currentItem && (
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-500">Max: {maxStock}</span>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max={maxStock} 
                                                    value={currentItem.quantity || ''} 
                                                    onChange={(e) => handleQuantityChange(book.id, parseInt(e.target.value, 10))} 
                                                    className="w-20 text-center border-gray-300 rounded-md shadow-sm" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
