
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
}