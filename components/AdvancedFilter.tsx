import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '../types'; // Import Category enum
import ChevronDownIcon from './icons/ChevronDownIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';

// Define types for configuration
type FilterType = 'text' | 'select' | 'numberRange' | 'dateRange' | 'boolean';
interface FilterFieldConfig {
  field: string; // The key in the data object (e.g., 'firstName', 'category', 'price')
  label: string; // User-friendly label (e.g., 'First Name', 'Category', 'Price')
  type: FilterType;
  options?: string[]; // For 'select' type (e.g., Category enum values)
}

interface AdvancedFilterProps<T> {
  data: T[]; // The original unfiltered data
  filterConfig: FilterFieldConfig[];
  onFilterChange: (filteredData: T[]) => void; // Callback with the filtered results
  initialOpen?: boolean;
}

// Helper function to check if an item matches the current filters
const itemMatchesFilters = <T extends Record<string, any>>(item: T, filters: Record<string, any>, config: FilterFieldConfig[]): boolean => {
  for (const conf of config) {
    const filterValue = filters[conf.field];
    
    // Skip if no filter value
    if (filterValue === undefined || filterValue === '' || filterValue === null) continue;

    const itemValue = item[conf.field];
    
    // --- NEW LOGIC START ---
    // Handle "New Fields" mapping for search
    // If we are filtering by 'email', check the new 'emails' array
    if (conf.field === 'email' && Array.isArray(item.emails)) {
        const match = item.emails.some((e: any) => e.address.toLowerCase().includes(String(filterValue).toLowerCase()));
        if (!match) return false;
        continue; // Passed this filter, move to next
    }
    
    // If filtering by 'phone', check the 'phones' array
    if (conf.field === 'phone' && Array.isArray(item.phones)) {
        // Strip formatting for search
        const searchClean = String(filterValue).replace(/\D/g, ''); 
        const match = item.phones.some((p: any) => p.number.replace(/\D/g, '').includes(searchClean));
        if (!match) return false;
        continue;
    }

    // If filtering by 'city', 'state', or 'zip', check 'addresses' array
    if (['city', 'state', 'zip'].includes(conf.field) && Array.isArray(item.addresses)) {
        const match = item.addresses.some((a: any) => 
            String(a[conf.field] || '').toLowerCase().includes(String(filterValue).toLowerCase())
        );
        if (!match) return false;
        continue;
    }
    // --- NEW LOGIC END ---

    // ... Existing switch statement for standard fields (sequentialId, names, etc.) ...
    switch (conf.type) {
      case 'text':
         const stringValue = itemValue !== undefined && itemValue !== null ? String(itemValue) : '';
         if (!stringValue.toLowerCase().includes(String(filterValue).toLowerCase())) return false;
         break;
      case 'select':
        if (itemValue !== filterValue) {
          return false;
        }
        break;
      case 'numberRange':
        // Assuming filterValue is { min: number | '', max: number | '' }
        if (typeof itemValue !== 'number' ||
            (filterValue.min !== '' && itemValue < filterValue.min) ||
            (filterValue.max !== '' && itemValue > filterValue.max)) {
          return false;
        }
        break;
      case 'dateRange':
         // Assuming filterValue is { start: Date | null, end: Date | null }
         // Assuming itemValue is a Firestore Timestamp or Date object
         const itemDate = itemValue?.toDate ? itemValue.toDate() : (itemValue instanceof Date ? itemValue : null);
         if (!itemDate ||
             (filterValue.start && itemDate < filterValue.start) ||
             (filterValue.end && itemDate > filterValue.end)) {
             return false;
         }
         break;
      case 'boolean':
        // filterValue will be 'true' or 'false' (as strings)
        const filterBool = filterValue === 'true';
        const itemBool = !!itemValue; // Coerce undefined/null to false
        if (itemBool !== filterBool) {
            return false;
        }
        break;
      // Add other types as needed
    }
  }
  return true; // Item passes all active filters
};


