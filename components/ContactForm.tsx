import React, { useState, useEffect, useRef } from 'react';
import { Contact, Category, isValidEmail, isValidPhone, isValidUrl, PhoneEntry, EmailEntry, AddressEntry, SocialMediaEntry } from '../types';
import ClipboardIcon from './icons/ClipboardIcon';
// REMOVED: import { formatPhoneNumber } from '../src/utils/formatting'; 
import { AsYouType, CountryCode } from 'libphonenumber-js';

export const COUNTRY_CODES = [
    // Top Priority
    { code: '+1', iso: 'US', label: 'US/CA (+1)' },
    { code: '+44', iso: 'GB', label: 'UK (+44)' },
    { code: '+61', iso: 'AU', label: 'AU (+61)' },
    { code: '+49', iso: 'DE', label: 'DE (+49)' },
    { code: '+33', iso: 'FR', label: 'FR (+33)' },
    { code: '+81', iso: 'JP', label: 'JP (+81)' },
    { code: '+86', iso: 'CN', label: 'CN (+86)' },
    { code: '+91', iso: 'IN', label: 'IN (+91)' },
    { code: '+52', iso: 'MX', label: 'MX (+52)' },

    // Major Global Economies & Populous Nations
    { code: '+971', iso: 'AE', label: 'AE (+971)' },
    { code: '+54', iso: 'AR', label: 'AR (+54)' },
    { code: '+43', iso: 'AT', label: 'AT (+43)' },
    { code: '+880', iso: 'BD', label: 'BD (+880)' },
    { code: '+32', iso: 'BE', label: 'BE (+32)' },
    { code: '+55', iso: 'BR', label: 'BR (+55)' },
    { code: '+41', iso: 'CH', label: 'CH (+41)' },
    { code: '+56', iso: 'CL', label: 'CL (+56)' },
    { code: '+57', iso: 'CO', label: 'CO (+57)' },
    { code: '+420', iso: 'CZ', label: 'CZ (+420)' },
    { code: '+45', iso: 'DK', label: 'DK (+45)' },
    { code: '+20', iso: 'EG', label: 'EG (+20)' },
    { code: '+34', iso: 'ES', label: 'ES (+34)' },
    { code: '+358', iso: 'FI', label: 'FI (+358)' },
    { code: '+30', iso: 'GR', label: 'GR (+30)' },
    { code: '+852', iso: 'HK', label: 'HK (+852)' },
    { code: '+36', iso: 'HU', label: 'HU (+36)' },
    { code: '+62', iso: 'ID', label: 'ID (+62)' },
    { code: '+353', iso: 'IE', label: 'IE (+353)' },
    { code: '+972', iso: 'IL', label: 'IL (+972)' },
    { code: '+39', iso: 'IT', label: 'IT (+39)' },
    { code: '+254', iso: 'KE', label: 'KE (+254)' },
    { code: '+82', iso: 'KR', label: 'KR (+82)' },
    { code: '+60', iso: 'MY', label: 'MY (+60)' },
    { code: '+234', iso: 'NG', label: 'NG (+234)' },
    { code: '+31', iso: 'NL', label: 'NL (+31)' },
    { code: '+47', iso: 'NO', label: 'NO (+47)' },
    { code: '+64', iso: 'NZ', label: 'NZ (+64)' },
    { code: '+51', iso: 'PE', label: 'PE (+51)' },
    { code: '+63', iso: 'PH', label: 'PH (+63)' },
    { code: '+92', iso: 'PK', label: 'PK (+92)' },
    { code: '+48', iso: 'PL', label: 'PL (+48)' },
    { code: '+351', iso: 'PT', label: 'PT (+351)' },
    { code: '+7', iso: 'RU', label: 'RU/KZ (+7)' },
    { code: '+966', iso: 'SA', label: 'SA (+966)' },
    { code: '+46', iso: 'SE', label: 'SE (+46)' },
    { code: '+65', iso: 'SG', label: 'SG (+65)' },
    { code: '+66', iso: 'TH', label: 'TH (+66)' },
    { code: '+90', iso: 'TR', label: 'TR (+90)' },
    { code: '+886', iso: 'TW', label: 'TW (+886)' },
    { code: '+380', iso: 'UA', label: 'UA (+380)' },
    { code: '+84', iso: 'VN', label: 'VN (+84)' },
    { code: '+27', iso: 'ZA', label: 'ZA (+27)' },
] as const;

