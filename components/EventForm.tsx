import React, { useState, useEffect } from 'react';
import { Event } from '../types';

interface EventFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<Event, 'id'> | Event) => void;
    eventToEdit?: Event | null;
}

const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
    const initialFormState = {
        name: '',
        date: new Date().toISOString().split('T')[0], // Defaults to today
        description: '',
        author: '',
    };

    const [formState, setFormState] = useState<Omit<Event, 'id'>>(initialFormState);

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                // Convert Firestore Timestamp to a date string for the input
                const eventDate = eventToEdit.date?.toDate ? eventToEdit.date.toDate() : new Date();
                setFormState({
                    ...eventToEdit,
                    date: eventDate.toISOString().split('T')[0],
                });
            } else {
                setFormState(initialFormState);
            }
        }
    }, [eventToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            ...formState,
            date: new Date(formState.date), // Convert string back to Date object for Firestore
        };
        onSave(eventToEdit ? { ...dataToSave, id: eventToEdit.id } : dataToSave);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-lg w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{eventToEdit ? 'Edit Event' : 'New Event'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Event Name</label>
                        <input type="text" id="name" name="name" value={formState.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                        <input type="date" id="date" name="date" value={formState.date} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label htmlFor="author" className="block text-sm font-medium text-gray-700">Featured Author (Optional)</label>
                        <input type="text" id="author" name="author" value={formState.author} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea id="description" name="description" value={formState.description} onChange={handleChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Event</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventForm;