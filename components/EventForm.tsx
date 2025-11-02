import React, { useState, useEffect, useMemo } from 'react';
import { Event, isValidTime, FirebaseTimestamp, Contact } from '../types'; // Import Contact and FirebaseTimestamp

// --- Helper Function ---
const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString(); // e.g., "11/1/2025, 7:30:00 PM"
    } catch (error) {
        console.error("Error formatting timestamp:", error);
        return 'N/A';
    }
};

interface EventFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<Event, 'id'> | Event) => void;
    eventToEdit?: Event | null;
    contacts: Contact[]; // To populate attendee list
    onAddAttendee: (eventId: string, contactId: string) => void;
    onRemoveAttendee: (eventId: string, contactId: string) => void;
}

const EventForm: React.FC<EventFormProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    eventToEdit, 
    contacts, 
    onAddAttendee, 
    onRemoveAttendee 
}) => {
    
    const getInitialState = () => {
        let date = new Date();
        let time = date.toTimeString().substring(0, 5); // "HH:MM"
        
        if (eventToEdit && eventToEdit.date) {
            const eventDate = eventToEdit.date.toDate ? eventToEdit.date.toDate() : new Date(eventToEdit.date);
            date = eventDate;
            time = eventToEdit.time || eventDate.toTimeString().substring(0, 5);
        }

        const dateString = date.toISOString().split('T')[0]; // "YYYY-MM-DD"

        return {
            name: eventToEdit?.name || '',
            author: eventToEdit?.author || '',
            date: dateString, 
            time: time,
            location: eventToEdit?.location || '',
            description: eventToEdit?.description || '',
            attendeeIds: eventToEdit?.attendeeIds || [],
        };
    };

    const [formState, setFormState] = useState(getInitialState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [attendeeSearch, setAttendeeSearch] = useState('');
    const [selectedContactToAdd, setSelectedContactToAdd] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormState(getInitialState());
            setErrors({});
            setAttendeeSearch('');
            setSelectedContactToAdd('');
        }
    }, [isOpen, eventToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formState.name) newErrors.name = 'Event name is required.';
        if (!formState.date) newErrors.date = 'Date is required.';
        if (formState.time && !isValidTime(formState.time)) newErrors.time = 'Time must be in HH:MM format (e.g., 14:30).';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            const [year, month, day] = formState.date.split('-').map(Number);
            const [hours, minutes] = formState.time ? formState.time.split(':').map(Number) : [0, 0];
            const combinedDate = new Date(year, month - 1, day, hours || 0, minutes || 0);

            const dataToSave = {
                ...formState,
                date: combinedDate,
            };

            onSave(eventToEdit ? { ...dataToSave, id: eventToEdit.id } as Event : dataToSave as Omit<Event, 'id'>);
            onClose();
        }
    };

    // --- Attendee Management ---
    const availableContacts = useMemo(() => {
        const search = attendeeSearch.toLowerCase();

        // --- FIX #1: Add safety checks for contacts array and contact properties ---
        return (contacts || []).filter(c => {
            // Safety check for bad data or missing fields
            if (!c || !c.id || !c.firstName || !c.lastName) {
                return false; 
            }

            const isAttendee = formState.attendeeIds.includes(c.id);
            if (isAttendee) {
                return false; // Don't show contacts who are already attendees
            }

            // If search is empty, show all non-attendees
            if (!search) {
                return true; 
            }

            // Show if search matches first or last name
            return (
                c.firstName.toLowerCase().includes(search) || 
                c.lastName.toLowerCase().includes(search)
            );
        });
    }, [contacts, formState.attendeeIds, attendeeSearch]);

    const currentAttendees = useMemo(() => {
        // --- FIX #2: Add guard (|| []) to prevent crash if contacts is undefined ---
        return (contacts || []).filter(c => formState.attendeeIds.includes(c.id));
    }, [contacts, formState.attendeeIds]);

    const handleAddAttendee = () => {
        if (!eventToEdit || !selectedContactToAdd) return;
        onAddAttendee(eventToEdit.id, selectedContactToAdd);
        setFormState(prev => ({
            ...prev,
            attendeeIds: [...prev.attendeeIds, selectedContactToAdd]
        }));
        setSelectedContactToAdd('');
    };

    const handleRemoveAttendee = (contactId: string) => {
        if (!eventToEdit) return;
        onRemoveAttendee(eventToEdit.id, contactId);
        setFormState(prev => ({
            ...prev,
            attendeeIds: prev.attendeeIds.filter(id => id !== contactId)
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex-shrink-0">{eventToEdit ? 'Edit Event' : 'New Event'}</h2>
                
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Event Name <span className="text-red-500">*</span></label>
                            <input type="text" id="name" name="name" value={formState.name} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md`} />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>
                        
                        <div>
                            <label htmlFor="author" className="block text-sm font-medium text-gray-700">Author / Featured</label>
                            <input type="text" id="author" name="author" value={formState.author} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
                                <input type="date" id="date" name="date" value={formState.date} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.date ? 'border-red-500' : 'border-gray-300'} rounded-md`} />
                                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                            </div>
                            <div>
                                <label htmlFor="time" className="block text-sm font-medium text-gray-700">Time (HH:MM)</label>
                                <input type="time" id="time" name="time" value={formState.time} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.time ? 'border-red-500' : 'border-gray-300'} rounded-md`} />
                                {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                            <input type="text" id="location" name="location" value={formState.location} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" name="description" value={formState.description} onChange={handleChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>

                        {eventToEdit && (
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900">Attendees ({currentAttendees.length})</h3>
                                
                                <div className="flex items-center space-x-2">
                                    {/* --- ADDED A SEARCH INPUT FOR BETTER UX --- */}
                                    <input 
                                        type="text" 
                                        placeholder="Search contacts..."
                                        value={attendeeSearch}
                                        onChange={(e) => setAttendeeSearch(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm sm:text-sm"
                                    />
                                    <select 
                                        value={selectedContactToAdd} 
                                        onChange={(e) => setSelectedContactToAdd(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    >
                                        <option value="">Select a contact to add...</option>
                                        {availableContacts.map(c => (
                                            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button" 
                                        onClick={handleAddAttendee} 
                                        disabled={!selectedContactToAdd}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
                                    >
                                        Add
                                    </button>
                                </div>
                                
                                <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                                    {currentAttendees.length > 0 ? (
                                        currentAttendees.map(attendee => (
                                            <div key={attendee.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                                <span className="text-sm text-gray-700">{attendee.firstName} {attendee.lastName}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveAttendee(attendee.id)}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="p-3 text-sm text-gray-500 italic">No attendees added yet.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {eventToEdit && (
                            <div className="pt-4 border-t border-gray-200">
                                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</h3>
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                                    <p><strong>Created By:</strong> {eventToEdit.createdBy || 'Unknown'}</p>
                                    <p><strong>Created At:</strong> {formatTimestamp(eventToEdit.createdAt)}</p>
                                    <p><strong>Last Editor:</strong> {eventToEdit.lastModifiedBy || 'Unknown'}</p>
                                    <p><strong>Last Modified:</strong> {formatTimestamp(eventToEdit.lastModifiedAt)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t flex-shrink-0">
                        <div className="flex justify-end space-x-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Event</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventForm;