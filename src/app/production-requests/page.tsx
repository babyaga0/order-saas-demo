'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';

interface ProductionRequest {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  destinationStore: {
    id: string;
    name: string;
  };
  dueDate: string | null;
  estimatedQuantity: number;
  createdAt: string;
  createdBy: {
    fullName: string;
    email: string;
  };
  items: any[];
}

export default function ProductionRequestsPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'FACTORY_MANAGER'];

      if (!allowedRoles.includes(user.role)) {
        router.push('/dashboard');
        return;
      }

      setUserRole(user.role);
    }
  }, [router]);

  // Debounce search input — wait 300ms after user stops typing before fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (userRole) {
      fetchRequests();
    }
  }, [userRole, filters]);

  const LIST_CACHE_KEY = 'prod_requests_list_cache';
  const LIST_CACHE_TTL = 2 * 60 * 1000;

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      // Show cached data instantly for default view (page 1, no search)
      const isDefaultView = !filters.search && filters.page === 1;
      if (isDefaultView) {
        const cached = localStorage.getItem(LIST_CACHE_KEY);
        if (cached) {
          const { data, pagination: cachedPagination, ts } = JSON.parse(cached);
          if (Date.now() - ts < LIST_CACHE_TTL) {
            setRequests(data);
            setPagination(cachedPagination);
            setLoading(false);
          }
        }
      }

      const response = await api.get(`/production-requests?${params.toString()}`);

      if (response.data.success) {
        setRequests(response.data.data);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
        // Cache default view
        if (isDefaultView) {
          localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({
            data: response.data.data,
            pagination: response.data.pagination,
            ts: Date.now(),
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
      ACCEPTE: 'bg-green-100 text-green-800',
      REFUSE: 'bg-red-100 text-red-800',
      EN_PRODUCTION: 'bg-blue-100 text-blue-800',
      CONTROLE_QUALITE: 'bg-purple-100 text-purple-800',
      QUALITE_VALIDEE: 'bg-green-100 text-green-800',
      QUALITE_REFUSEE: 'bg-red-100 text-red-800',
      TERMINE: 'bg-green-100 text-green-800',
      EXPEDIE: 'bg-teal-100 text-teal-800',
      ANNULE: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En Attente',
      ACCEPTE: 'Accepté',
      REFUSE: 'Refusé',
      EN_PRODUCTION: 'En Production',
      CONTROLE_QUALITE: 'Contrôle Qualité',
      QUALITE_VALIDEE: 'Qualité Validée',
      QUALITE_REFUSEE: 'Qualité Refusée',
      TERMINE: 'Terminé',
      EXPEDIE: 'Expédié',
      ANNULE: 'Annulé',
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      FAIBLE: 'text-gray-600',
      MOYEN: 'text-blue-600',
      ELEVE: 'text-orange-600',
      URGENT: 'text-red-600',
    };
    return colors[priority] || 'text-gray-600';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      FAIBLE: 'Faible',
      MOYEN: 'Moyen',
      ELEVE: 'Élevé',
      URGENT: 'Urgent',
    };
    return labels[priority] || priority;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Toaster position="top-right" />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Demandes de Production</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gérez les demandes de production pour l'usine
              </p>
            </div>

            {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'PRODUCTION' || userRole === 'FACTORY_MANAGER') && (
              <button
                onClick={() => router.push('/production-requests/new')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                + Nouvelle Demande
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Rechercher par numéro, titre..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Request List - Horizontal Cards */}
        <div className="px-6 py-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Chargement des demandes...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-600 mt-4">Aucune demande de production trouvée</p>
              {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'PRODUCTION' || userRole === 'FACTORY_MANAGER') && (
                <button
                  onClick={() => router.push('/production-requests/new')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Créer une demande
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => router.push(`/production-requests/${request.id}`)}
                >
                  <div className="flex items-center gap-4">
                    {/* Request Icon */}
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>

                    {/* Request Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{request.title}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                        <span className="font-mono">{request.requestNumber}</span>
                        {request.destinationStore && (
                          <>
                            <span>•</span>
                            <span>Vers: {request.destinationStore.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>Qté: {request.estimatedQuantity || request.items.length}</span>
                        <span>•</span>
                        <span>Par: {request.createdBy.fullName}</span>
                        {request.dueDate && (
                          <>
                            <span>•</span>
                            <span>Échéance: {formatDate(request.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/production-requests/${request.id}`);
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                      >
                        Voir Détails
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Affichage de {requests.length} sur {pagination.total} demandes
              </p>

              <div className="flex gap-2">
                <button
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Précédent
                </button>
                <span className="px-4 py-2 border rounded-lg bg-blue-50">
                  {filters.page} / {pagination.totalPages}
                </span>
                <button
                  disabled={!pagination.hasNextPage}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
