import React from 'react';

interface TutorialPageProps {
  onBackToDashboard: () => void;
}

const TutorialPage: React.FC<TutorialPageProps> = ({ onBackToDashboard }) => {
  // Helper component for styling sections
  const TutorialSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden transform transition-all hover:scale-[1.02]">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5">
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
              Your complete guide to the current features.
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
                <strong>Viewer Role:</strong> Viewers can see all Contacts and *only* their own Expense Reports (those they created or are assigned to). They cannot create, edit, or delete anything.
              </li>
              <li>
                <strong>Admin Role:</strong> Admins can create, edit, and delete all Contacts. They can also see/manage *only* their own Expense Reports. In the Admin Panel, they can only promote Applicants to Viewers.
              </li>
              <li>
                <strong>Bookkeeper Role:</strong> Bookkeepers can do everything an Admin can, but they can also see and manage *all* Expense Reports from *all* users.
              </li>
              <li>
                <strong>Master Admin Role:</strong> Has full "god mode" access. Can create, read, update, and delete all Contacts and *all* Expense Reports. This is the only role that can promote users to 'Admin' or 'Bookkeeper' and the only role that can delete users.
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
                <strong>Navigation Tabs:</strong> Use the tabs at the top (Contacts, Expense Reports) to switch between data views.
              </li>
              <li>
                <strong>Action Buttons:</strong> Above the tables, you'll find buttons like "New Contact" or "Admin Panel" to perform actions.
              </li>
              <li>
                <strong>Advanced Filtering:</strong> Click the "Filters" button above the Contacts table to open a detailed filtering panel.
              </li>
              <li>
                <strong>AI Chat Panel (Right):</strong> This is where you interact with the AI Assistant. You can hide/show this panel using the "Hide/Show AI" button.
              </li>
            </ul>
          </TutorialSection>

          <TutorialSection title="👤 Contact Management">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Contacts' tab shows all contacts.
              </li>
              <li>
                <strong>Add (Admin+):</strong> Click "New Contact" or ask the AI. A form will appear to enter details like name, email, and category. The 'Category' field is a multi-select; a contact can be both a 'Customer' and a 'Staff' member.
              </li>
              <li>
                <strong>Edit (Admin+):</strong> Click the blue 'Edit' icon (pencil) in the table, or ask the AI. This opens the same form, pre-filled with the contact's info.
              </li>
              <li>
                <strong>Inline Edit (Admin+):</strong> You can click directly on most fields in the table (like name or email) to edit them without opening the full form.
              </li>
              <li>
                <strong>Delete (Admin+):</strong> Click the red 'Delete' icon (trash can) or ask the AI.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="📋 Expense Report Management">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>View:</strong> The 'Expense Reports' tab shows reports you have permission to see.
              </li>
              <li>
                <strong>Permissions:</strong> Master Admins and Bookkeepers see *all* reports. Admins and Viewers only see reports they *created* or are *assigned to* as the staff member.
              </li>
              <li>
                <strong>Add:</strong> Click "New Report". The Report Number is assigned by the server *after* you save (it will show "N/A" on a new report).
              </li>
              <li>
                <strong>Staff Selection:</strong> If you are a Master Admin or Bookkeeper, you must select the staff member. If you are an Admin or Viewer, your name will be automatically selected if your user account is linked to a 'Staff' contact.
              </li>
              <li>
                <strong>Edit/Delete:</strong> You can edit or delete reports you have access to. Deleting is permanent.
              </li>
              <li>
                <strong>Print:</strong> Click the 'Print' icon on the table to open a report in a clean, print-friendly view.
              </li>
            </ul>
          </TutorialSection>
          
          <TutorialSection title="🔒 Admin Panel & Metrics">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>AI Metrics:</strong> The fastest way to get metrics is to ask the AI. Try queries like <em>"what's my total revenue this year?"</em> or <em>"who are my top 5 customers?"</em>
              </li>
              <li>
                <strong>Admin Panel (Admin+):</strong> Click the "Admin Panel" button.
              </li>
              <li>
                <strong>Role Management:</strong> Master Admins can change user roles to any level (Applicant, Viewer, Bookkeeper, Admin) and can delete users. Regular Admins can *only* change users between 'Applicant' and 'Viewer'.
              </li>
              <li>
                <strong>Force Sync Button:</strong> If you have been promoted and your permissions seem wrong, click this button. It forces the system to re-sync your database role to your login token. **You must log out and log back in** after clicking it for the changes to take effect.
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
                <em className="text-sm p-1 bg-gray-100 rounded">"show me all submitted expense reports"</em>
              </li>
              <li>
                <strong>Creating Data (Admin+):</strong> Ask to create new entries.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"add a new contact named John Smith, email john@example.com, category Customer"</em>
              </li>
              <li>
                <strong>Updating Data (Admin+):</strong> Ask to modify existing entries.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"update John Smith's email to john.smith@new.com"</em>
              </li>
              <li>
                <strong>Deleting Data (Admin+):</strong> Be specific when asking to delete.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"delete the contact John Smith"</em>
              </li>
              <li>
                <strong>Aggregations & Reports:</strong> Ask complex questions.
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"how many contacts are in the Customer category?"</em>
                <br />
                <em className="text-sm p-1 bg-gray-100 rounded">"how many draft reports?"</em>
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