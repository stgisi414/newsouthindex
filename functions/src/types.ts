import {Timestamp} from "firebase-admin/firestore";

// Enum for Contact Categories
export enum Category {
  CUSTOMER = 'Customer',
  STAFF = 'Staff',
  VENDOR = 'Vendor',
  MEDIA = 'Media',
  OTHER = 'Other',
}

// Enum for User Roles
export enum Role {
  MASTER_ADMIN = 'master-admin',
  ADMIN = 'admin',
  BOOKKEEPER = 'bookkeeper',
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
  showAiChat?: boolean;
  isMasterAdmin?: boolean;
  contactId?: string; // <-- ADD THIS: Links Auth User to Contact doc
  userNumber?: number;
}

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

// Add these new interfaces at the top
export type EntryType = 'Home' | 'Work' | 'Mobile' | 'Main' | 'Other';

export interface PhoneEntry {
    type: EntryType;
    countryCode: string;
    number: string;
}

export interface EmailEntry {
    type: EntryType;
    address: string;
}

export interface AddressEntry {
    type: EntryType;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
}

export interface SocialMediaEntry {
    platform: 'LinkedIn' | 'Twitter' | 'Facebook' | 'Instagram' | 'Other';
    url: string;
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


// Book Interface
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