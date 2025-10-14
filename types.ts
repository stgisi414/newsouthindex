export enum Category {
    VENDOR = 'Vendor',
    CLIENT = 'Client',
    MEDIA = 'Media',
    PERSONAL = 'Personal',
    OTHER = 'Other'
}

export interface Contact {
    id: string;
    honorific?: string;
    firstName: string;
    middleInitial?: string;
    lastName: string;
    suffix?: string;
    category: Category;
    phone: string;
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

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    userId: string; 
    timestamp: any;
}