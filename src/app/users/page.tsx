'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/Modal';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';

type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'STAFF' | 'SUPER_ADMIN' | 'STORE_CASHIER' | 'FACTORY_MANAGER';
  isActive: boolean;
  canSendToDelivery?: boolean;
  createdAt: string;
  storeId?: string;
  store?: {
    id: string;
    name: string;
  };
};

type Store = {
  id: string;
  name: string;
  type: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'STAFF' as 'ADMIN' | 'STAFF' | 'SUPER_ADMIN' | 'STORE_CASHIER' | 'FACTORY_MANAGER',
    storeId: '',
    canSendToDelivery: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownOpenUpward, setDropdownOpenUpward] = useState(false);

  useEffect(() => {
    // Check authentication and admin role
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token) {
      router.push('/login');
      return;
    }
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUserRole(user.role);
      setCurrentUserId(user.id);
      setCurrentUserName(user.fullName);
      setCurrentUserEmail(user.email);
      // Allow both ADMIN and SUPER_ADMIN to access this page
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
    }
    loadUsers();
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStores = async () => {
    try {
      const response = await api.get('/stores');
      if (response.data.success) {
        setStores(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'STAFF',
      storeId: '',
      canSendToDelivery: false,
    });
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      storeId: user.storeId || '',
      canSendToDelivery: user.canSendToDelivery || false,
      password: '',
    });
    setShowModal(true);
    setOpenDropdownId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate store is selected for STORE_CASHIER
    if (formData.role === 'STORE_CASHIER' && !formData.storeId) {
      toast.error('Veuillez sélectionner un magasin pour le caissier');
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updateData: any = {
          fullName: formData.fullName,
          email: formData.email,
          role: formData.role,
        };

        // Include storeId for STORE_CASHIER, null for others
        if (formData.role === 'STORE_CASHIER') {
          updateData.storeId = formData.storeId;
        } else {
          updateData.storeId = null;
        }

        const response = await api.put(`/users/${editingUser.id}`, updateData);
        if (response.data.success) {
          toast.success('Utilisateur mis à jour avec succès!');
          setShowModal(false);
          loadUsers();
        }
      } else {
        // Create user
        const createData: any = {
          ...formData,
          storeId: formData.role === 'STORE_CASHIER' ? formData.storeId : undefined,
        };

        const response = await api.post('/users', createData);
        if (response.data.success) {
          toast.success('Utilisateur créé avec succès!');
          setShowModal(false);
          loadUsers();
        }
      }
    } catch (error: any) {
      console.error('Failed to save user:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/users/${userId}/status`, {
        isActive: !currentStatus,
      });
      if (response.data.success) {
        toast.success(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'} avec succès!`);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la modification du statut');
    }
  };

  const handleToggleDeliveryPermission = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/users/${userId}/delivery-permission`, {
        canSendToDelivery: !currentStatus,
      });
      if (response.data.success) {
        toast.success(`Permission Cathedis ${!currentStatus ? 'activée' : 'désactivée'} avec succès!`);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Failed to toggle delivery permission:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la modification de la permission');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await api.delete(`/users/${userToDelete.id}`);
      if (response.data.success) {
        toast.success('Utilisateur supprimé avec succès!');
        setShowDeleteModal(false);
        setUserToDelete(null);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const response = await api.post(`/users/${userToResetPassword.id}/reset-password`, {
        newPassword,
      });
      if (response.data.success) {
        toast.success('Mot de passe réinitialisé avec succès!');
        setShowResetPasswordModal(false);
        setUserToResetPassword(null);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la réinitialisation');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDropdownToggle = (userId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openDropdownId === userId) {
      setOpenDropdownId(null);
      return;
    }

    // Check button position to determine if dropdown should open upward
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // If less than 200px space below and more space above, open upward
    setDropdownOpenUpward(spaceBelow < 200 && spaceAbove > spaceBelow);
    setOpenDropdownId(userId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'} min-h-screen p-4 sm:p-6 lg:p-8`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
            <p className="text-gray-600 mt-2">
              {currentUserRole === 'SUPER_ADMIN'
                ? 'Gérez les utilisateurs et leurs permissions'
                : 'Réinitialiser les mots de passe des utilisateurs'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {currentUserRole === 'ADMIN' && (
              <button
                onClick={() => {
                  setUserToResetPassword({
                    id: currentUserId,
                    email: currentUserEmail,
                    fullName: currentUserName,
                    role: 'ADMIN',
                    isActive: true,
                    createdAt: '',
                  });
                  setShowResetPasswordModal(true);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Mon Mot de Passe</span>
              </button>
            )}
            {(currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') && (
              <button
                onClick={handleCreateUser}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Nouvel Utilisateur</span>
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Magasin
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Envoi Cathedis
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date de Création
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {user.fullName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{user.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : user.role === 'STORE_CASHIER'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.store ? (
                          <span className="text-sm text-gray-900">{user.store.name}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role === 'STAFF' ? (
                          (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') ? (
                            <button
                              onClick={() => handleToggleDeliveryPermission(user.id, user.canSendToDelivery || false)}
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                user.canSendToDelivery
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {user.canSendToDelivery ? '🟢 ON' : '⚪ OFF'}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                user.canSendToDelivery
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {user.canSendToDelivery ? '✓ Oui' : 'Non'}
                            </span>
                          )
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* SUPER_ADMIN: Show buttons directly */}
                          {currentUserRole === 'SUPER_ADMIN' && (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => {
                                  setUserToResetPassword(user);
                                  setShowResetPasswordModal(true);
                                }}
                                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                              >
                                Mot de passe
                              </button>
                              <button
                                onClick={() => handleToggleStatus(user.id, user.isActive)}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {user.isActive ? 'Désactiver' : 'Activer'}
                              </button>
                              <button
                                onClick={() => {
                                  setUserToDelete(user);
                                  setShowDeleteModal(true);
                                }}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                Supprimer
                              </button>
                            </>
                          )}

                          {/* ADMIN: Show dropdown menu for STAFF users only */}
                          {currentUserRole === 'ADMIN' && ['STAFF', 'STORE_CASHIER', 'FACTORY_MANAGER'].includes(user.role) && (
                            <div className="relative">
                              <button
                                onClick={(e) => handleDropdownToggle(user.id, e)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Actions"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>

                              {/* Dropdown Menu */}
                              {openDropdownId === user.id && (
                                <>
                                  {/* Backdrop to close dropdown */}
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenDropdownId(null)}
                                  />
                                  {/* Dropdown content */}
                                  <div className={`absolute right-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 ${dropdownOpenUpward ? 'bottom-full mb-2' : 'mt-2'}`}>
                                    <div className="py-1">
                                      <button
                                        onClick={() => handleEditUser(user)}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Modifier</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setUserToResetPassword(user);
                                          setShowResetPasswordModal(true);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        <span>Réinitialiser MDP</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleToggleStatus(user.id, user.isActive);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center space-x-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={user.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                                        </svg>
                                        <span>{user.isActive ? 'Désactiver' : 'Activer'}</span>
                                      </button>
                                      {user.role === 'STAFF' && (
                                        <button
                                          onClick={() => {
                                            setUserToDelete(user);
                                            setShowDeleteModal(true);
                                            setOpenDropdownId(null);
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                          <span>Supprimer</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom Complet
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="input-field"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mot de Passe
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rôle
                </label>
                {currentUserRole === 'ADMIN' ? (
                  <div className="input-field bg-gray-50 text-gray-700">{formData.role}</div>
                ) : (
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'STAFF' | 'SUPER_ADMIN' | 'STORE_CASHIER' | 'FACTORY_MANAGER' })}
                    className="input-field"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="STORE_CASHIER">STORE_CASHIER</option>
                    <option value="FACTORY_MANAGER">FACTORY_MANAGER</option>
                  </select>
                )}
              </div>
              {formData.role === 'STORE_CASHIER' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Magasin
                  </label>
                  {editingUser ? (
                    <div className="input-field bg-gray-50 text-gray-700">
                      {stores.find(s => s.id === formData.storeId)?.name || '—'}
                    </div>
                  ) : (
                    <select
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Sélectionner un magasin</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {formData.role === 'STAFF' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="canSendToDelivery"
                    checked={formData.canSendToDelivery}
                    onChange={(e) => setFormData({ ...formData, canSendToDelivery: e.target.checked })}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="canSendToDelivery" className="text-sm font-medium text-gray-700">
                    Peut envoyer les commandes à Cathedis
                  </label>
                </div>
              )}
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingUser ? 'Mettre à Jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="Supprimer l'utilisateur"
        message={`Voulez-vous vraiment supprimer l'utilisateur "${userToDelete?.fullName}" (${userToDelete?.email}) ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        loading={deleteLoading}
      />

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Réinitialiser le mot de passe
            </h2>
            <p className="text-gray-600 mb-6">
              {userToResetPassword?.fullName} ({userToResetPassword?.email})
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="input-field"
                />
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setUserToResetPassword(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={resetPasswordLoading}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetPasswordLoading || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center"
                >
                  {resetPasswordLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    'Réinitialiser'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}