function AdvancedFilter<T extends Record<string, any>>({ data, filterConfig, onFilterChange, initialOpen = true }: AdvancedFilterProps<T>) {
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [isOpen, setIsOpen] = useState(initialOpen);

  // Debounce filtering to avoid performance issues on rapid input changes
  const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Memoized debounced filter application function
  const applyFilters = useCallback(
    debounce((currentFilters: Record<string, any>) => {
      const filtered = data.filter(item => itemMatchesFilters(item, currentFilters, filterConfig));
      onFilterChange(filtered);
    }, 300), // 300ms debounce delay
    [data, filterConfig, onFilterChange] // Dependencies for useCallback
  );


  useEffect(() => {
    applyFilters(activeFilters);
  }, [activeFilters, applyFilters]); // Rerun effect when filters change

  const handleInputChange = (field: string, value: any, type: FilterType) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      if (type === 'numberRange' || type === 'dateRange') {
        newFilters[field] = { ...newFilters[field], ...value }; // Merge min/max or start/end
      } else {
        newFilters[field] = value;
      }

      // Clear filter if value is empty/null/default
      if (value === '' || value === null || (type === 'select' && value === 'All') || (type === 'boolean' && value === 'All')) {
         delete newFilters[field];
      }
      // Clear range if both min/max or start/end are empty/null
      if ((type === 'numberRange' && (newFilters[field]?.min === '' || newFilters[field]?.min == null) && (newFilters[field]?.max === '' || newFilters[field]?.max == null)) ||
          (type === 'dateRange' && !newFilters[field]?.start && !newFilters[field]?.end)) {
           delete newFilters[field];
      }

      return newFilters;
    });
  };

  const renderFilterInput = (config: FilterFieldConfig) => {
    const { field, label, type, options } = config;
    const commonClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";

    switch (type) {
      case 'text':
        return (
          <input
            type="text"
            placeholder={`Filter by ${label}...`}
            value={activeFilters[field] || ''}
            onChange={(e) => handleInputChange(field, e.target.value, type)}
            className={commonClasses}
          />
        );
      case 'select':
        return (
          <select
            value={activeFilters[field] || 'All'}
            onChange={(e) => handleInputChange(field, e.target.value, type)}
            className={commonClasses}
          >
            <option value="All">All {label}s</option>
            {options?.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        );
       case 'numberRange':
            return (
                <div className="flex space-x-2">
                    <input
                        type="number"
                        placeholder="Min"
                        value={activeFilters[field]?.min || ''}
                        onChange={(e) => handleInputChange(field, { min: e.target.value ? parseFloat(e.target.value) : '' }, type)}
                        className={`${commonClasses} w-1/2`}
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={activeFilters[field]?.max || ''}
                        onChange={(e) => handleInputChange(field, { max: e.target.value ? parseFloat(e.target.value) : '' }, type)}
                        className={`${commonClasses} w-1/2`}
                    />
                </div>
            );
        case 'dateRange':
             return (
                 <div className="flex space-x-2 items-center">
                     <input
                         type="date"
                         value={activeFilters[field]?.start ? activeFilters[field].start.toISOString().split('T')[0] : ''}
                         onChange={(e) => handleInputChange(field, { start: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }, type)} // Add time to avoid timezone issues
                         className={`${commonClasses} w-1/2`}
                     />
                     <span>to</span>
                     <input
                         type="date"
                         value={activeFilters[field]?.end ? activeFilters[field].end.toISOString().split('T')[0] : ''}
                         onChange={(e) => handleInputChange(field, { end: e.target.value ? new Date(e.target.value + 'T23:59:59') : null }, type)} // End of day
                         className={`${commonClasses} w-1/2`}
                     />
                 </div>
             );
      case 'boolean':
        return (
            <select
                value={activeFilters[field] || 'All'}
                onChange={(e) => handleInputChange(field, e.target.value, type)}
                className={commonClasses}
            >
                <option value="All">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        );
      default:
        return null;
    }
  };

  return (
    // Updated container with border-b only if open
    <div className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm mb-4 ${!isOpen ? 'border-b-0' : ''}`}>
        {/* Header with Toggle Button */}
        <div
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-100"
            onClick={() => setIsOpen(!isOpen)}
        >
            <h3 className="text-md font-semibold text-gray-700">Advanced Filters</h3>
            <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                aria-expanded={isOpen}
            >
                {isOpen ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </button>
        </div>

        {/* Collapsible Content */}
        {isOpen && (
            <div className="p-4 border-t border-gray-200"> {/* Added border-t */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filterConfig.map(config => (
                  <div key={config.field}>
                    <label className="block text-sm font-medium text-gray-700">{config.label}</label>
                    {renderFilterInput(config)}
                  </div>
                ))}
              </div>
              {/* Optional: Add a button to clear all filters */}
              <div className="mt-4 text-right">
                  <button
                      onClick={() => {
                          setActiveFilters({}); // Clear local state
                          // Optionally call onFilterChange immediately with original data if needed
                          // onFilterChange(data);
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                      Clear Filters
                  </button>
              </div>
            </div>
        )}
    </div>
  );
}

export default AdvancedFilter;