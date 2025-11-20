import { Category } from "./types";

// Mock Contacts
export const mockContacts = [
    { 
        firstName: "Alice", 
        lastName: "Johnson", 
        emails: [{ type: "Main", address: "alice.j@example.com" }],
        phones: [{ type: "Mobile", number: "555-0101" }],
        category: [Category.CUSTOMER], 
        addresses: [{ type: "Main", address1: "123 Apple St", city: "Montgomery", state: "AL", zip: "36104" }],
        // Keep old fields for safety/backward compatibility during dev if needed, 
        // or remove them if you are confident in the migration.
        email: "alice.j@example.com",
        phone: "555-0101",
        city: "Montgomery",
        state: "AL",
        zip: "36104"
    },
    { 
        firstName: "Bob", 
        lastName: "Williams", 
        emails: [{ type: "Work", address: "bob.w@example.com" }],
        phones: [{ type: "Work", number: "555-0102" }],
        category: [Category.VENDOR],
        addresses: [{ type: "Work", address1: "456 Orange Ave", city: "Birmingham", state: "AL", zip: "35203" }],
        email: "bob.w@example.com",
        phone: "555-0102",
        city: "Birmingham",
        state: "AL",
        zip: "35203"
    },
    { 
        firstName: "Charlie", 
        lastName: "Brown", 
        emails: [{ type: "Main", address: "charlie.b@example.com" }],
        phones: [{ type: "Mobile", number: "555-0103" }],
        category: [Category.MEDIA],
        addresses: [{ type: "Main", address1: "789 Pear Ln", city: "Mobile", state: "AL", zip: "36602" }],
        email: "charlie.b@example.com",
        phone: "555-0103",
        city: "Mobile",
        state: "AL",
        zip: "36602"
    },
    { 
        firstName: "Diana", 
        lastName: "Miller", 
        emails: [{ type: "Main", address: "diana.m@example.com" }],
        phones: [{ type: "Home", number: "555-0104" }],
        category: [Category.OTHER],
        addresses: [{ type: "Home", address1: "101 Berry Blvd", city: "Huntsville", state: "AL", zip: "35801" }],
        email: "diana.m@example.com",
        phone: "555-0104",
        city: "Huntsville",
        state: "AL",
        zip: "35801"
    },
];

// Mock Books (Unchanged)
export const mockBooks = [
    { title: "The Great Gatsby", author: "F. Scott Fitzgerald", price: 10.99, stock: 50, isbn: "9780743273565" },
    { title: "To Kill a Mockingbird", author: "Harper Lee", price: 12.50, stock: 35, isbn: "9780061120084" },
    { title: "1984", author: "George Orwell", price: 9.99, stock: 60, isbn: "9780451524935" },
    { title: "The Catcher in the Rye", author: "J.D. Salinger", price: 8.75, stock: 40, isbn: "9780316769488" },
];

// Mock Events (Unchanged)
export const mockEvents = [
    { name: "Local Author Signing", date: new Date("2025-11-15T18:00:00"), time: "18:00", location: "Main Store", description: "Meet local author Jane Doe.", author: "Jane Doe", attendeeIds: [] },
    { name: "Poetry Reading Night", date: new Date("2025-12-05T19:30:00"), time: "19:30", location: "Upstairs Loft", description: "Open mic poetry night.", attendeeIds: [] },
];