// Phone Formatter
export const formatPhoneNumber = (value: string | undefined, callingCode: string = '+1') => {
    if (!value) return '';
    
    // 1. Find the ISO code (e.g., 'US') based on the calling code (e.g., '+1')
    // Default to US if code not found
    const match = COUNTRY_CODES.find(c => c.code === callingCode);
    const iso = (match ? match.iso : 'US') as CountryCode;
    
    // 2. Use libphonenumber-js to format
    return new AsYouType(iso).input(value);
};

// Keep your existing helpers if they were there, or just ensuring this file is clean
export const capitalize = (s: string) => {
    if (!s) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

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
        value?: string;
        "country-codes"?: string;
        "place-fields"?: string;
        place?: google.maps.places.Place | null;
      }, HTMLElement>;
    }
  }
}

// API Loader Function
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
        return date.toLocaleString();
    } catch (error) {
        console.error("Error formatting timestamp:", error);
        return 'N/A';
    }
};

interface ContactFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Omit<Contact, 'id'> | Contact) => void;
    contactToEdit?: Contact | null;
}

const ContactForm: React.FC<ContactFormProps> = ({ isOpen, onClose, onSave, contactToEdit }) => {
    // --- Initial State ---
    const initialFormState = {
        honorific: '', firstName: '', middleName: '', lastName: '', suffix: '',
        category: [] as Category[],
        phones: [] as PhoneEntry[],
        emails: [] as EmailEntry[],
        addresses: [] as AddressEntry[],
        company: '', jobTitle: '', website: '', 
        socialMedia: [] as SocialMediaEntry[],
        notes: '',
        otherCategory: '',
        sendTNSBNewsletter: false,
        isActive: true,
    };

    const [formState, setFormState] = useState<any>(initialFormState);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const autocompleteRef = useRef<HTMLElement & { value: string, place?: google.maps.places.Place | null } | null>(null);
    const [mapsApiLoaded, setMapsApiLoaded] = useState(false);
    const [placeDetails, setPlaceDetails] = useState<FetchedPlace | null>(null);
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+1');

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Combine code and input to let the library detect the format
      // Then slice off the code to display just the formatted number in the input
      const formatted = new AsYouType().input(`${countryCode}${input}`);
      
      // This extracts the formatted number without the country code prefix
      // Note: You might need to adjust this depending on if you want the user 
      // to see the +1 in the input box or just next to it.
      // A simpler way if you separate inputs:
      
      // Option A: If input is JUST the local number
      // It's hard to format strictly without the ISO code (e.g., 'US'), 
      // but this helper cleans non-numeric chars:
      const cleanNumber = input.replace(/[^0-9]/g, '');
      setPhone(cleanNumber);
    };

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

        // --- MIGRATION LOGIC ON LOAD ---
        // Update Phone Migration
        if (contactToEdit) {
             if (!contactToEdit.phones && (contactToEdit as any).phone) {
                initialState.phones = [{ type: 'Main', countryCode: '+1', number: (contactToEdit as any).phone }];
            }
        }

        // Ensure at least one empty slot with default country code
        if (!initialState.phones || initialState.phones.length === 0) {
            initialState.phones = [{ type: 'Mobile', countryCode: '+1', number: '' }];
        }

        // Apply formatting to all loaded numbers
        if (initialState.phones) {
            initialState.phones = initialState.phones.map((p: PhoneEntry) => ({
                ...p,
                countryCode: p.countryCode || '+1', // Default to +1
                number: formatPhoneNumber(p.number, p.countryCode || '+1')
            }));
        }   

        setFormState(initialState);
        setPlaceDetails(null);

        if (autocompleteRef.current) {
             autocompleteRef.current.value = '';
        }
    }, [isOpen, contactToEdit]);

    // Google Maps Autocomplete listener
    useEffect(() => {
        if (!isOpen || !mapsApiLoaded || !autocompleteRef.current) return;

        const autocompleteElement = autocompleteRef.current;
        const handlePlaceSelect = async (event: any) => {
            const { placePrediction } = event;
             if (!placePrediction) {
                 setPlaceDetails(null);
                 return;
             }
             try {
                const place = placePrediction.toPlace();
                await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
                setPlaceDetails(place as FetchedPlace);
             } catch (error) {
                 console.error("Error fetching place details:", error);
                 setPlaceDetails(null);
             }  
        };

        autocompleteElement.addEventListener('gmp-select', handlePlaceSelect);
        return () => {
             if (autocompleteElement) autocompleteElement.removeEventListener('gmp-select', handlePlaceSelect);
        };
    }, [isOpen, mapsApiLoaded]);


    // --- Handlers ---

    // Updated: Adds a NEW address card based on the search result
    const handleFillAddress = () => {
        if (placeDetails?.addressComponents) {
            const getAddressComponent = (type: string, useShortName = false): string => {
                const component = placeDetails.addressComponents?.find((c) => c.types.includes(type));
                return component ? (useShortName ? component.shortText : component.longText) : "";
            };

            const street_number = getAddressComponent('street_number');
            const route = getAddressComponent('route');

            const newAddress: AddressEntry = {
                type: 'Main',
                address1: `${street_number} ${route}`.trim(),
                address2: '',
                city: getAddressComponent('locality') || getAddressComponent('postal_town'),
                state: getAddressComponent('administrative_area_level_1', true),
                zip: getAddressComponent('postal_code'),
            };

            setFormState((prev: any) => ({
                ...prev,
                addresses: [...(prev.addresses || []), newAddress]
            }));
            
            // Reset search
            setPlaceDetails(null);
            if (autocompleteRef.current) autocompleteRef.current.value = '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let finalValue = value;
        if (['firstName', 'lastName', 'city', 'company', 'jobTitle'].includes(name)) {
            finalValue = capitalize(value);
        }
        setFormState((prev: any) => ({ ...prev, [name]: finalValue }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormState((prev: any) => ({ ...prev, [name]: checked }));
    };
    
    const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const category = value as Category;
        setFormState((prev: any) => {
            const currentCategories = prev.category || [];
            if (checked && !currentCategories.includes(category)) {
                return { ...prev, category: [...currentCategories, category] };
            } else if (!checked) {
                return { ...prev, category: currentCategories.filter((cat: Category) => cat !== category) };
            }
            return prev;
        });
    };

    // --- UPDATED ARRAY HANDLER ---
    const handleArrayChange = (index: number, field: string, key: string, value: string) => {
        setFormState((prev: any) => {
            const list = [...(prev[field] as any[])];
            const item = { ...list[index] }; 
            
            item[key] = value;

            // Special handling for Phones
            if (field === 'phones') {
                if (key === 'number') {
                    // Format number based on current country code
                    item.number = formatPhoneNumber(value, item.countryCode);
                } else if (key === 'countryCode') {
                    // Re-format existing number when country code changes
                    item.number = formatPhoneNumber(item.number, value);
                }
            } 
            // ... (Keep other field formatting like capitalize)
            else if (['city', 'address1', 'address2', 'company', 'jobTitle'].includes(key)) {
                 item[key] = capitalize(value);
            } else if (key === 'state') {
                 item[key] = value.toUpperCase();
            }

            list[index] = item;
            return { ...prev, [field]: list };
        });
    };

    // --- UPDATED ADD ENTRY ---
    const addEntry = (field: string) => {
        const defaults: any = {
            phones: { type: 'Mobile', countryCode: '+1', number: '' }, // Default to +1
            emails: { type: 'Main', address: '' },
            socialMedia: { platform: 'LinkedIn', url: '' },
            addresses: { type: 'Main', address1: '', city: '', state: '', zip: '' }
        };
        setFormState((prev: any) => ({
            ...prev,
            [field]: [...(prev[field] || []), defaults[field]]
        }));
    };

    const removeEntry = (field: string, index: number) => {
        setFormState((prev: any) => ({
            ...prev,
            [field]: (prev[field] as any[]).filter((_, i) => i !== index)
        }));
    };
    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        
        if (!formState.firstName) newErrors.firstName = 'First name is required.';
        if (!formState.lastName) newErrors.lastName = 'Last name is required.';
        
        // Validate Emails
        formState.emails?.forEach((e: EmailEntry) => {
             if (e.address && !isValidEmail(e.address)) {
                 newErrors.email = 'One or more emails are invalid.';
             }
        });

        // --- RESTORED PHONE VALIDATION ---
        formState.phones?.forEach((p: PhoneEntry) => {
             // Only validate if a number is entered
             if (p.number && !isValidPhone(p.number)) {
                 newErrors.phone = `Invalid phone number: ${p.number}`;
             }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            // Clean up empty entries before saving
            const cleanedState = { ...formState };
            cleanedState.phones = cleanedState.phones.filter((p: PhoneEntry) => p.number.trim() !== '');
            cleanedState.emails = cleanedState.emails.filter((e: EmailEntry) => e.address.trim() !== '');
            cleanedState.addresses = cleanedState.addresses.filter((a: AddressEntry) => a.address1.trim() !== '');

            // Handle Other Category
            if (!cleanedState.category.includes(Category.OTHER)) {
                delete cleanedState.otherCategory;
            }

            onSave(contactToEdit ? { ...cleanedState, id: contactToEdit.id } : cleanedState);
            onClose();
        }
    };

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center overflow-y-auto py-10">
            <div className="bg-white rounded-lg shadow-2xl p-8 m-4 max-w-4xl w-full flex flex-col max-h-[95vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {contactToEdit ? 'Edit Contact' : 'New Contact'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-6">
                    
                    {/* --- Basic Info --- */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Honorific</label>
                            <select name="honorific" value={formState.honorific || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm sm:text-sm">
                                <option value="">-</option>
                                <option value="Mr.">Mr.</option>
                                <option value="Mrs.">Mrs.</option>
                                <option value="Ms.">Ms.</option>
                                <option value="Dr.">Dr.</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">First Name *</label>
                            <input type="text" name="firstName" value={formState.firstName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Middle</label>
                            <input type="text" name="middleName" value={formState.middleName || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                            <input type="text" name="lastName" value={formState.lastName} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm`} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Company</label>
                            <input type="text" name="company" value={formState.company || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Job Title</label>
                            <input type="text" name="jobTitle" value={formState.jobTitle || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Website</label>
                            <input type="url" name="website" value={formState.website || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://" />
                        </div>
                    </div>

                    {/* --- Contact Info (Arrays) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-4">
                        
                        {/* Phones Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Numbers</label>
                            {formState.phones.map((phone: PhoneEntry, index: number) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <select 
                                        value={phone.type} 
                                        onChange={(e) => handleArrayChange(index, 'phones', 'type', e.target.value)} 
                                        className="w-[25%] px-2 py-2 bg-white border border-gray-300 rounded-md text-xs"
                                    >
                                        <option value="Mobile">Mobile</option>
                                        <option value="Work">Work</option>
                                        <option value="Home">Home</option>
                                        <option value="Main">Main</option>
                                    </select>

                                    {/* Country Code Dropdown */}
                                    <select
                                        value={phone.countryCode}
                                        onChange={(e) => handleArrayChange(index, 'phones', 'countryCode', e.target.value)}
                                        className="w-[25%] px-2 py-2 bg-white border border-gray-300 rounded-md text-xs"
                                    >
                                        {COUNTRY_CODES.map(c => (
                                            <option key={c.code} value={c.code}>{c.label}</option>
                                        ))}
                                    </select>

                                    <input 
                                        type="tel" 
                                        value={phone.number} 
                                        onChange={(e) => handleArrayChange(index, 'phones', 'number', e.target.value)} 
                                        placeholder="(555) 123-4567" 
                                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md text-sm" 
                                    />
                                    <button type="button" onClick={() => removeEntry('phones', index)} className="text-red-400 hover:text-red-600">&times;</button>
                                </div>
                            ))}
                             <button type="button" onClick={() => addEntry('phones')} className="text-xs text-indigo-600 font-semibold">+ Add Phone</button>
                        </div>

                        {/* Emails */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Addresses</label>
                            {formState.emails.map((email: EmailEntry, index: number) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <select value={email.type} onChange={(e) => handleArrayChange(index, 'emails', 'type', e.target.value)} className="w-1/3 px-2 py-2 bg-white border border-gray-300 rounded-md text-xs">
                                        <option value="Main">Main</option>
                                        <option value="Work">Work</option>
                                        <option value="Personal">Personal</option>
                                    </select>
                                    <input type="email" value={email.address} onChange={(e) => handleArrayChange(index, 'emails', 'address', e.target.value)} className="flex-grow px-3 py-2 border border-gray-300 rounded-md text-sm" />
                                    <button type="button" onClick={() => removeEntry('emails', index)} className="text-red-400 hover:text-red-600">&times;</button>
                                </div>
                            ))}
                            <button type="button" onClick={() => addEntry('emails')} className="text-xs text-indigo-600 font-semibold">+ Add Email</button>
                        </div>
                    </div>

                    {/* --- Addresses (With Search) --- */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Addresses</label>
                        
                        {/* Search Bar */}
                        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                             <div className="flex-grow">
                                {mapsApiLoaded ? (
                                    <gmp-place-autocomplete
                                        ref={autocompleteRef}
                                        placeholder="Search to add an address..."
                                        country-codes='["us"]'
                                        place-fields="addressComponents,formattedAddress"
                                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                    ></gmp-place-autocomplete>
                                 ) : <span className="text-xs text-gray-400">Loading maps...</span>}
                             </div>
                             <button type="button" onClick={handleFillAddress} disabled={!placeDetails} className={`p-2 rounded-md ${placeDetails ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-300 cursor-not-allowed'}`}>
                                <ClipboardIcon className="h-6 w-6" />
                             </button>
                        </div>

                        {/* Address List */}
                        <div className="space-y-4">
                            {formState.addresses.map((addr: AddressEntry, index: number) => (
                                <div key={index} className="p-4 bg-white rounded-lg border border-gray-300 relative shadow-sm">
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-3">
                                             <select value={addr.type} onChange={(e) => handleArrayChange(index, 'addresses', 'type', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs">
                                                <option value="Main">Main</option>
                                                <option value="Work">Work</option>
                                                <option value="Home">Home</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-span-9 flex justify-end">
                                             <button type="button" onClick={() => removeEntry('addresses', index)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                                        </div>
                                        <div className="col-span-12">
                                            <input type="text" placeholder="Address Line 1" value={addr.address1} onChange={(e) => handleArrayChange(index, 'addresses', 'address1', e.target.value)} className="w-full px-3 py-1 border border-gray-300 rounded text-sm" />
                                        </div>
                                        <div className="col-span-12">
                                            <input type="text" placeholder="Address Line 2" value={addr.address2} onChange={(e) => handleArrayChange(index, 'addresses', 'address2', e.target.value)} className="w-full px-3 py-1 border border-gray-300 rounded text-sm" />
                                        </div>
                                        <div className="col-span-5">
                                            <input type="text" placeholder="City" value={addr.city} onChange={(e) => handleArrayChange(index, 'addresses', 'city', e.target.value)} className="w-full px-3 py-1 border border-gray-300 rounded text-sm" />
                                        </div>
                                        <div className="col-span-3">
                                            <input type="text" placeholder="State" value={addr.state} maxLength={2} onChange={(e) => handleArrayChange(index, 'addresses', 'state', e.target.value)} className="w-full px-3 py-1 border border-gray-300 rounded text-sm uppercase" />
                                        </div>
                                        <div className="col-span-4">
                                            <input type="text" placeholder="Zip" value={addr.zip} maxLength={10} onChange={(e) => handleArrayChange(index, 'addresses', 'zip', e.target.value)} className="w-full px-3 py-1 border border-gray-300 rounded text-sm" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => addEntry('addresses')} className="text-sm text-indigo-600 font-medium">+ Add Manual Address</button>
                        </div>
                    </div>

                    {/* --- Categories & Notes --- */}
                    <div className="border-t pt-4">
                         <label className="block text-sm font-medium text-gray-700">Category</label>
                         <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[Category.CUSTOMER, Category.MEDIA, Category.STAFF, Category.VENDOR, Category.OTHER].map(cat => (
                                <div key={cat} className="flex items-center">
                                    <input id={`cat-${cat}`} type="checkbox" value={cat} checked={(formState.category || []).includes(cat)} onChange={handleCategoryChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                                    <label htmlFor={`cat-${cat}`} className="ml-2 text-sm text-gray-900">{cat}</label>
                                </div>
                            ))}
                        </div>
                        {formState.category.includes(Category.OTHER) && (
                            <input type="text" name="otherCategory" value={formState.otherCategory || ''} onChange={handleChange} placeholder="Specify other category" className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea name="notes" value={formState.notes || ''} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>

                    <div className="flex items-center">
                        <input id="newsletter" name="sendTNSBNewsletter" type="checkbox" checked={!!formState.sendTNSBNewsletter} onChange={handleCheckboxChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                        <label htmlFor="newsletter" className="ml-2 block text-sm text-gray-900">Subscribe to TNSB Newsletter</label>
                    </div>

                    {/* Metadata - UPDATED SECTION */}
                    {contactToEdit && (
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Metadata</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500">
                                <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                    <span className="block font-semibold text-gray-700 mb-1">Contact ID</span>
                                    <span className="font-mono text-indigo-600">
                                        {contactToEdit.contactNumber ? `#${contactToEdit.contactNumber}` : contactToEdit.id}
                                    </span>
                                </div>
                                <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                    <span className="block font-semibold text-gray-700 mb-1">Created</span>
                                    {formatTimestamp(contactToEdit.createdAt)}
                                    <span className="block text-gray-400 text-[10px] mt-1">By: {contactToEdit.createdBy || 'System'}</span>
                                </div>
                                <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                    <span className="block font-semibold text-gray-700 mb-1">Last Modified</span>
                                    {formatTimestamp(contactToEdit.lastModifiedAt)}
                                    <span className="block text-gray-400 text-[10px] mt-1">By: {contactToEdit.lastModifiedBy || 'System'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form Buttons */}
                    <div className="mt-8 flex justify-end space-x-4 pt-4 border-t border-gray-200">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium shadow-sm transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium shadow-sm transition-colors">
                            Save Contact
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactForm;