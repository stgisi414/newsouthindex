import React, { useState, useMemo } from 'react';
import { Contact, Transaction, Book, Category } from '../types';

interface ReportsProps {
    contacts: Contact[];
    transactions: Transaction[];
    books: Book[];
}

const Reports: React.FC<ReportsProps> = ({ contacts, transactions, books }) => {
    const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
    const [stateFilter, setStateFilter] = useState('');
    const [zipFilter, setZipFilter] = useState('');

    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            const categoryMatch = categoryFilter === 'all' || contact.category === categoryFilter;
            const stateMatch = !stateFilter || (contact.state && contact.state.toLowerCase().includes(stateFilter.toLowerCase()));
            const zipMatch = !zipFilter || (contact.zip && contact.zip.startsWith(zipFilter));
            return categoryMatch && stateMatch && zipMatch;
        });
    }, [contacts, categoryFilter, stateFilter, zipFilter]);

    const topCustomers = useMemo(() => {
        const customerSpending: { [key: string]: { name: string; total: number } } = {};
        transactions.forEach(t => {
            if (!customerSpending[t.contactId]) {
                customerSpending[t.contactId] = { name: t.contactName, total: 0 };
            }
            customerSpending[t.contactId].total += t.totalPrice;
        });
        return Object.values(customerSpending).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [transactions]);

    const bestSellingBooks = useMemo(() => {
        const bookSales: { [key: string]: { title: string; quantity: number } } = {};
        transactions.forEach(t => {
            t.books.forEach(bookInTransaction => {
                if (!bookSales[bookInTransaction.id]) {
                    const bookInfo = books.find(b => b.id === bookInTransaction.id);
                    bookSales[bookInTransaction.id] = { title: bookInfo?.title || 'Unknown Book', quantity: 0 };
                }
                bookSales[bookInTransaction.id].quantity += bookInTransaction.quantity;
            });
        });
        return Object.values(bookSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    }, [transactions, books]);

    const convertToCSV = (data: Contact[]) => {
        if (data.length === 0) return '';
        const headers = ['FirstName', 'LastName', 'Email', 'Phone', 'Address1', 'Address2', 'City', 'State', 'Zip'];
        const rows = data.map(contact => 
            [
                contact.firstName,
                contact.lastName,
                contact.email,
                contact.phone,
                contact.address1 || '',
                contact.address2 || '',
                contact.city || '',
                contact.state || '',
                contact.zip || ''
            ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    };

    const handleExport = () => {
        const csv = convertToCSV(filteredContacts);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'mailing-list.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-8">
            {/* Mailing List Export */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Mailing List Export</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label htmlFor="categoryFilter" className="block text-sm font-medium text-gray-700">Category</label>
                        <select
                            id="categoryFilter"
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value as Category | 'all')}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="all">All</option>
                            {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="stateFilter" className="block text-sm font-medium text-gray-700">State</label>
                        <input
                            type="text"
                            id="stateFilter"
                            value={stateFilter}
                            onChange={e => setStateFilter(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="e.g., AL"
                        />
                    </div>
                    <div>
                        <label htmlFor="zipFilter" className="block text-sm font-medium text-gray-700">Zip Code</label>
                        <input
                            type="text"
                            id="zipFilter"
                            value={zipFilter}
                            onChange={e => setZipFilter(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="e.g., 36104"
                        />
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">{filteredContacts.length} contacts match filters.</p>
                    <button
                        onClick={handleExport}
                        disabled={filteredContacts.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                        Export as CSV
                    </button>
                </div>
            </div>

            {/* Sales Reports */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">Top 10 Customers</h3>
                    <ul className="divide-y divide-gray-200">
                        {topCustomers.map((customer, index) => (
                            <li key={index} className="py-3 flex justify-between items-center">
                                <span className="text-gray-700">{customer.name}</span>
                                <span className="font-semibold text-gray-900">${customer.total.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">Top 10 Best-Selling Books</h3>
                     <ul className="divide-y divide-gray-200">
                        {bestSellingBooks.map((book, index) => (
                            <li key={index} className="py-3 flex justify-between items-center">
                                <span className="text-gray-700">{book.title}</span>
                                <span className="font-semibold text-gray-900">{book.quantity} sold</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Reports;