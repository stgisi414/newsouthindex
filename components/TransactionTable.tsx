import React, { useState, useMemo, Fragment } from 'react';
import { Transaction } from '../types';
import DeleteIcon from './icons/DeleteIcon';
import EditIcon from './icons/EditIcon'; // Added EditIcon

interface TransactionTableProps {
    transactions: Transaction[];
    onEdit: (transaction: Transaction) => void; // Added onEdit prop
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onUpdateTransaction: (transaction: Transaction, updatedData: Partial<Transaction>) => void; // Added onUpdateTransaction
}

const ITEMS_PER_PAGE = 10;

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onEdit, onDelete, isAdmin, onUpdateTransaction }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

    const sortedTransactions = useMemo(() => {
        // NOTE: Sorting by transactionDate.seconds is correct for Firestore Timestamps
        return [...transactions].sort((a, b) => b.transactionDate?.seconds - a.transactionDate?.seconds);
    }, [transactions]);

    const totalPages = Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, sortedTransactions]);

    const handleToggleExpand = (transactionId: string) => {
        setExpandedTransactionId(prevId => (prevId === transactionId ? null : transactionId));
    };
    
    // NEW: Handle inline field updates
    const handleFieldUpdate = (transaction: Transaction, field: keyof Transaction, value: string) => {
        if (!isAdmin) return;
        
        let updatedValue: string | number = value;

        if (field === 'totalPrice') {
            const price = parseFloat(value);
            if (isNaN(price) || price < 0) {
                console.error("Invalid price update:", value);
                // Optionally visually revert or show error here
                return; 
            }
            updatedValue = price;
        }

        onUpdateTransaction(transaction, { [field]: updatedValue });
    };

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedTransactions.map((transaction) => (
                            <Fragment key={transaction.id}>
                                <tr className="hover:bg-gray-50">
                                    {/* Inline Editable Contact Name */}
                                    <td 
                                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" 
                                        contentEditable={isAdmin}
                                        onBlur={(e) => handleFieldUpdate(transaction, 'contactName', e.currentTarget.textContent || '')}
                                        suppressContentEditableWarning={true}
                                    >
                                        {transaction.contactName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {transaction.transactionDate?.toDate().toLocaleDateString()}
                                    </td>
                                    {/* Inline Editable Total Price */}
                                    <td 
                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                        contentEditable={isAdmin}
                                        onBlur={(e) => handleFieldUpdate(transaction, 'totalPrice', e.currentTarget.textContent || '')}
                                        suppressContentEditableWarning={true}
                                    >
                                        ${transaction.totalPrice.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button 
                                                onClick={() => handleToggleExpand(transaction.id)}
                                                className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded hover:bg-indigo-200"
                                            >
                                                {expandedTransactionId === transaction.id ? 'Hide' : 'View'}
                                            </button>
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => onEdit(transaction)} className="text-indigo-600 hover:text-indigo-900">
                                                        <EditIcon className="h-5 w-5"/>
                                                    </button>
                                                    <button onClick={() => onDelete(transaction.id)} className="text-red-600 hover:text-red-900">
                                                        <DeleteIcon className="h-5 w-5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedTransactionId === transaction.id && (
                                    <tr>
                                        <td colSpan={4} className="p-4 bg-gray-50">
                                            <div>
                                                <h4 className="text-md font-semibold mb-2">Purchased Books</h4>
                                                <ul className="list-disc pl-5">
                                                    {transaction.books.map(book => (
                                                        <li key={book.id} className="text-sm">
                                                            {book.title} (x{book.quantity}) - ${book.price.toFixed(2)} each
                                                        </li>
                                                    ))}
                                                </ul>
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
                            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)}</span> of <span className="font-medium">{transactions.length}</span> results
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

export default TransactionTable;
