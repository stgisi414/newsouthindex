import React, { useState, useEffect, useRef } from 'react';
import { Contact, Category, isValidEmail, isValidPhone, isValidUrl, isValidZip, isValidState } from '../types';
import ClipboardIcon from './icons/ClipboardIcon';

// Define the structure for the fetched Place object
interface FetchedPlace {
    addressComponents?: google.maps.places.PlaceAddressComponent[];
    formattedAddress?: string;
}

// Extend JSX to recognize the Google web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        value: string;
        "country-codes": string;
        "place-fields": string;
        place?: google.maps.places.Place | null;
      }, HTMLElement>;
    }
  }
}

// API Loader Function (no changes)
const loadGoogleMapsScript = () => {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
  const scriptId = 'google-maps-script';
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(scriptId) || (window.google?.maps?.places)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (error) => {
        console.error('Google Maps script failed to load.', error);
        reject(new Error('Google Maps script failed to load.'));
    };
    document.head.appendChild(script);
  });
};

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

// --- FIX: Added capitalize helper function ---
const capitalize = (s: string) => {
    if (!s) return s;
    // Capitalizes the first letter of each word
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Omit<Contact, 'id'> | Contact) => void;
    contactToEdit?: Contact | null;
}

const ContactForm: React.FC<ContactFormProps> = ({ isOpen, onClose, onSave, contactToEdit }) => {
    // --- State Hooks ---
    const initialFormState = {
        honorific: '', firstName: '', middleName: '', lastName: '', suffix: '',
        category: [] as Category[],
        phone: '', email: '', url: '',
        address1: '', address2: '', city: '', state: '', zip: '', notes: '',
        otherCategory: '', // Added for 'Other' category
        sendTNSBNewsletter: false,
    };
    const [formState, setFormState] = useState<Omit<Contact, 'id' | 'createdAt' | 'createdBy' | 'lastModifiedAt' | 'lastModifiedBy'>>(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const autocompleteRef = useRef<HTMLElement & { value: string, place?: google.maps.places.Place | null } | null>(null);
    const [mapsApiLoaded, setMapsApiLoaded] = useState(false);
    const [placeDetails, setPlaceDetails] = useState<FetchedPlace | null>(null);


    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            loadGoogleMapsScript().then(() => setMapsApiLoaded(true)).catch(console.error);
        } else {
             setMapsApiLoaded(false);
             setPlaceDetails(null);
        }
    }, [isOpen]);

     useEffect(() => {
        if (!isOpen) return;
        setErrors({});

        let initialState: any = contactToEdit 
            ? { ...initialFormState, ...contactToEdit } 
            : initialFormState;

        // Handle Category conversion for old data
        if (contactToEdit) {
            if (typeof contactToEdit.category === 'string') {
                initialState.category = [contactToEdit.category as Category];
            } else if (Array.isArray(contactToEdit.category)) {
                initialState.category = contactToEdit.category;
            } else {
                initialState.category = [];
            }
        }

        // Handle mapping if 'middleInitial' still exists on old data
        if (contactToEdit && (contactToEdit as any).middleInitial && !contactToEdit.middleName) {
            initialState.middleName = (contactToEdit as any).middleInitial;
        }

        setFormState(initialState);
        setPlaceDetails(null); // Reset details on open

        if (autocompleteRef.current) {
             autocompleteRef.current.value = '';
        }
    }, [isOpen, contactToEdit]);


    // Google Maps Autocomplete listener
    useEffect(() => {
        if (!isOpen || !mapsApiLoaded || !autocompleteRef.current) {
            return;
        }

        const autocompleteElement = autocompleteRef.current;
        console.log('Attaching gmp-select listener...');

        const handlePlaceSelect = async (event: any) => {
            const { placePrediction } = event;
             if (!placePrediction) {
                 setPlaceDetails(null);
                 return;
             }
             try {
                const place = placePrediction.toPlace();
                await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
                 if (place.addressComponents) {
                     setPlaceDetails(place as FetchedPlace);
                 } else {
                     setPlaceDetails(null);
                 }
             } catch (error) {
                 console.error("Error fetching place details:", error);
                 setPlaceDetails(null);
             }
        };

        autocompleteElement.addEventListener('gmp-select', handlePlaceSelect);

        return () => {
             if (autocompleteElement) {
                autocompleteElement.removeEventListener('gmp-select', handlePlaceSelect);
            }
        };
    }, [isOpen, mapsApiLoaded]);


    // --- Event Handlers ---
    const handleFillAddress = () => {
        if (placeDetails?.addressComponents) {
            const getAddressComponent = (type: string, useShortName = false): string => {
                const component = placeDetails.addressComponents?.find((c) => c.types.includes(type));
                return component ? (useShortName ? component.shortText : component.longText) : "";
            };

            const street_number = getAddressComponent('street_number');
            const route = getAddressComponent('route');

            setFormState(prev => ({
                ...prev,
                address1: `${street_number} ${route}`.trim(),
                city: getAddressComponent('locality') || getAddressComponent('postal_town'),
                state: getAddressComponent('administrative_area_level_1', true),
                zip: getAddressComponent('postal_code'),
            }));
        }
    };

    // --- FIX: Updated handleChange to include capitalization ---
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let finalValue = value;
        // Apply capitalization logic to specific fields
        if (name === 'firstName' || name === 'lastName' || name === 'city') {
            finalValue = capitalize(value);
        }
        
        setFormState(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormState(prev => ({ ...prev, [name]: checked }));
    };
    
    // Handler for category checkboxes
    const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const category = value as Category;

        setFormState(prev => {
            const currentCategories = prev.category || [];
            if (checked) {
                if (!currentCategories.includes(category)) {
                    return { ...prev, category: [...currentCategories, category] };
                }
            } else {
                return { ...prev, category: currentCategories.filter(cat => cat !== category) };
            }
            return prev;
        });
    };
    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        
        if (!formState.firstName) newErrors.firstName = 'First name is required.';
        if (!formState.lastName) newErrors.lastName = 'Last name is required.';
        if (!formState.email) newErrors.email = 'Email is required.';
        
        if (formState.email && !isValidEmail(formState.email)) newErrors.email = 'Email is invalid.';
        if (formState.phone && !isValidPhone(formState.phone)) newErrors.phone = 'Phone format is invalid (use only digits, at least 7).';
        if (formState.url && !isValidUrl(formState.url)) newErrors.url = 'URL is invalid.';
        if (formState.zip && !isValidZip(formState.zip)) newErrors.zip = 'Zip code must be 5 or 5-4 digits.';
        if (formState.state && !isValidState(formState.state)) newErrors.state = 'State must be a 2-letter abbreviation.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    // --- FIX: Corrected handleSubmit logic for 'otherCategory' ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            // This line defines cleanedState
            const cleanedState = Object.fromEntries(
                Object.entries(formState).filter(([, value]) => value !== '' && value !== null)
            );

            // Ensure category is an array, even if empty
            let finalState: Omit<Contact, 'id' | 'createdAt' | 'createdBy' | 'lastModifiedAt' | 'lastModifiedBy'> | Contact = {
                ...cleanedState, // This line was causing the error
                category: formState.category || [],
            };
            
            // Conditionally add otherCategory ONLY if 'Other' is selected
            if (formState.category.includes(Category.OTHER)) {
                finalState.otherCategory = formState.otherCategory || ''; // Use empty string if "Other" is checked but field is blank
            } else {
                // Explicitly delete otherCategory if 'Other' is NOT selected
                // This prevents 'undefined' from being sent to Firestore
                delete (finalState as Partial<Contact>).otherCategory; 
            }
            
            onSave(contactToEdit ? { ...finalState, id: contactToEdit.id } as Contact : finalState as Omit<Contact, 'id'>);
            onClose();
        }
    };

    // --- Render Logic ---
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-3xl w-full max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex-shrink-0">{contactToEdit ? 'Edit Contact' : 'New Contact'}</h2>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Name Fields */}
                        <div className="md:col-span-1">
                            <label htmlFor="honorific" className="block text-sm font-medium text-gray-700">Honorific</label>
                            <select
                                id="honorific"
                                name="honorific"
                                value={formState.honorific || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="">-- Select --</option>
                                <option value="Mr.">Mr.</option>
                                <option value="Mrs.">Mrs.</option>
                                <option value="Miss">Miss</option>
                                <option value="Ms.">Ms.</option>
                                <option value="Dr.">Dr.</option>
                                <option value="Rev.">Rev.</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
                            <input type="text" id="firstName" name="firstName" value={formState.firstName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="middleName" className="block text-sm font-medium text-gray-700">Middle</label>
                            <input type="text" id="middleName" name="middleName" value={formState.middleName || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                            <input type="text" id="lastName" name="lastName" value={formState.lastName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="suffix" className="block text-sm font-medium text-gray-700">Suffix</label>
                            <input type="text" id="suffix" name="suffix" value={formState.suffix || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>

                        {/* Contact Fields */}
                        <div className="md:col-span-2">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                            <input type="tel" id="phone" name="phone" value={formState.phone || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                            <input type="email" id="email" name="email" value={formState.email} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>
                        
                        {/* Address Search Section */}
                        <div className="md:col-span-4">
                            <label className="block text-sm font-medium text-gray-700">Address Search</label>
                            <div className="flex items-center gap-2 mt-1">
                                {mapsApiLoaded ? (
                                    <gmp-place-autocomplete
                                        ref={autocompleteRef}
                                        placeholder="Start typing an address..."
                                        country-codes='["us"]'
                                        place-fields="addressComponents,formattedAddress"
                                        className="flex-grow border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                    ></gmp-place-autocomplete>
                                 ) : (
                                    <div className="flex-grow p-2 text-sm text-gray-500 italic">Loading maps...</div>
                                 )}
                                <button
                                    type="button"
                                    onClick={handleFillAddress}
                                    disabled={!placeDetails}
                                    className={`p-2 rounded-md transition-opacity ${
                                        placeDetails
                                            ? 'text-indigo-600 hover:bg-indigo-100'
                                            : 'text-gray-400 cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <ClipboardIcon className="h-6 w-6" />
                                    <span className="sr-only">Fill Address</span>
                                </button>
                            </div>
                        </div>

                        {/* Individual Address fields */}
                        <div className="md:col-span-4">
                            <label htmlFor="address1" className="block text-sm font-medium text-gray-700">Address 1</label>
                            <input type="text" id="address1" name="address1" value={formState.address1 || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-4">
                            <label htmlFor="address2" className="block text-sm font-medium text-gray-700">Address 2</label>
                            <input type="text" id="address2" name="address2" value={formState.address2 || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                            <input type="text" id="city" name="city" value={formState.city || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
                            <input type="text" id="state" name="state" value={formState.state || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.state ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm uppercase`} maxLength={2} />
                            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="zip" className="block text-sm font-medium text-gray-700">Zip</label>
                            <input type="text" id="zip" name="zip" value={formState.zip || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.zip ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} maxLength={10} />
                            {errors.zip && <p className="text-red-500 text-xs mt-1">{errors.zip}</p>}
                        </div>

                        {/* Category Checkboxes */}
                         <div className="md:col-span-4">
                             <label className="block text-sm font-medium text-gray-700">Category</label>
                             <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                {/* Sorted Category List */}
                                {[
                                    Category.CUSTOMER,
                                    Category.MEDIA,
                                    Category.STAFF,
                                    Category.VENDOR,
                                    Category.OTHER
                                ].map(cat => (
                                    <div key={cat} className="flex items-center">
                                        <input
                                            id={`category-${cat}`}
                                            name="category"
                                            type="checkbox"
                                            value={cat}
                                            checked={(formState.category || []).includes(cat)}
                                            onChange={handleCategoryChange}
                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <label htmlFor={`category-${cat}`} className="ml-3 block text-sm text-gray-900">
                                            {cat}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Other Category Textbox */}
                        {formState.category.includes(Category.OTHER) && (
                            <div className="md:col-span-4">
                                <label htmlFor="otherCategory" className="block text-sm font-medium text-gray-700">Other Category (Please specify)</label>
                                <input
                                    type="text"
                                    id="otherCategory"
                                    name="otherCategory"
                                    value={(formState as any).otherCategory || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        )}

                        {/* Newsletter Toggle */}
                        <div className="md:col-span-4">
                            <div className="flex items-center">
                                <input
                                    id="sendTNSBNewsletter"
                                    name="sendTNSBNewsletter"
                                    type="checkbox"
                                    checked={!!formState.sendTNSBNewsletter}
                                    onChange={handleCheckboxChange}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="sendTNSBNewsletter" className="ml-3 block text-sm font-medium text-gray-700">
                                    Send TNSB Newsletter
                                </label>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="md:col-span-4">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={formState.notes || ''}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Metadata */}
                    {contactToEdit && (
                        <div className="md:col-span-4 mt-6 pt-4 border-t border-gray-200">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</h3>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                                <p><strong>Contact ID:</strong> {contactToEdit.id}</p>
                                <p><strong>Created By:</strong> {contactToEdit.createdBy || 'Unknown'}</p>
                                <p><strong>Created At:</strong> {formatTimestamp(contactToEdit.createdAt)}</p>
                                <p><strong>Last Editor:</strong> {contactToEdit.lastModifiedBy || 'Unknown'}</p>
                                <p><strong>Last Modified:</strong> {formatTimestamp(contactToEdit.lastModifiedAt)}</p>
                            </div>
                        </div>
                    )}

                    {/* Form Buttons */}
                    <div className="mt-8 flex justify-end space-x-4 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Save Contact
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactForm;