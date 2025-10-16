import React, { useState, useMemo, Fragment } from 'react';
import { Event, Contact } from '../types';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';

interface EventTableProps {
    events: Event[];
    contacts: Contact[];
    onEdit: (event: Event) => void;
    onDelete: (id: string) => void;
    onUpdateAttendees: (eventId: string, contactId: string, isAttending: boolean) => void;
    isAdmin: boolean;
    onUpdateEvent: (event: Event) => void;
}

const ITEMS_PER_PAGE = 5; // Using 5 since event rows can be taller

const EventTable: React.FC<EventTableProps> = ({ events, contacts, onEdit, onDelete, onUpdateAttendees, isAdmin, onUpdateEvent }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);

    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => b.date.seconds - a.date.seconds);
    }, [events]);

    const totalPages = Math.ceil(sortedEvents.length / ITEMS_PER_PAGE);

    const paginatedEvents = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, sortedEvents]);

    const eventsWithAttendeeDetails = useMemo(() => {
        return paginatedEvents.map(event => ({
            ...event,
            attendees: (event.attendeeIds || []).map(id => contacts.find(c => c.id === id)).filter(Boolean) as Contact[]
        }));
    }, [paginatedEvents, contacts]);
    
    const handleToggleExpand = (eventId: string) => {
        setExpandedEventId(prevId => (prevId === eventId ? null : eventId));
    };

    const handleFieldUpdate = (event: Event, field: keyof Event, value: string) => {
        if (isAdmin) {
            const updatedEvent = { ...event, [field]: value };
            onUpdateEvent(updatedEvent);
        }
    };

    const handleCellClick = (id: string, field: string, currentValue: string) => {
        if (isAdmin) {
            setEditingCell({ id, field, value: currentValue });
        }
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingCell) {
            setEditingCell({ ...editingCell, value: e.target.value });
        }
    };

    const handleDateBlur = (event: Event) => {
        if (!editingCell || editingCell.field !== 'date' || !isAdmin) return;

        const newDateString = editingCell.value;
        const dateObj = new Date(newDateString);

        // 1. Validate the date before sending it to Firestore
        if (!newDateString || isNaN(dateObj.getTime())) {
             console.error(`Invalid date entry for event ${event.id}: ${newDateString}. Resetting field.`);
             setEditingCell(null);
             return;
        }

        // 2. Commit the change to the database
        const updatedEvent = { 
            ...event, 
            date: dateObj // Send the valid Date object
        };
        onUpdateEvent(updatedEvent);

        // 3. Clear the editing state
        setEditingCell(null);
    };

    return (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendees</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {eventsWithAttendeeDetails.map((event) => (
                            <Fragment key={event.id}>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(event, 'name', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{event.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isAdmin && editingCell?.id === event.id && editingCell.field === 'date' ? (
                                            <input 
                                                type="date" 
                                                value={editingCell.value}
                                                onChange={handleLocalChange}
                                                onBlur={() => handleDateBlur(event)} // Trigger update on blur
                                                // Allows the input to immediately receive focus for typing
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleDateBlur(event);
                                                }}
                                                className="border-gray-300 rounded-md shadow-sm w-36"
                                            />
                                        ) : (
                                            <span 
                                                className={isAdmin ? "cursor-pointer hover:bg-gray-200 p-1 rounded transition-colors" : ""}
                                                onClick={() => {
                                                    // Convert Firestore Timestamp to YYYY-MM-DD string
                                                    const dateValue = event.date?.toDate().toISOString().split('T')[0] || '';
                                                    handleCellClick(event.id, 'date', dateValue);
                                                }}
                                            >
                                                {event.date?.toDate().toLocaleDateString()}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.attendeeIds?.length || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button 
                                                onClick={() => handleToggleExpand(event.id)}
                                                className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded hover:bg-indigo-200"
                                            >
                                                {expandedEventId === event.id ? 'Hide' : 'View'}
                                            </button>
                                            <button onClick={() => onEdit(event)} className="text-indigo-600 hover:text-indigo-900"><EditIcon className="h-5 w-5"/></button>
                                            <button onClick={() => onDelete(event.id)} className="text-red-600 hover:text-red-900"><DeleteIcon className="h-5 w-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                                {expandedEventId === event.id && (
                                    <tr>
                                        <td colSpan={4} className="p-4 bg-gray-50">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-3 text-sm text-gray-600">
                                                    <p><strong className="font-medium text-gray-800">Time:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(event, 'time', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{event.time || '-'}</span></p>
                                                    <p><strong className="font-medium text-gray-800">Location:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(event, 'location', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{event.location || '-'}</span></p>
                                                    <p><strong className="font-medium text-gray-800">Author:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(event, 'author', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{event.author || '-'}</span></p>
                                                    <p><strong className="font-medium text-gray-800">Description:</strong> <span contentEditable={isAdmin} onBlur={(e) => handleFieldUpdate(event, 'description', e.currentTarget.textContent || '')} suppressContentEditableWarning={true}>{event.description || '-'}</span></p>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto">
                                                    <h4 className="text-md font-semibold mb-2">Manage Attendees</h4>
                                                    {contacts.map(contact => (
                                                        <div key={contact.id} className="flex items-center justify-between p-2 border-b">
                                                            <span>{contact.firstName} {contact.lastName}</span>
                                                            <input
                                                                type="checkbox"
                                                                checked={event.attendeeIds?.includes(contact.id) || false}
                                                                onChange={(e) => onUpdateAttendees(event.id, contact.id, e.target.checked)}
                                                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
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
                            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, events.length)}</span> of <span className="font-medium">{events.length}</span> results
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

export default EventTable;