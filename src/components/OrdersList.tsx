'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  deliveryStatus?: string | null;      // Cathedis delivery status (French)
  paymentStatus?: string | null;       // Cathedis payment status (PAID/UNPAID)
  returnStatus?: string | null;        // Cathedis return status (tracks returns)
  deliveryTrackingId?: string | null;
  isExchange?: boolean;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
};

interface OrdersListProps {
  source?: string;
  createdBy?: string;
  status?: string;
  showCreator?: boolean;
  title: string;
  description: string;
  hideStatusDropdown?: boolean; // Hide status dropdown for validated orders
  filterOptions?: string[]; // Custom filter options for each page
  sentToDelivery?: boolean; // Filter only orders sent to delivery company
  useCathedisFilter?: boolean; // Use Cathedis deliveryStatus filter instead of status filter
  forceOwnOrdersOnly?: boolean; // Force staff to see only their own orders (ignores canSendAllOrders)
  showStaffFilter?: boolean; // Show staff filter dropdown for admin
  showCathedisColumns?: boolean; // Show 3 Cathedis status columns (only for delivered page)
  deliveryStatusFilter?: string; // Default deliveryStatus filter (e.g. "RETURNED" for archive retour)
  returnStatusFilter?: string; // Comma-separated returnStatus values to filter by (e.g. "new,in return processed,recuperated")
  paymentStatusFilter?: string; // Payment status filter (supports "!value" for exclusion, e.g. "!Retourné au client")
}

