import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "../src/firebaseConfig";
import { AppUser, UserRole } from "../types";
import { doc, getDoc } from "firebase/firestore";
import { User } from "firebase/auth"; // Import User type

// Define the function types
const setUserRole = httpsCallable<
  { userId: string; role: UserRole },
  { message: string }
>(functions, "setUserRole");
const deleteUser = httpsCallable<{ userId: string }, { message: string }>(
  functions,
  "deleteUser",
);

interface AdminPanelProps {
  users: AppUser[];
  currentUser: User; // Use the more specific auth User type
}

const AdminPanel: React.FC<AdminPanelProps> = ({ users, currentUser }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- NEW PERMISSIONS LOGIC ---
  // 1. Find the full AppUser object for the person VIEWING the panel
  const currentUserAppUser = users.find((u) => u.id === currentUser.uid);
  const isMasterAdmin = currentUserAppUser?.isMasterAdmin === true;
  // --- END NEW PERMISSIONS LOGIC ---

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    setError(null);
    setSuccess(null);
    try {
      // Check if the user document has the isMasterAdmin flag.
      // This is a failsafe; the backend function is the real source of truth.
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.data()?.isMasterAdmin && !isMasterAdmin) {
        setError("Only a Master Admin can change this user's role.");
        return;
      }
      if (userDoc.data()?.isMasterAdmin && isMasterAdmin) {
        setError("Master Admins cannot be modified.");
        return;
      }
      const result = await setUserRole({ userId: uid, role: newRole });
      setSuccess(result.data.message);
    } catch (err: any) {
      console.error("Error setting role:", err);
      setError(err.message || "An error occurred.");
    }
  };

  const handleDeleteUser = async (uid: string, email?: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete this user: ${
          email || uid
        }? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      // Check if the user is a Master Admin before even trying
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.data()?.isMasterAdmin) {
        setError("Master Admins cannot be deleted.");
        return;
      }
      const result = await deleteUser({ userId: uid });   
      setSuccess(result.data.message);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message || "An error occurred.");
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Admin Panel</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              // --- NEW PERMISSIONS LOGIC ---
              const isTargetMaster = user.isMasterAdmin === true;
              const isTargetAdmin = user.role === UserRole.ADMIN;

              // A regular admin cannot modify a Master Admin OR another Regular Admin
              const canRegularAdminModify =
                !isMasterAdmin && (isTargetMaster || isTargetAdmin);
              // --- END NEW PERMISSIONS LOGIC ---

              return (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.email || "No Email"}
                      {user.id === currentUser.uid && " (You)"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isTargetMaster ? "Master Admin" : user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as UserRole)
                      }
                      // Disable the dropdown if:
                      // 1. The target is a Master Admin
                      // 2. The current user is a Regular Admin and the target is another Admin
                      disabled={isTargetMaster || canRegularAdminModify}
                      className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${
                        isTargetMaster || canRegularAdminModify
                          ? "bg-gray-200 cursor-not-allowed"
                          : ""
                      }`}
                      title={
                        isTargetMaster
                          ? "Master Admins cannot be modified"
                          : canRegularAdminModify
                            ? "Only Master Admins can change this user's role"
                            : "Change user role"
                      }
                    >
                      <option value={UserRole.APPLICANT}>Applicant</option>
                      <option value={UserRole.VIEWER}>Viewer</option>
                      {/* Only show "Admin" option if the current user is a Master Admin */}
                      <option
                        value={UserRole.ADMIN}
                        disabled={!isMasterAdmin}
                        title={
                          !isMasterAdmin
                            ? "Only Master Admins can promote to Admin"
                            : ""
                        }
                      >
                        Admin
                      </option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Only show Delete button if:
                        1. The current user is a Master Admin
                        2. The target user is NOT a Master Admin
                        3. The target is NOT the current user
                    */}
                    {isMasterAdmin &&
                      !isTargetMaster &&
                      user.id !== currentUser.uid && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete User
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;