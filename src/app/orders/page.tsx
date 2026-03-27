'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/Modal';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  totalAmount: string;
  status: 'PENDING' | 'CONFIRMED' | 'SENT_TO_DELIVERY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
  source: 'MANUAL' | 'WOOCOMMERCE' | 'WHATSAPP';
  createdAt: string;
  deliveryTrackingId?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [staffUsers, setStaffUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserRole(userData.role);
      setCurrentUserId(userData.id);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      loadStaffUsers();
    }
  }, [userRole]);

  useEffect(() => {
    if (currentUserId) {
      loadOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, userRole, currentUserId, selectedUserId]);

  const loadStaffUsers = async () => {
    try {
      const response = await api.get('/users');
      if (response.data.success) {
        const staff = response.data.data.filter((u: any) => u.role === 'STAFF' && u.isActive);
        setStaffUsers(staff);
      }
    } catch (error) {
      console.error('Failed to load staff users:', error);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      // STAFF users only see their own orders
      if (userRole === 'STAFF' && currentUserId) {
        params.append('createdBy', currentUserId);
      }

      // ADMIN can filter by selected user
      if ((userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && selectedUserId) {
        params.append('createdBy', selectedUserId);
      }

      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', 'desc');

      const response = await api.get(`/orders?${params.toString()}`);

      if (response.data.success) {
        // Filter out CONFIRMED orders - they go to "Validées" page
        let filteredOrders = response.data.data;
        if (!filters.status) {
          // Only filter if no specific status is selected
          filteredOrders = response.data.data.filter(
            (order: Order) => order.status === 'PENDING' || order.status === 'CANCELLED'
          );
        }
        setOrders(filteredOrders);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const handleBulkDelete = async () => {
    setDeleteLoading(true);
    try {
      await Promise.all(selectedOrders.map(id => api.delete(`/orders/${id}`)));
      toast.success('Commandes supprimées avec succès');
      setSelectedOrders([]);
      setShowDeleteModal(false);
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    // If sending to delivery, actually send to Cathedis API
    if (newStatus === 'SENT_TO_DELIVERY') {
      handleBulkSendToDelivery();
      return;
    }

    // For other status changes, just update the status
    try {
      await Promise.all(
        selectedOrders.map(id =>
          api.put(`/orders/${id}`, { status: newStatus })
        )
      );
      toast.success('Statut mis à jour avec succès');
      setSelectedOrders([]);
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleBulkSendToDelivery = async () => {
    const loadingToast = toast.loading(`Envoi de ${selectedOrders.length} commande(s) à Cathedis...`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      // Send each order to Cathedis
      const results = await Promise.allSettled(
        selectedOrders.map(async (id) => {
          // Get order details first
          const orderResponse = await api.get(`/orders/${id}`);
          const order = orderResponse.data.data;

          // Skip WooCommerce orders with no store or orderItems — products not selected yet
          if (order.source === 'WOOCOMMERCE' && (!order.sourceStoreId || !order.orderItems || order.orderItems === 'null')) {
            skippedCount++;
            return;
          }

          // Send to Cathedis
          const deliveryCity = order.customerCity?.toUpperCase() || 'CASABLANCA';
          const deliverySector = 'Centre Ville';

          return api.post(`/delivery/send/${id}`, {
            deliveryCity,
            deliverySector,
          });
        })
      );

      // Count successes and errors
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value !== undefined) {
          successCount++;
        } else if (result.status === 'rejected') {
          errorCount++;
        }
      });

      const skippedMsg = skippedCount > 0 ? `, ${skippedCount} ignorée(s) (produits manquants)` : '';
      if (errorCount === 0) {
        toast.success(`${successCount} commande(s) envoyée(s) avec succès!${skippedMsg}`, {
          id: loadingToast,
          duration: 5000,
        });
      } else {
        toast.success(`${successCount} envoyée(s), ${errorCount} erreur(s)${skippedMsg}`, {
          id: loadingToast,
          duration: 5000,
        });
      }

      setSelectedOrders([]);
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi groupé', {
        id: loadingToast,
      });
    }
  };

  const handleInlineStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      loadOrders();
    } catch (error) {
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleOrderClick = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: string) => {
    return `${parseFloat(amount).toFixed(2)} DH`;
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      CONFIRMED: 'bg-green-100 text-green-800 border-green-300',
      SENT_TO_DELIVERY: 'bg-blue-100 text-blue-800 border-blue-300',
      SHIPPED: 'bg-purple-100 text-purple-800 border-purple-300',
      DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      CANCELLED: 'bg-red-100 text-red-800 border-red-300',
      RETURNED: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="flex">
        <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Toutes les Commandes</h1>
              <p className="text-gray-600 mt-2">
                Gérez toutes vos commandes en un seul endroit
              </p>
            </div>
            <button
              onClick={() => router.push('/orders/new')}
              className="px-6 py-3 bg-orange-400 text-white rounded-lg font-semibold hover:bg-orange-500 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nouvelle Commande</span>
            </button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedOrders.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-md p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-semibold text-orange-800">
                  {selectedOrders.length} commande(s) sélectionnée(s)
                </span>
                <button
                  onClick={() => setSelectedOrders([])}
                  className="text-sm text-orange-600 hover:text-orange-800"
                >
                  Désélectionner tout
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusChange(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-4 py-2 border border-orange-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Changer le statut</option>
                  <option value="PENDING">En Attente</option>
                  <option value="CONFIRMED">Confirmée</option>
                  <option value="CANCELLED">Annulée</option>
                </select>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rechercher
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Nom, téléphone, numéro de commande..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Tous les statuts</option>
                  <option value="PENDING">En Attente</option>
                  <option value="CANCELLED">Annulée</option>
                </select>
              </div>

              {/* User Filter - ADMIN only */}
              {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Créé par
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setFilters({ ...filters, page: 1 });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Tous les utilisateurs</option>
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-gray-600">
              {pagination.total > 0 && (
                <span>
                  Affichage de {(filters.page - 1) * filters.limit + 1} à{' '}
                  {Math.min(filters.page * filters.limit, pagination.total)} sur{' '}
                  {pagination.total} commandes
                </span>
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20">
                <svg
                  className="w-16 h-16 text-gray-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-gray-500 text-lg">Aucune commande trouvée</p>
                <p className="text-gray-400 mt-2">
                  Essayez de modifier vos filtres ou créez une nouvelle commande
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left">
                          <input
                            type="checkbox"
                            checked={selectedOrders.length === orders.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          N° Commande
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Téléphone
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Ville
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Créé par
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedOrders.includes(order.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectOrder(order.id);
                              }}
                              className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm font-semibold text-gray-900">
                              {order.orderNumber}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm text-gray-900">
                              {order.customerName}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm text-gray-600">
                              {order.customerPhone}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm text-gray-600">
                              {order.customerCity}
                            </span>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm font-semibold text-gray-900">
                              {formatAmount(order.totalAmount)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={order.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleInlineStatusChange(order.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 ${getStatusColor(order.status)}`}
                            >
                              <option value="PENDING">En Attente</option>
                              <option value="CONFIRMED">Confirmée</option>
                              <option value="CANCELLED">Annulée</option>
                            </select>
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            {order.createdBy ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold">
                                  {order.createdBy.fullName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-gray-600">
                                  {order.createdBy.fullName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600">
                                {order.source === 'WOOCOMMERCE' ? 'WooCommerce' : order.source === 'WHATSAPP' ? 'WhatsApp' : 'Système'}
                              </span>
                            )}
                          </td>
                          <td
                            className="px-6 py-4 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            <span className="text-sm text-gray-600">
                              {formatDate(order.createdAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                    <button
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={!pagination.hasPrevPage}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {filters.page} sur {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={!pagination.hasNextPage}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>

    {/* Delete Confirmation Modal */}
    <ConfirmModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={handleBulkDelete}
      title="Supprimer les commandes"
      message={`Voulez-vous vraiment supprimer ${selectedOrders.length} commande(s) ? Cette action est irréversible.`}
      confirmText="Supprimer"
      cancelText="Annuler"
      type="danger"
      loading={deleteLoading}
    />
    </>
  );
}
