import React, { useState, useEffect, useCallback } from 'react';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';

// Define types for configuration
export type FilterType = 'text' | 'select' | 'numberRange' | 'dateRange' | 'boolean';

export interface FilterFieldConfig {
  field: string; // The key in the data object
  label: string; // User-friendly label
  type: FilterType;
  options?: string[]; // For 'select' type
  id?: string; // Optional unique ID if needed
}

interface AdvancedFilterProps<T> {
  data: T[]; // The original unfiltered data
  filterConfig: FilterFieldConfig[];
  onFilterChange: (filteredData: T[]) => void; // Callback with the filtered results
  initialOpen?: boolean;
  initialFilters?: Record<string, any>; // Allow passing initial state
}

// Helper function to check if an item matches the current filters
const itemMatchesFilters = <T extends Record<string, any>>(item: T, filters: Record<string, any>, config: FilterFieldConfig[]): boolean => {
  for (const conf of config) {
    const filterValue = filters[conf.field];
    
    // Skip if no filter value
    if (filterValue === undefined || filterValue === '' || filterValue === null) continue;

    const itemValue = item[conf.field];
    
    // Handle "New Fields" mapping for search (Legacy support for Contacts)
    if (conf.field === 'email' && Array.isArray(item.emails)) {
        const match = item.emails.some((e: any) => e.address.toLowerCase().includes(String(filterValue).toLowerCase()));
        if (!match) return false;
        continue;
    }
    if (conf.field === 'phone' && Array.isArray(item.phones)) {
        const searchClean = String(filterValue).replace(/\D/g, ''); 
        const match = item.phones.some((p: any) => p.number.replace(/\D/g, '').includes(searchClean));
        if (!match) return false;
        continue;
    }
    if (['city', 'state', 'zip'].includes(conf.field) && Array.isArray(item.addresses)) {
        const match = item.addresses.some((a: any) => 
            String(a[conf.field] || '').toLowerCase().includes(String(filterValue).toLowerCase())
        );
        if (!match) return false;
        continue;
    }

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
        // filterValue is { min: number | '', max: number | '' }
        if (typeof itemValue !== 'number' ||
            (filterValue.min !== '' && itemValue < filterValue.min) ||
            (filterValue.max !== '' && itemValue > filterValue.max)) {
          return false;
        }
        break;

      case 'dateRange':
         let itemDate: Date | null = null;

         if (itemValue && typeof itemValue.toDate === 'function') {
            // Firestore Timestamp
            itemDate = itemValue.toDate();
         } else if (itemValue instanceof Date) {
            // JS Date Object
            itemDate = itemValue;
         } else if (typeof itemValue === 'string') {
             // FIX: Handle YYYY-MM-DD strings by forcing Local Time
             // This prevents "2023-11-20" from being read as "2023-11-19 19:00 (EST)" due to UTC conversion
             if (/^\d{4}-\d{2}-\d{2}$/.test(itemValue)) {
                 const [y, m, d] = itemValue.split('-').map(Number);
                 itemDate = new Date(y, m - 1, d); // Construct as Local Date
             } else {
                 const parsed = new Date(itemValue);
                 if (!isNaN(parsed.getTime())) itemDate = parsed;
             }
         }

         // If we couldn't parse a valid date from the item, it fails the filter
         if (!itemDate) return false;

         // Compare
         if (filterValue.start && itemDate < filterValue.start) return false;
         if (filterValue.end && itemDate > filterValue.end) return false;
         break;

      case 'boolean':
        const filterBool = filterValue === 'true';
        const itemBool = !!itemValue;
        if (itemBool !== filterBool) {
            return false;
        }
        break;
    }
  }
  return true;
};


function AdvancedFilter<T extends Record<string, any>>({ 
    data, 
    filterConfig, 
    onFilterChange, 
    initialOpen = true,
    initialFilters = {}
}: AdvancedFilterProps<T>) {
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>(initialFilters);
  const [isOpen, setIsOpen] = useState(initialOpen);

  // Debounce logic
  const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  const applyFilters = useCallback(
    debounce((currentFilters: Record<string, any>) => {
      // Safety check for data array
      const safeData = Array.isArray(data) ? data : [];
      const filtered = safeData.filter(item => itemMatchesFilters(item, currentFilters, filterConfig));
      onFilterChange(filtered);
    }, 300),
    [data, filterConfig, onFilterChange]
  );

  // Re-apply filters when activeFilters or data changes
  useEffect(() => {
    applyFilters(activeFilters);
  }, [activeFilters, data]); 

  const handleInputChange = (field: string, value: any, type: FilterType) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      
      if (type === 'numberRange' || type === 'dateRange') {
        newFilters[field] = { ...(newFilters[field] || {}), ...value };
      } else {
        newFilters[field] = value;
      }

      // Cleanup empty values
      if (value === '' || value === null || (type === 'select' && value === 'All') || (type === 'boolean' && value === 'All')) {
         delete newFilters[field];
      }
      
      // Cleanup empty ranges
      if (type === 'numberRange') {
          const min = newFilters[field]?.min;
          const max = newFilters[field]?.max;
          if ((min === '' || min == null) && (max === '' || max == null)) {
              delete newFilters[field];
          }
      }
      if (type === 'dateRange') {
          const start = newFilters[field]?.start;
          const end = newFilters[field]?.end;
          if (!start && !end) {
              delete newFilters[field];
          }
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
                        value={activeFilters[field]?.min ?? ''}
                        onChange={(e) => handleInputChange(field, { min: e.target.value ? parseFloat(e.target.value) : '' }, type)}
                        className={`${commonClasses} w-1/2`}
                    />
                    <input
                        type="number"
                        placeholder="Max"
                        value={activeFilters[field]?.max ?? ''}
                        onChange={(e) => handleInputChange(field, { max: e.target.value ? parseFloat(e.target.value) : '' }, type)}
                        className={`${commonClasses} w-1/2`}
                    />
                </div>
            );
        case 'dateRange':
             const startVal = activeFilters[field]?.start instanceof Date ? activeFilters[field].start.toISOString().split('T')[0] : '';
             const endVal = activeFilters[field]?.end instanceof Date ? activeFilters[field].end.toISOString().split('T')[0] : '';
             
             return (
                 <div className="flex space-x-2 items-center">
                     <input
                         type="date"
                         value={startVal}
                         onChange={(e) => handleInputChange(field, { start: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }, type)}
                         className={`${commonClasses} w-1/2`}
                     />
                     <span className="text-gray-500">to</span>
                     <input
                         type="date"
                         value={endVal}
                         onChange={(e) => handleInputChange(field, { end: e.target.value ? new Date(e.target.value + 'T23:59:59') : null }, type)}
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
    <div className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm mb-4 ${!isOpen ? 'border-b-0' : ''}`}>
        <div
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-100 rounded-t-lg"
            onClick={() => setIsOpen(!isOpen)}
        >
            <h3 className="text-md font-semibold text-gray-700">Advanced Filters</h3>
            <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
            >
                {isOpen ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </button>
        </div>

        {isOpen && (
            <div className="p-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filterConfig.map(config => (
                  <div key={config.field}>
                    <label className="block text-sm font-medium text-gray-700">{config.label}</label>
                    {renderFilterInput(config)}
                  </div>
                ))}
              </div>
              <div className="mt-4 text-right">
                  <button
                      onClick={() => setActiveFilters({})}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
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