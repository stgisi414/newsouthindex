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
    lastName: string;
    category: Category;
    phone: string;
    email: string;
    address?: string;
    notes?: string;
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

