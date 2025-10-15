import React, { useState, useMemo, Fragment } from 'react';
import { Book } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface BookTableProps {
    books: Book[];
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onUpdateBook: (book: Book) => void;
}

const ITEMS_PER_PAGE = 10;

// Define types for sorting keys and direction
type SortKey = 'title' | 'author' | 'genre' | 'publicationYear' | 'price' | 'stock';
type SortDirection = 'asc' | 'desc';

const BookTable: React.FC<BookTableProps> = ({ books, onEdit, onDelete, isAdmin, onUpdateBook }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
    // State for sorting
    const [sortColumn, setSortColumn] = useState<SortKey>('title');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // --- Sorting Logic ---
    const sortedBooks = useMemo(() => {
        // Create a shallow copy to sort without mutating the original prop
        const sorted = [...books].sort((a, b) => {
            // Handle null/undefined values by treating them as smaller/larger for consistent sorting
            const aValue = a[sortColumn] ?? (sortDirection === 'asc' ? -Infinity : Infinity);
            const bValue = b[sortColumn] ?? (sortDirection === 'asc' ? -Infinity : Infinity);

            // Compare based on type
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue);
            }
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return aValue - bValue;
            }
            return 0;
        });

        // Apply direction
        if (sortDirection === 'desc') {
            return sorted.reverse();
        }
        return sorted;
    }, [books, sortColumn, sortDirection]);


    const totalPages = Math.ceil(sortedBooks.length / ITEMS_PER_PAGE);

    const paginatedBooks = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedBooks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, sortedBooks]);

    const handleToggleExpand = (bookId: string) => {
        setExpandedBookId(prevId => (prevId === bookId ? null : bookId));
    };

    // --- New Sort Handler ---
    const handleSort = (column: SortKey) => {
        // Reset page to 1 when sorting
        setCurrentPage(1); 
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };
    
    // Helper function to render the sort indicator
    const renderSortIndicator = (column: SortKey) => {
        if (sortColumn !== column) return null;
        return sortDirection === 'asc' ? ' ▲' : ' ▼';
    };

    const handleFieldUpdate = (book: Book, field: keyof Book, value: string) => {
        if (isAdmin) {
            const updatedBook = { ...book, [field]: value };
            onUpdateBook(updatedBook);
        }
    };

    const headerConfigs: { key: SortKey; label: string; hideOnSmall?: boolean }[] = [
        { key: 'title', label: 'Title' },
        { key: 'author', label: 'Author', hideOnSmall: true },
        { key: 'genre', label: 'Genre' },
        { key: 'publicationYear', label: 'Year' },
        { key: 'price', label: 'Price' },
        { key: 'stock', label: 'Stock' },
    ];

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {headerConfigs.map(config => (
                                <th 
                                    key={config.key}
                                    scope="col" 
                                    // Make header clickable to trigger sorting
                                    onClick={() => handleSort(config.key)}
                                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${config.hideOnSmall ? 'hidden lg:table-cell' : ''}`}
                                >
                                    {config.label}
                                    {renderSortIndicator(config.key)}
                                </th>
                            ))}
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedBooks.map((book) => (
                            <Fragment key={book.id}>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'title', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'author', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.author}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'genre', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.genre}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'publicationYear', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.publicationYear}</td>
                                    {/* Use toLocaleString for currency formatting */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'price', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'stock', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.stock}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button
                                                onClick={() => handleToggleExpand(book.id)}
                                                className="lg:hidden px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded hover:bg-indigo-200"
                                            >
                                                {expandedBookId === book.id ? 'Hide' : 'View'}
                                            </button>
                                            <button onClick={() => onEdit(book)} className="text-indigo-600 hover:text-indigo-900"><EditIcon className="h-5 w-5"/></button>
                                            <button onClick={() => onDelete(book.id)} className="text-red-600 hover:text-red-900"><DeleteIcon className="h-5 w-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                                {expandedBookId === book.id && (
                                    <tr className="lg:hidden bg-gray-50">
                                        <td colSpan={6} className="px-6 py-4">
                                            <div className="space-y-3 text-sm text-gray-600">
                                                <p><strong className="font-medium text-gray-800">Author:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'author', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.author || '-'}</span></p>
                                                <p><strong className="font-medium text-gray-800">ISBN:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'isbn', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.isbn || '-'}</span></p>
                                                <p><strong className="font-medium text-gray-800">Publisher:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(book, 'publisher', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{book.publisher || '-'}</span></p>
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
                            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, books.length)}</span> of <span className="font-medium">{books.length}</span> results
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

export default BookTable;