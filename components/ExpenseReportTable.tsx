import React, { useState, useMemo, useEffect } from 'react';
import { ExpenseReport, UserRole } from '../types';
import { Timestamp } from 'firebase/firestore';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';
import AdvancedFilter, { FilterConfig } from './AdvancedFilter';

// Print Icon Component
const PrintIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-8V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

interface ExpenseReportTableProps {
  reports: ExpenseReport[];
  onEdit: (report: ExpenseReport, options: { isPrinting: boolean }) => void;
  onDelete: (reportId: string) => void;
  currentUserRole: UserRole | null;
  isAdmin?: boolean; 
}

const ExpenseReportTable: React.FC<ExpenseReportTableProps> = ({ 
  reports = [], 
  onEdit, 
  onDelete,
  currentUserRole
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(''); // New simple date filter state
  
  // This state holds the data AFTER AdvancedFilter has processed it
  const [advancedFilteredData, setAdvancedFilteredData] = useState<ExpenseReport[]>(reports);

  // Sync initial state when reports prop updates
  useEffect(() => {
    setAdvancedFilteredData(reports);
  }, [reports]);

  // Filter Configuration (Keeping AdvancedFilter if you still want to use it for Amount/Status)
  const filterConfig: FilterConfig[] = [
    { id: 'reportNumber', field: 'reportNumber', label: 'Report #', type: 'text' },
    { id: 'staffName', field: 'staffName', label: 'Staff Name', type: 'text' },
    { id: 'status', field: 'status', label: 'Status', type: 'select', options: ['Draft', 'Submitted', 'Approved', 'Paid', 'Rejected'] },
    { id: 'amountRange', field: 'totalAmount', label: 'Amount Range', type: 'numberRange' },
    // Removed dateRange from here to avoid confusion, user wants simple input
  ];

  // Helper to format date for display
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    } catch {
        return 'Invalid Date';
    }
  };

  // Helper to extract YYYY-MM-DD string from any report date format
  const getReportDateString = (dateVal: any): string => {
      if (!dateVal) return '';
      let d: Date | null = null;

      try {
          if (dateVal instanceof Timestamp) {
              d = dateVal.toDate();
          } else if (dateVal instanceof Date) {
              d = dateVal;
          } else if (typeof dateVal === 'string') {
              d = new Date(dateVal);
          }

          if (d && !isNaN(d.getTime())) {
              // Convert to local YYYY-MM-DD
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
          }
      } catch (e) {
          return '';
      }
      return '';
  };

  // Combine: AdvancedFilter Results + Text Search + NEW Date Filter
  const finalFilteredReports = useMemo(() => {
    const baseData = Array.isArray(advancedFilteredData) ? advancedFilteredData : [];
    
    return baseData.filter((report) => {
        // 1. Text Search
        const query = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (
            (report.staffName || '').toLowerCase().includes(query) ||
            (report.reportNumber || '').toString().includes(query) ||
            (report.status || '').toLowerCase().includes(query)
        );

        // 2. Simple Date Filter
        let matchesDate = true;
        if (filterDate) {
            const rDate = getReportDateString(report.reportDate);
            matchesDate = rDate === filterDate;
        }

        return matchesSearch && matchesDate;
    });
  }, [advancedFilteredData, searchQuery, filterDate]);

  const filteredTotal = useMemo(() => {
      return finalFilteredReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }, [finalFilteredReports]);

  const canDelete = currentUserRole === UserRole.MASTER_ADMIN || currentUserRole === UserRole.BOOKKEEPER || currentUserRole === UserRole.ADMIN;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header Controls */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Text Search */}
            <input
                type="text"
                placeholder="Search reports..."
                className="border rounded-md px-3 py-2 w-full md:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {/* NEW: Simple Date Filter Input */}
            <div className="relative">
                <input 
                    type="date" 
                    className="border rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:border-indigo-500"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    title="Filter by exact date"
                />
                {filterDate && (
                    <button 
                        onClick={() => setFilterDate('')}
                        className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear date"
                    >
                        {/* Small X to clear date */}
                        <span className="text-lg font-bold">&times;</span>
                    </button>
                )}
            </div>
        </div>
        
        <div className="text-sm font-medium text-gray-500">
            Showing {finalFilteredReports.length} records 
            <span className="ml-2 font-bold text-gray-900">
                (Total: ${filteredTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})
            </span>
        </div>
      </div>

      {/* Advanced Filter Component (Still here for Status/Amount ranges if needed) */}
      <div className="px-4 pt-2">
        <AdvancedFilter
            data={reports || []}
            filterConfig={filterConfig}
            onFilterChange={setAdvancedFilteredData}
            initialOpen={false}
        />
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {finalFilteredReports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.reportNumber || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {report.staffName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(report.reportDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${report.status === 'Approved' || report.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                      report.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 
                      report.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                      'bg-gray-100 text-gray-800'}`}>
                    {report.status || 'Draft'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  ${(report.totalAmount || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
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
                    
                    {canDelete && (
                        <button
                        onClick={() => onDelete(report.id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                        >
                        <DeleteIcon className="h-5 w-5" />
                        </button>
                    )}
                </td>
              </tr>
            ))}
            {finalFilteredReports.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No reports found matching your filters.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseReportTable;