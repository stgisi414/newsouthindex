import {Timestamp} from "firebase-admin/firestore";

// Enum for Contact Categories
export enum Category {
  CUSTOMER = 'Customer',
  EMPLOYEE = 'Employee',
  VENDOR = 'Vendor',
  MEDIA = 'Media',
  OTHER = 'Other',
}

// Enum for User Roles
export enum Role {
  MASTER_ADMIN = 'master-admin',
  ADMIN = 'admin',
  VIEWER = 'viewer',
  APPLICANT = 'applicant',
}

// AppUser Interface (for user data in 'users' collection)
export interface AppUser {
  id: string; // This will be the Firebase Auth UID
  email: string;
  role: Role;
  displayName?: string;
  createdAt: Timestamp;
}

// Contact Interface
export interface Contact {
  id: string;
  honorific?: string;
  firstName: string;
  middleName?: string; // <-- Changed from middleInitial
  lastName: string;
  suffix?: string;
  category: Category[]; // <-- FIX: Changed from Category to Category[]
  phone?: string;
  email: string;
  url?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string; // Name of the staffer who created it
  lastModifiedAt: Timestamp;
  lastModifiedBy: string; // Name of the staffer who last modified it
}

// Book Interface
export interface Book {
    id: string;
    title: string;
    author: string;
    isbn?: string;
    publisher?: string;
    publicationYear?: number;
    genre?: string;
    price: number;
    stock: number;
    createdAt: Timestamp;
    createdBy: string;
    lastModifiedAt: Timestamp;
    lastModifiedBy: string;
}

// Transaction Interface
export interface TransactionBook {
    bookId: string;
    title: string;
    quantity: number;
    priceAtTransaction: number;
}

export interface Transaction {
    id: string;
    contactId: string;
    contactName: string;
    books: TransactionBook[];
    totalPrice: number;
    transactionDate: Timestamp;
    createdAt: Timestamp;
    createdBy: string;
}

// Event Interface
export interface Event {
  id: string;
  name: string;
  author: string;
  date: Timestamp;
  location: string;
  description?: string;
  attendees: string[]; // Array of Contact IDs
  createdAt: Timestamp;
  createdBy: string;
  lastModifiedAt: Timestamp;
  lastModifiedBy: string;
}