import React from 'react';
import { AppUser } from '../types';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/firebaseConfig';

interface AdminPanelProps {
    users: AppUser[];
    currentUser: User;
}

const setAdminStatus = httpsCallable(functions, 'setAdminStatus');
const deleteUser = httpsCallable(functions, 'deleteUser');

const AdminPanel: React.FC<AdminPanelProps> = ({ users, currentUser }) => {

    const handleSetAdmin = async (userId: string, isAdmin: boolean) => {
        if (window.confirm(`Are you sure you want to ${isAdmin ? 'promote' : 'demote'} this user?`)) {
            try {
                await setAdminStatus({ userId, isAdmin });
                alert('User status updated successfully.');
            } catch (error) {
                console.error("Error updating admin status:", error);
                alert('Failed to update user status.');
            }
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
            try {
                await deleteUser({ userId });
                alert('User deleted successfully.');
            } catch (error) {
                console.error("Error deleting user:", error);
                alert('Failed to delete user.');
            }
        }
    };

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 mt-8">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Admin Panel</h3>
            <div className="space-y-4">
                {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{user.email}</span>
                        <div className="flex items-center space-x-3">
                            {user.id !== currentUser.uid && (
                                <>
                                    <button
                                        onClick={() => handleSetAdmin(user.id, !user.isAdmin)}
                                        className={`px-3 py-1 text-xs font-semibold rounded ${
                                            user.isAdmin
                                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                                        }`}
                                    >
                                        {user.isAdmin ? 'Demote' : 'Promote to Admin'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded hover:bg-red-200"
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminPanel;