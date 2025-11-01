export enum Category {
    VENDOR = 'Vendor',
    CUSTOMER = 'Customer',
    MEDIA = 'Media',
    PERSONAL = 'Personal',
    OTHER = 'Other'
}

export interface Contact {
    id: string;
    honorific?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    category: Category[];
    phone?: string; // Made optional to simplify validation
    email: string;
    url?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
    createdDate?: any;
    lastModifiedDate?: any;
    createdBy?: string;
}

export enum UserRole {
    APPLICANT = 'applicant',
    VIEWER = 'viewer',
    ADMIN = 'admin',
}

export interface AppUser {
    id: string;
    email?: string;
    role: UserRole;
    isAdmin: boolean;
    isMasterAdmin?: boolean;
}

export interface Book {
    id: string;
    title: string;
    author: string;
    isbn?: string;
    publisher?: string;
    price: number;
    stock: number;
    genre?: string;
    publicationYear?: number;
}

export interface Transaction {
    id: string;
    contactId: string;
    contactName: string;
    books: {
        id: string;
        title: string;
        price: number;
        quantity: number;
    }[];
    totalPrice: number;
    transactionDate: any; 
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    userId: string; 
    timestamp: any;
}

export interface Event {
    id: string;
    name: string;
    date: any; 
    time?: string;
    location?: string;
    description?: string;
    author?: string; 
    attendeeIds?: string[];
}

export interface Attendee {
    id: string; 
    name: string;
}

// --- Validation Helpers ---

// Simple email regex (RFC 5322 standard is complex, this is practical)
export const isValidEmail = (email: string): boolean => {
    return /\S+@\S+\.\S+/.test(email);
};

// Basic URL validation
export const isValidUrl = (url: string): boolean => {
    if (!url) return true; 
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Basic US phone number validation (digits only, 7-15 length to account for country code/extensions)
export const isValidPhone = (phone: string): boolean => {
    if (!phone) return true; 
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
};

// Basic US zip code validation (5 digits or 5+4 format)
export const isValidZip = (zip: string): boolean => {
    if (!zip) return true;
    return /^\d{5}(-\d{4})?$/.test(zip);
};

// State validation (2 uppercase letters - US standard)
export const isValidState = (state: string): boolean => {
    if (!state) return true; 
    return /^[A-Z]{2}$/.test(state.toUpperCase());
};

// Time format validation (HH:MM)
export const isValidTime = (time: string): boolean => {
    if (!time) return true; 
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

export const isValidPrice = (price: number): boolean => {
    if (typeof price !== 'number' || isNaN(price)) return false;
    // Check if the number is non-negative and has at most two decimal places
    return price >= 0 && /^\d+(\.\d{1,2})?$/.test(price.toFixed(2));
};