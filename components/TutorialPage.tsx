import React from 'react';

interface TutorialPageProps {
  onBackToDashboard: () => void;
}

const TutorialPage: React.FC<TutorialPageProps> = ({ onBackToDashboard }) => {
  // Helper component for styling sections
  const TutorialSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden transform transition-all hover:scale-[1.02]">
      <div className="bg-gradient-to-r from-blue-600 to-obsidian-600 p-5">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="p-6 space-y-4 text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 p-4 sm:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-10 bg-white p-5 rounded-lg shadow-lg">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900">
              NewSouth Index Guide
            </h1>
            <p className="text-lg text-gray-600 mt-1">
              Your complete guide to every feature.
            </p>
          </div>
          <button
            onClick={onBackToDashboard}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-base"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Grid for Tutorial Sections */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
          
          <TutorialSection title="🚀 Getting Started: Login & Roles">
            <p>Welcome to the NewSouth Index! Here's how to get started:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Logging In:</strong> Use your registered Google account to sign in.
              </li>
              <li>
                <strong>Applicant Role:</strong> When you first sign up, your account is an 'Applicant'. You will see a "Pending Access" screen. An existing Admin must approve your account.
              </li>
              <li>
                <strong>Viewer Role:</strong> Viewers can see all data (contacts, books, etc.) and use the AI Assistant to find information, but cannot create, edit, or delete anything.
              </li>
              <li>
                <strong>Admin Role:</strong> Admins have full access. They can create, edit, delete all data, and manage user roles in the Admin Panel.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="📊 The Dashboard: Navigation & Layout">
            <p>The dashboard is your main workspace, split into two main columns (on larger screens).</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Main Content Area (Left):</strong> This area contains all your data tables.
              </li>
              <li>
                <strong>Navigation Tabs:</strong> Use the tabs at the top (Contacts, Book Inventory, etc.) to switch between data views.
              </li>
              <li>
                <strong>Action Buttons (Admin):</strong> Above the tables, you'll find buttons like "New Contact" or "Show Admin" to perform actions.
              </li>
              <li>
                <strong>Advanced Filtering:</strong> Click the "Filters" button above any table to open a detailed filtering panel. You can filter by any field (e.g., city, price range, date range) to narrow your results.
              </li>
              <li>
                <strong>AI Chat Panel (Right):</strong> This is where you interact with the AI Assistant. You can hide/show this panel using the "Hide/Show AI" button in the header.
              </li>
            </ul>
          </TutorialSection>

          <TutorialSection title="👤 Contact Management">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Contacts' tab shows all contacts.
              </li>
              <li>
                <strong>Add (Admin):</strong> Click "New Contact" or ask the AI. A form will appear to enter details like name, email, and category. The 'Category' field is a multi-select; a contact can be both a 'Customer' and a 'Vendor'.
              </li>
              <li>
                <strong>Address Autocomplete:</strong> In the contact form, use the "Search Address" bar to find a location. Click the clipboard icon next to it to automatically fill in the Address 1, City, State, and Zip fields.
              </li>
              <li>
                <strong>Edit (Admin):</strong> Click the blue 'Edit' icon (pencil) in the table, or ask the AI. This opens the same form, pre-filled with the contact's info.
              </li>
              <li>
                <strong>Inline Edit (Admin):</strong> You can click directly on most fields in the table (like name or email) to edit them without opening the full form.
              </li>
              <li>
                <strong>Delete (Admin):</strong> Click the red 'Delete' icon (trash can) or ask the AI.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="📚 Book Inventory">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Book Inventory' tab shows all books, including title, author, price, and current stock.
              </li>
              <li>
                <strong>Add (Admin):</strong> Click "New Book" or ask the AI. Fill in the details.
              </li>
              <li>
                <strong>Edit (Admin):</strong> Click the 'Edit' icon or ask the AI.
              </li>
              <li>
                <strong>Stock Management:</strong> Stock is adjusted <strong>automatically</strong> when you create or delete a transaction. You can also edit the stock number manually via the 'Edit' form or by inline editing.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="💸 Transaction Management">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Transactions' tab shows a log of all sales.
              </li>
              <li>
                <strong>Add (Admin):</strong> Click "New Transaction". This opens a special form:
                  <ol className="list-decimal list-inside ml-6 mt-2 space-y-1">
                    <li>Select a contact from the dropdown.</li>
                    <li>Select a book from the dropdown and set the quantity.</li>
                    <li>Click "Add Book to Sale" to add it to the list. You can add multiple books.</li>
                    <li>The total price is calculated automatically.</li>
                    <li>Click "Save Transaction" to log the sale. This will <strong>automatically deduct</strong> the sold books from your Book Inventory stock.</li>
                  </ol>
              </li>
              <li>
                <strong>Edit (Admin):</strong> Editing a transaction is not recommended. Instead, <strong>delete the incorrect transaction</strong> (which automatically adds the books back to stock) and create a new, correct one.
              </li>
              <li>
                <strong>Delete (Admin):</strong> Click the 'Delete' icon. This will <strong>automatically refund</strong> the stock of all books from that sale back into your Book Inventory.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="🎉 Event Management">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Events' tab lists all upcoming and past events.
              </li>
              <li>
                <strong>Add (Admin):</strong> Click "New Event" or ask the AI.
              </li>
              <li>
                <strong>Edit (Admin):</strong> Click the 'Edit' icon. This opens the full event form.
              </li>
              <li>
                <strong>Managing Attendees:</strong>
                  <ol className="list-decimal list-inside ml-6 mt-2 space-y-1">
                    <li>In the 'Edit' form, you'll see an "Attendees" section.</li>
                    <li>Use the search bar and dropdown to find contacts and click "Add" to add them to the event.</li>
                    <li>Click "Remove" on any attendee in the list below to remove them.</li>
                    <li>You can also ask the AI, e.g., <em>"add John Smith to the staff meeting"</em>.</li>
                  </ol>
              </li>
              <li>
                <strong>Quick View:</strong> Click the "View" button on an event in the table to expand it and see all details without opening the form.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="📈 Reports & Admin">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Reports Tab:</strong> This view provides high-level metrics about your business. You can see charts for Top Customers, Best Selling Books, and more.
              </li>
              <li>
                <strong>AI Reports:</strong> The fastest way to get metrics is to ask the AI. Try queries like <em>"what's my total revenue this year?"</em> or <em>"what's the total value of my inventory?"</em>
              </li>
              <li>
                <strong>Admin Panel (Admin):</strong> Click the "Show Admin" button. This panel lists all users in the system. You can change any user's role from 'Applicant' to 'Viewer' or 'Admin'.
              </li>
            </ul>
          </TutorialSection>

          <TutorialSection title="🤖 The AI Assistant: Your Smart Co-pilot">
            <p>
              The AI Assistant, located in the chat panel on the right, is your primary tool for interacting with data quickly. You can ask it to do things in plain English.
            </p>
            <p className="font-semibold">Key Features:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Finding Data:</strong> Ask to find things. The app will automatically filter the tables for you.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"find all contacts in Alabama"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"show me all books by Jane Doe"</em>
              </li>
              <li>
                <strong>Creating Data (Admin):</strong> Ask to create new entries.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"add a new contact named John Smith, email john@example.com, category Customer"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"schedule a new event 'Poetry Reading' for next Friday"</em>
              </li>
              <li>
                <strong>Updating Data (Admin):</strong> Ask to modify existing entries.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"update John Smith's email to john.smith@new.com"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"add Jane Doe to the 'Poetry Reading' event"</em>
              </li>
              <li>
                <strong>Deleting Data (Admin):</strong> Be specific when asking to delete.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"delete the contact John Smith"</em>
              </li>
              <li>
                <strong>Aggregations & Reports:</strong> Ask complex questions.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"how many contacts are in the Customer category?"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"what's my total revenue for last month?"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"who are my top 5 customers?"</em>
              </li>
            </ul>
          </TutorialSection>

        </div>
      </div>
    </div>
  );
};

export default TutorialPage;