export default function OrdersList({ source, createdBy, status, showCreator = false, title, description, hideStatusDropdown = false, filterOptions, sentToDelivery, useCathedisFilter = false, forceOwnOrdersOnly = false, showStaffFilter = false, showCathedisColumns = false, deliveryStatusFilter, returnStatusFilter, paymentStatusFilter }: OrdersListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [canSendToDelivery, setCanSendToDelivery] = useState<boolean>(false);
  const [staffUsers, setStaffUsers] = useState<Array<{id: string, fullName: string, email: string}>>([]);
  const [filters, setFilters] = useState({
    status: '',
    deliveryStatus: '',
    search: '',
    createdBy: '',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserRole(userData.role);
      setCanSendToDelivery(userData.canSendToDelivery || false);
    }
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, source, createdBy, status, sentToDelivery, deliveryStatusFilter, returnStatusFilter, paymentStatusFilter]);

  // Load staff users if showStaffFilter is enabled
  useEffect(() => {
    if (showStaffFilter) {
      loadStaffUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStaffFilter]);

  const loadStaffUsers = async () => {
    try {
      // Fetch only STAFF users (not ADMIN or SUPER_ADMIN)
      const response = await api.get('/users?role=STAFF&isActive=true&sortBy=fullName&sortOrder=asc&limit=1000');
      if (response.data.success) {
        setStaffUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load staff users:', error);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Handle filter status or default filterOptions for sent page
      if (filters.status) {
        params.append('status', filters.status);
      } else if (status) {
        params.append('status', status);
      } else if (filterOptions && !filters.status) {
        // For sent page, show all delivery statuses by default
        // Don't add status param to show all matching filterOptions
      }

      if (filters.deliveryStatus) {
        params.append('deliveryStatus', filters.deliveryStatus);
      } else if (deliveryStatusFilter) {
        params.append('deliveryStatus', deliveryStatusFilter);
      }
      if (returnStatusFilter) params.append('returnStatus', returnStatusFilter);
      if (paymentStatusFilter) params.append('paymentStatus', paymentStatusFilter);
      if (filters.search) params.append('search', filters.search);
      if (source) params.append('source', source);

      // Handle createdBy filtering
      // If forceOwnOrdersOnly is true, STAFF users see only their own orders (ignores canSendAllOrders)
      if (createdBy) {
        params.append('createdBy', createdBy);
      } else if (filters.createdBy) {
        // Staff filter from dropdown
        params.append('createdBy', filters.createdBy);
      } else if (forceOwnOrdersOnly) {
        // Force STAFF to see only their own orders regardless of canSendAllOrders
        const user = localStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          // Only apply for STAFF role (not ADMIN or SUPER_ADMIN)
          if (userData.role === 'STAFF') {
            params.append('createdBy', userData.id);
          }
        }
      }

      if (sentToDelivery) params.append('sentToDelivery', 'true');
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', 'desc');

      const response = await api.get(`/orders?${params.toString()}`);

      if (response.data.success) {
        // If filterOptions is set and no specific filter.status, filter client-side
        let filteredOrders = response.data.data;
        if (filterOptions && !filters.status && !status) {
          filteredOrders = response.data.data.filter((order: Order) =>
            filterOptions.includes(order.status)
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
    const loadingToast = toast.loading(`Suppression de ${selectedOrders.length} commande(s)...`);

    try {
      await Promise.all(selectedOrders.map(id => api.delete(`/orders/${id}`)));
      toast.success('Commandes supprimées avec succès', {
        id: loadingToast,
      });
      setSelectedOrders([]);
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de la suppression', {
        id: loadingToast,
      });
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
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

  const handleInlineStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      toast.success('Statut mis à jour');
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handleBulkSendToDelivery = async () => {
    const loadingToast = toast.loading(`Envoi de ${selectedOrders.length} commande(s) à Cathedis...`);

    try {
      const results = await Promise.allSettled(
        selectedOrders.map(async (id) => {
          // Get order details to extract city
          const orderResponse = await api.get(`/orders/${id}`);
          const order = orderResponse.data.data;

          // Block WooCommerce orders with no source store or orderItems
          if (order.source === 'WOOCOMMERCE' && (!order.sourceStoreId || !order.orderItems || order.orderItems === 'null')) {
            throw new Error(`Commande ${order.orderNumber}: sélectionnez le magasin source avant d'envoyer`);
          }

          // Send to Cathedis with proper payload
          const deliveryCity = order.customerCity?.toUpperCase() || 'CASABLANCA';
          const deliverySector = 'Autre'; // Default sector for unlisted areas

          const response = await api.post(`/delivery/send/${id}`, {
            deliveryCity,
            deliverySector,
          });
          return { id, success: true, data: response.data };
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        toast.success(`${successful} envoyée(s), ${failed} erreur(s)`, {
          id: loadingToast,
          duration: 5000,
        });
      } else {
        toast.success(`${successful} commande(s) envoyée(s) avec succès!`, {
          id: loadingToast,
          duration: 5000,
        });
      }

      setSelectedOrders([]);
      loadOrders();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi à la livraison', {
        id: loadingToast,
      });
    }
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

  const getCathedisStatusDisplay = (status: string | null | undefined) => {
    if (!status) {
      return {
        label: '-',
        color: 'bg-gray-100 text-gray-600 border-gray-300'
      };
    }

    // Common Cathedis status colors
    const statusMap: { [key: string]: { label: string; color: string } } = {
      // Delivery statuses (French from Cathedis API)
      'Livré': { label: 'Livré', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      'Collecté': { label: 'Collecté', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      'Hub CATHEDIS': { label: 'Hub CATHEDIS', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      'En Attente Ramassage': { label: 'En Attente Ramassage', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      'Annulé': { label: 'Annulé', color: 'bg-red-100 text-red-800 border-red-300' },
      'Client Injoignable': { label: 'Client Injoignable', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'CRC': { label: 'CRC', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'Au Téléphone': { label: 'Au Téléphone', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      'Mise En Distribution': { label: 'Mise En Distribution', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'Confirmée Sous RDV': { label: 'Confirmée Sous RDV', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
      'Expédié vers hub destination': { label: 'Expédié vers hub', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      // Payment statuses (English from Cathedis API - converted to French)
      'PAID': { label: 'Payé', color: 'bg-green-100 text-green-800 border-green-300' },
      'UNPAID': { label: 'Non payé', color: 'bg-red-100 text-red-800 border-red-300' },
      // Legacy French payment statuses (for backwards compatibility)
      'Payé': { label: 'Payé', color: 'bg-green-100 text-green-800 border-green-300' },
      'Non payé': { label: 'Non payé', color: 'bg-red-100 text-red-800 border-red-300' },
      'Partiellement payé': { label: 'Partiellement payé', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      // Refund statuses (money returned to customer)
      'Retourné au client': { label: 'Retourné au client', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
      'back as return customer': { label: 'Retourné au client', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
      // Return statuses (from Cathedis returnStatus field)
      'new': { label: 'Nouveau', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      'in return processed': { label: 'En retour', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'recuperated': { label: 'Récupéré', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      'returned': { label: 'Retourné', color: 'bg-gray-100 text-gray-800 border-gray-300' },
    };

    return statusMap[status] || statusMap[status.toLowerCase()] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-300' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{description}</p>
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
        <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-md p-4 flex items-center justify-between">
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
            {!hideStatusDropdown && (
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
            )}
            {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || canSendToDelivery) && status === 'CONFIRMED' && (
              <button
                onClick={handleBulkSendToDelivery}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors text-sm flex items-center space-x-2"
              >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>Envoyer à Cathedis</span>
              </button>
            )}
            {userRole !== 'STAFF' && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className={showStaffFilter ? "md:col-span-1" : "md:col-span-2"}>
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

          {/* Staff Filter */}
          {showStaffFilter && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrer par utilisateur
              </label>
              <select
                value={filters.createdBy}
                onChange={(e) => handleFilterChange('createdBy', e.target.value)}
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

          {/* Status Filter */}
          {!status && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={useCathedisFilter ? filters.deliveryStatus : filters.status}
                onChange={(e) => handleFilterChange(useCathedisFilter ? 'deliveryStatus' : 'status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Tous les statuts</option>
                {useCathedisFilter ? (
                  /* Cathedis French statuses */
                  <>
                    <option value="Livré">Livré</option>
                    <option value="Hub CATHEDIS">Hub CATHEDIS</option>
                    <option value="Collecté">Collecté</option>
                    <option value="En Attente Ramassage">En Attente Ramassage</option>
                    <option value="Client Injoignable">Client Injoignable</option>
                    <option value="Annulé">Annulé</option>
                  </>
                ) : filterOptions ? (
                  filterOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === 'PENDING' ? 'En Attente' :
                       status === 'CONFIRMED' ? 'Confirmée' :
                       status === 'SENT_TO_DELIVERY' ? 'Envoyée' :
                       status === 'SHIPPED' ? 'Expédiée' :
                       status === 'DELIVERED' ? 'Livrée' :
                       status === 'CANCELLED' ? 'Annulée' :
                       status === 'RETURNED' ? 'Retournée' : status}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="PENDING">En Attente</option>
                    <option value="CONFIRMED">Confirmée</option>
                    <option value="CANCELLED">Annulée</option>
                  </>
                )}
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
                    <th className="px-2 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                      N° Cmd
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                      Client
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                      Tél
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                      Ville
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                      Montant
                    </th>
                    {!showCathedisColumns && (
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                        Statut
                      </th>
                    )}
                    {showCathedisColumns && (
                      <>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                          Livraison
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                          Paiement
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                          Retour
                        </th>
                      </>
                    )}
                    {showCreator && (
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
                        Créé par
                      </th>
                    )}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-tight">
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
                      <td className="px-2 py-3">
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
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-xs font-semibold text-gray-900">
                            {order.isExchange && <span className="mr-1">🔄</span>}
                            {order.orderNumber}
                          </span>
                          {order.isExchange && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Éch
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <span className="text-xs text-gray-900">
                          {order.customerName}
                        </span>
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <span className="text-xs text-gray-600">
                          {order.customerPhone}
                        </span>
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <span className="text-xs text-gray-600">
                          {order.customerCity}
                        </span>
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <span className="text-xs font-semibold text-gray-900">
                          {formatAmount(order.totalAmount)}
                        </span>
                      </td>
                      {!showCathedisColumns && (
                        <td className="px-3 py-3 whitespace-nowrap">
                          {hideStatusDropdown ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                              {order.deliveryStatus ? order.deliveryStatus :
                               order.status === 'CONFIRMED' ? 'Confirmée' :
                               order.status === 'SENT_TO_DELIVERY' ? 'Envoyée' :
                               order.status === 'SHIPPED' ? 'Expédiée' :
                               order.status === 'DELIVERED' ? 'Livrée' :
                               order.status === 'CANCELLED' ? 'Annulée' :
                               order.status === 'RETURNED' ? 'Retournée' :
                               'En Attente'}
                            </span>
                          ) : (
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
                          )}
                        </td>
                      )}
                      {showCathedisColumns && (
                        <>
                          <td
                            className="px-3 py-3 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            {(() => {
                              const statusDisplay = getCathedisStatusDisplay(order.deliveryStatus);
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusDisplay.color}`}>
                                  {statusDisplay.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td
                            className="px-3 py-3 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            {(() => {
                              const statusDisplay = getCathedisStatusDisplay(order.paymentStatus);
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusDisplay.color}`}>
                                  {statusDisplay.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td
                            className="px-3 py-3 whitespace-nowrap cursor-pointer"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            {(() => {
                              const statusDisplay = getCathedisStatusDisplay(order.returnStatus);
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusDisplay.color}`}>
                                  {statusDisplay.label}
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                      {showCreator && (
                        <td
                          className="px-3 py-3 whitespace-nowrap cursor-pointer"
                          onClick={() => handleOrderClick(order.id)}
                        >
                          {order.createdBy ? (
                            <div className="flex items-center space-x-1">
                              <div className="w-5 h-5 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold">
                                {order.createdBy.fullName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs text-gray-600">
                                {order.createdBy.fullName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {order.source === 'WOOCOMMERCE' ? 'WooCommerce' : order.source === 'WHATSAPP' ? 'WhatsApp' : 'Système'}
                            </span>
                          )}
                        </td>
                      )}
                      <td
                        className="px-3 py-3 whitespace-nowrap cursor-pointer"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <span className="text-xs text-gray-600">
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
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-center border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>

                  {/* Page Numbers */}
                  {(() => {
                    const pages = [];
                    const currentPage = filters.page;
                    const totalPages = pagination.totalPages;

                    // Always show first page
                    pages.push(1);

                    // Show ellipsis or pages before current
                    if (currentPage > 3) {
                      pages.push('...');
                    }

                    // Show pages around current page
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                      if (!pages.includes(i)) {
                        pages.push(i);
                      }
                    }

                    // Show ellipsis or pages after current
                    if (currentPage < totalPages - 2) {
                      pages.push('...');
                    }

                    // Always show last page
                    if (totalPages > 1 && !pages.includes(totalPages)) {
                      pages.push(totalPages);
                    }

                    return pages.map((page, index) => {
                      if (page === '...') {
                        return (
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-500">
                            ...
                          </span>
                        );
                      }

                      const isActive = page === currentPage;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page as number)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-orange-400 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
