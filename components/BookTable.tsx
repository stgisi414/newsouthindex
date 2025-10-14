import React, { useState, useMemo, Fragment } from 'react';
import { Book } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface BookTableProps {
    books: Book[];
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

const BookTable: React.FC<BookTableProps> = ({ books, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
    const totalPages = Math.ceil(books.length / ITEMS_PER_PAGE);

    const paginatedBooks = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return books.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, books]);

    const handleToggleExpand = (bookId: string) => {
        setExpandedBookId(prevId => (prevId === bookId ? null : bookId));
    };

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Author</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Genre</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedBooks.map((book) => (
                            <Fragment key={book.id}>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{book.author}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.genre}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.publicationYear}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${book.price.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.stock}</td>
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
                                        <td colSpan={5} className="px-6 py-4">
                                            <div className="space-y-3 text-sm text-gray-600">
                                                <p><strong className="font-medium text-gray-800">Author:</strong> {book.author || '-'}</p>
                                                <p><strong className="font-medium text-gray-800">ISBN:</strong> {book.isbn || '-'}</p>
                                                <p><strong className="font-medium text-gray-800">Publisher:</strong> {book.publisher || '-'}</p>
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