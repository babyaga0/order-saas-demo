'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/Modal';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';

type Store = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    users: number;
    inStoreSales: number;
  };
};

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PHYSICAL' as 'PHYSICAL' | 'ONLINE',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    // Check authentication and SUPER_ADMIN role
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token) {
      router.push('/login');
      return;
    }
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUserRole(user.role);
      // Only SUPER_ADMIN can access this page
      if (user.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
        return;
      }
    }
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await api.get('/stores');
      if (response.data.success) {
        setStores(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
      toast.error('Erreur lors du chargement des magasins');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = () => {
    setEditingStore(null);
    setFormData({
      name: '',
      type: 'PHYSICAL',
    });
    setShowModal(true);
  };

  const handleEditStore = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      type: store.type as 'PHYSICAL' | 'ONLINE',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Le nom du magasin est requis');
      return;
    }

    try {
      if (editingStore) {
        // Update store
        const response = await api.put(`/stores/${editingStore.id}`, formData);
        if (response.data.success) {
          toast.success('Magasin mis à jour avec succès!');
          setShowModal(false);
          loadStores();
        }
      } else {
        // Create store
        const response = await api.post('/stores', formData);
        if (response.data.success) {
          toast.success('Magasin créé avec succès!');
          setShowModal(false);
          loadStores();
        }
      }
    } catch (error: any) {
      console.error('Failed to save store:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleToggleStatus = async (storeId: string, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/stores/${storeId}/status`, {
        isActive: !currentStatus,
      });
      if (response.data.success) {
        toast.success(`Magasin ${!currentStatus ? 'activé' : 'désactivé'} avec succès!`);
        loadStores();
      }
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la modification du statut');
    }
  };

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await api.delete(`/stores/${storeToDelete.id}`);
      if (response.data.success) {
        toast.success('Magasin supprimé avec succès!');
        setShowDeleteModal(false);
        setStoreToDelete(null);
        loadStores();
      }
    } catch (error: any) {
      console.error('Failed to delete store:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleteLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'} min-h-screen p-4 sm:p-6 lg:p-8`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Magasins</h1>
            <p className="text-gray-600 mt-2">
              Gérez les magasins physiques et leurs informations
            </p>
          </div>
          <button
            onClick={handleCreateStore}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nouveau Magasin</span>
          </button>
        </div>

        {/* Stores Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">Aucun magasin trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div
                key={store.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
              >
                {/* Store Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white text-xl">
                      🏪
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{store.name}</h3>
                      <p className="text-xs text-gray-500">{store.type}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      store.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {store.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* Store Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-600">
                      {store._count?.users || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Employés</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {store._count?.inStoreSales || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Ventes</p>
                  </div>
                </div>

                {/* Store Info */}
                <div className="text-center text-xs text-gray-500 mb-4">
                  Créé le {formatDate(store.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleEditStore(store)}
                    className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleToggleStatus(store.id, store.isActive)}
                    className="flex-1 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg font-medium transition-colors"
                  >
                    {store.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => {
                      setStoreToDelete(store);
                      setShowDeleteModal(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Store Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingStore ? 'Modifier Magasin' : 'Nouveau Magasin'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom du Magasin
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Casablanca Centre, Rabat Agdal..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PHYSICAL' | 'ONLINE' })}
                  className="input-field"
                >
                  <option value="PHYSICAL">Magasin Physique</option>
                  <option value="ONLINE">En Ligne</option>
                </select>
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingStore ? 'Mettre à Jour' : 'Créer'}
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
          setStoreToDelete(null);
        }}
        onConfirm={handleDeleteStore}
        title="Supprimer le magasin"
        message={`Voulez-vous vraiment supprimer le magasin "${storeToDelete?.name}" ? Cette action est irréversible et supprimera également toutes les données associées.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        loading={deleteLoading}
      />

      <Toaster position="top-right" />
    </div>
  );
}
