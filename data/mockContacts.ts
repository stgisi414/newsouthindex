
import { Contact, Category } from '../types';

export const mockContacts: Contact[] = [
    {
        id: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        category: Category.CLIENT,
        phone: '555-123-4567',
        email: 'jane.doe@example.com',
        address: '123 Main St, Anytown, USA',
    },
    {
        id: '2',
        firstName: 'John',
        lastName: 'Smith',
        category: Category.VENDOR,
        phone: '555-987-6543',
        email: 'john.smith@vendorcorp.com',
        address: '456 Oak Ave, Anytown, USA',
    },
    {
        id: '3',
        firstName: 'Alice',
        lastName: 'Johnson',
        category: Category.MEDIA,
        phone: '555-555-1212',
        email: 'alice.j@medianow.com',
        address: '789 Pine Ln, Anytown, USA',
    },
    {
        id: '4',
        firstName: 'Robert',
        lastName: 'Williams',
        category: Category.CLIENT,
        phone: '555-222-3333',
        email: 'rob.williams@email.net',
    },
    {
        id: '5',
        firstName: 'Emily',
        lastName: 'Brown',
        category: Category.PERSONAL,
        phone: '555-444-5555',
        email: 'emily.brown@personal.org',
        notes: 'Met at the tech conference.'
    },
    {
        id: '6',
        firstName: 'Michael',
        lastName: 'Jones',
        category: Category.OTHER,
        phone: '555-666-7777',
        email: 'mjones@consulting.io',
    },
];
