'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

type Client = {
  customerPhone: string;
  customerName: string;
  customerCity: string;
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  cancelledOrders: number;
  inStoreSales: number;
  lastOrderDate: string;
  firstOrderDate: string;
  deliverySuccessRate?: number;
};

const ALLOWED_ROLES = ['ADMIN'];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasPrevPage: false,
    hasNextPage: false,
  });
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
      if (!ALLOWED_ROLES.includes(userData.role)) {
        router.push('/dashboard');
        return;
      }
      setUserRole(userData.role);
    }
  }, [router]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load clients when filters change
  useEffect(() => {
    if (userRole) loadClients();
  }, [userRole, pagination.page, search, source, sortBy]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (source) params.append('source', source);
      params.append('sortBy', sortBy);
      params.append('sortOrder', 'desc');
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await api.get(`/clients?${params.toString()}`);
      if (response.data.success) {
        setClients(response.data.data);
        if (response.data.pagination) {
          setPagination(prev => ({ ...prev, ...response.data.pagination }));
        }
      } else {
        toast.error(response.data.message || 'Erreur lors du chargement des clients');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors du chargement des clients';
      toast.error(errorMessage);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => `${amount.toFixed(2)} DH`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSource('');
    setSortBy('totalSpent');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = search || source || sortBy !== 'totalSpent';

  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

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
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
              <p className="text-gray-600 mt-2">Vue d'ensemble de tous les clients et leur historique d'achats</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md p-5 mb-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {/* Search */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="🔍  Rechercher par nom ou téléphone..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Sort by */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                  >
                    <option value="totalSpent">Trier : Total dépensé</option>
                    <option value="totalOrders">Trier : Nb commandes</option>
                    <option value="lastOrderDate">Trier : Dernière commande</option>
                  </select>
                </div>

                {/* Clear */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {/* Source filter */}
              <div className="flex items-center gap-2">
                {(['', 'online', 'magasin'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSource(s); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      source === s
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s === '' ? 'Tous' : s === 'online' ? 'Online' : 'Magasin'}
                  </button>
                ))}
                {pagination.total > 0 && (
                  <span className="ml-auto text-sm text-gray-500">{pagination.total} client(s)</span>
                )}
              </div>
            </div>

            {/* Clients Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500 text-lg">Aucun client trouvé</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Téléphone</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ville</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Commandes</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Dépensé</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dernière Commande</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {clients.map((client) => {
                          const onlineCount = client.totalOrders - (client.inStoreSales || 0);
                          const magasinCount = client.inStoreSales || 0;
                          return (
                            <tr key={client.customerPhone} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-900">{client.customerName}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-600">{client.customerPhone}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-600">{client.customerCity || '—'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-sm">
                                  {onlineCount > 0 && (
                                    <span className="text-orange-600 font-medium">{onlineCount} online</span>
                                  )}
                                  {onlineCount > 0 && magasinCount > 0 && (
                                    <span className="text-gray-300">·</span>
                                  )}
                                  {magasinCount > 0 && (
                                    <span className="text-purple-600 font-medium">{magasinCount} magasin</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-green-600">{formatAmount(client.totalSpent)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-600">{formatDate(client.lastOrderDate)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={!pagination.hasPrevPage}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Précédent
                      </button>
                      <span className="text-sm text-gray-600">Page {pagination.page} sur {pagination.totalPages}</span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
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
    </>
  );
}
