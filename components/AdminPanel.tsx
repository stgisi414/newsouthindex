import React, { useState, useMemo } from 'react';
import { AppUser, UserRole } from '../types';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/firebaseConfig';

interface AdminPanelProps {
    users: AppUser[];
    currentUser: User;
}

const setUserRole = httpsCallable(functions, 'setUserRole');
const deleteUser = httpsCallable(functions, 'deleteUser');
const MASTER_ADMIN_EMAIL = "olive.raccoon.392@example.com";
const ITEMS_PER_PAGE = 10;

const AdminPanel: React.FC<AdminPanelProps> = ({ users, currentUser }) => {
    const [currentPage, setCurrentPage] = useState(1);

    const handleSetRole = async (userId: string, role: UserRole) => {
        if (window.confirm(`Are you sure you want to set this user's role to ${role}?`)) {
            try {
                await setUserRole({ userId, role });
                alert('User role updated successfully.');
            } catch (error: any) {
                console.error("Error updating user role:", error);
                alert(`Failed to update user role: ${error.message}`);
            }
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
            try {
                await deleteUser({ userId });
                alert('User deleted successfully.');
            } catch (error: any) {
                console.error("Error deleting user:", error);
                alert(`Failed to delete user: ${error.message}`);
            }
        }
    };
    
    const applicants = users.filter(u => u.role === UserRole.APPLICANT);
    const viewersAndAdmins = users.filter(u => u.role !== UserRole.APPLICANT);

    const totalPages = Math.ceil(viewersAndAdmins.length / ITEMS_PER_PAGE);
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return viewersAndAdmins.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, viewersAndAdmins]);

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 mt-2 mb-10">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Admin Panel</h3>

            {applicants.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-2">New Applicants</h4>
                    <div className="space-y-2 mb-6">
                        {applicants.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                <span className="text-sm text-gray-700">{user.email}</span>
                                <button
                                    onClick={() => handleSetRole(user.id, UserRole.VIEWER)}
                                    className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded hover:bg-green-300"
                                >
                                    Approve as Viewer
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <h4 className="text-md font-semibold text-gray-700 mb-2">Manage Users</h4>
            <div className="space-y-4">
                {paginatedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{user.email} ({user.role})</span>
                        <div className="flex items-center space-x-3">
                            {user.id !== currentUser.uid && !user.isMasterAdmin && (
                                <>
                                    {user.role === UserRole.VIEWER && (
                                        <button
                                            onClick={() => handleSetRole(user.id, UserRole.ADMIN)}
                                            className="px-3 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                                        >
                                            Promote to Admin
                                        </button>
                                    )}
                                    {user.role === UserRole.ADMIN && (
                                        <button
                                            onClick={() => handleSetRole(user.id, UserRole.VIEWER)}
                                            className="px-3 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                        >
                                            Demote to Viewer
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded hover:bg-red-200"
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                            {user.isMasterAdmin && (
                                <span className="text-xs font-semibold text-gray-500">Master Admin</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {/* ADDED: Pagination Controls for Admin Panel */}
            <div className="mt-4 flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                    </p>
                </div>
                <div className="flex justify-end">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                        Previous
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;