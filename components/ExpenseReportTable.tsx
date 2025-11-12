import React from 'react';
// FIX: Removed ExpenseReportStatus and ExpenseReportCategory
import { ExpenseReport, UserRole } from '../types.ts'; 
import EditIcon from './icons/EditIcon.tsx';
import DeleteIcon from './icons/DeleteIcon.tsx';

// Add a PrintIcon
const PrintIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-8V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
};

// Helper to format date
const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString(); // e.g., "11/1/2025"
    } catch {
        return 'Invalid Date';
    }
};

// REMOVED: getStatusColor function

interface ExpenseReportTableProps {
    reports: ExpenseReport[];
    // FIX: Simplified onEdit signature (matches Dashboard.tsx)
    onEdit: (report: ExpenseReport, options: { isPrinting: boolean }) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    currentUserRole: UserRole | null;
}

const ExpenseReportTable: React.FC<ExpenseReportTableProps> = ({ reports, onEdit, onDelete, isAdmin, currentUserRole }) => {

    // REMOVED: Status filter state and memo
    const canDelete = currentUserRole === UserRole.MASTER_ADMIN || currentUserRole === UserRole.BOOKKEEPER;

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            {/* REMOVED: Filter dropdown */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Member</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                            <th className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {/* FIX: Use 'reports' directly */}
                        {reports.map((report) => (
                            <tr key={report.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{report.reportNumber}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.staffName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(report.expenseDate)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(report.totalAmount)}</td>
                                <td className="px-4 py-4 whitespace-nowop text-sm text-gray-500 truncate max-w-xs">{report.notes}</td>
                                {/* REMOVED: Status TD */}
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                    <button 
                                        onClick={() => onEdit(report, { isPrinting: true })} 
                                        className="text-gray-500 hover:text-indigo-600"
                                        title="Print Report"
                                    >
                                        <PrintIcon className="h-5 w-5" />
                                    </button>
                                    <button 
                                        onClick={() => onEdit(report, { isPrinting: false })} 
                                        className="text-indigo-600 hover:text-indigo-900"
                                        title="Edit Report"
                                    >
                                        <EditIcon className="h-5 w-5" />
                                    </button>
                                    {/* Only Master Admins / Bookkeepers can delete */}
                                    {canDelete && (
                                        <button 
                                            onClick={() => onDelete(report.id)} 
                                            className="text-red-600 hover:text-red-900"
                                            title="Delete Report"
                                        >
                                            <DeleteIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExpenseReportTable;