export enum Category {
    VENDOR = 'Vendor',
    CUSTOMER = 'Customer',
    MEDIA = 'Media',
    STAFF = 'Staff', // Added this
    // PERSONAL = 'Personal', // Removed this
    OTHER = 'Other'
}
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

// Contact Interface
export interface Contact {
  id: string;
  contactNumber?: number;
  honorific?: string;
  firstName: string;
  middleName?: string; // <-- Changed from middleInitial
  lastName: string;
  suffix?: string;
  category: Category[]; // <-- FIX: Changed from Category to Category[]
  phone?: string;
  phones: PhoneEntry[];
  email: string;
  emails: EmailEntry[];
  url?: string;
  address1?: string;
  address2?: string;
  addresses: AddressEntry[];
  city?: string;
  state?: string;
  zip?: string;
  company?: string; 
  jobTitle?: string;
  website?: string;
  socialMedia?: SocialMediaEntry[];
  notes?: string;
  otherCategory?: string;
  sendTNSBNewsletter?: boolean;
  createdAt?: FirebaseTimestamp | Date | any;
  createdBy?: string;
  lastModifiedAt?: FirebaseTimestamp | Date | any;
  lastModifiedBy?: string;
  isActive?: boolean;
}

export enum UserRole {
    APPLICANT = 'applicant',
    VIEWER = 'viewer',
    STAFF = 'staff', // <-- ADDED
    ADMIN = 'admin',
    BOOKKEEPER = 'bookkeeper', // <-- ADDED
    MASTER_ADMIN = 'master-admin', // <-- ADDED
}

export interface AppUser {
    id: string;
    email?: string;
    role: UserRole;
    isAdmin: boolean; // This is now (role === UserRole.ADMIN || role === UserRole.BOOKKEEPER || role === UserRole.MASTER_ADMIN)
    isMasterAdmin?: boolean; // (role === UserRole.MASTER_ADMIN)
    showAiChat?: boolean;
    contactId?: string; // <-- ADDED: Links user to a Contact document
    userNumber?: number;
}

export interface ExpenseReport {
    id: string;
    staffContactId: string; 
    staffName: string; 
    expenseDate: any; // Firestore Timestamp
    totalAmount: number;
    advanceAmount?: number;
    notes?: string;
    reportNumber?: number;
    
    // Metadata
    createdAt?: FirebaseTimestamp | Date | any;
    createdBy?: string;
    lastModifiedAt?: FirebaseTimestamp | Date | any;
    lastModifiedBy?: string;
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
    createdAt?: FirebaseTimestamp | Date | any;
    createdBy?: string;
    lastModifiedAt?: FirebaseTimestamp | Date | any;
    lastModifiedBy?: string;
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
    createdAt?: FirebaseTimestamp | Date | any;
    createdBy?: string;
    lastModifiedAt?: FirebaseTimestamp | Date | any;
    lastModifiedBy?: string;
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