enum Category {
    VENDOR = 'Vendor',
    Customer = 'Customer',
    MEDIA = 'Media',
    PERSONAL = 'Personal',
    OTHER = 'Other'
}

// Mock Contacts
export const mockContacts = [
    { firstName: "Alice", lastName: "Johnson", email: "alice.j@example.com", phone: "555-0101", category: Category.Customer, city: "Montgomery", state: "AL", zip: "36104" },
    { firstName: "Bob", lastName: "Williams", email: "bob.w@example.com", phone: "555-0102", category: Category.VENDOR, city: "Birmingham", state: "AL", zip: "35203" },
    { firstName: "Charlie", lastName: "Brown", email: "charlie.b@example.com", phone: "555-0103", category: Category.MEDIA, city: "Mobile", state: "AL", zip: "36602" },
    { firstName: "Diana", lastName: "Miller", email: "diana.m@example.com", phone: "555-0104", category: Category.PERSONAL, city: "Huntsville", state: "AL", zip: "35801" },
];

// Mock Books
export const mockBooks = [
    { title: "The Great Gatsby", author: "F. Scott Fitzgerald", price: 10.99, stock: 50, isbn: "9780743273565" },
    { title: "To Kill a Mockingbird", author: "Harper Lee", price: 12.50, stock: 35, isbn: "9780061120084" },
    { title: "1984", author: "George Orwell", price: 9.99, stock: 60, isbn: "9780451524935" },
    { title: "The Catcher in the Rye", author: "J.D. Salinger", price: 8.75, stock: 40, isbn: "9780316769488" },
];

// Mock Events
export const mockEvents = [
    { name: "Local Author Signing", date: new Date("2025-11-15T18:00:00"), time: "18:00", location: "Main Store", description: "Meet local author Jane Doe.", author: "Jane Doe", attendeeIds: [] },
    { name: "Poetry Reading Night", date: new Date("2025-12-05T19:30:00"), time: "19:30", location: "Upstairs Loft", description: "Open mic poetry night.", attendeeIds: [] },
];

// Note: Transactions will be created dynamically in the seeding function
// to ensure they reference existing contacts and books.
