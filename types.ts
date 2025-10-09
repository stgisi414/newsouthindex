
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

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    data?: any;
}
