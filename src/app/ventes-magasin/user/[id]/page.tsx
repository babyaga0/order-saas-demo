'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';

type Sale = {
  id: string;
  saleNumber: string;
  customerPhone: string | null;
  paymentMethod: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
};

type Stats = {
  total: { count: number; amount: number };
  today: { count: number; amount: number };
  thisMonth: { count: number; amount: number };
  byPaymentMethod: { method: string; count: number; amount: number }[];
};

export default function UserVentesPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { isSidebarCollapsed } = useLayout();

  const [user, setUser] = useState<any>(null);
  const [staffUser, setStaffUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      // Only admin can view this page
      if (parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN') {
        router.push('/ventes-magasin');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (user && userId) {
      loadStaffUser();
      loadStats();
      loadSales();
    }
  }, [user, userId, page, filterStartDate, filterEndDate, filterPaymentMethod]);

  const loadStaffUser = async () => {
    try {
      const response = await api.get(`/users/${userId}`);
      if (response.data.success) {
        setStaffUser(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load staff user:', error);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      params.append('staffId', userId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const response = await api.get(`/in-store-sales/stats?${params.toString()}`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      params.append('staffId', userId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterPaymentMethod) params.append('paymentMethod', filterPaymentMethod);

      const response = await api.get(`/in-store-sales?${params.toString()}`);
      if (response.data.success) {
        setSales(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to load sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'Espèces';
      case 'CARD':
        return 'Carte';
      case 'MIXED':
        return 'Mixte';
      default:
        return method;
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => router.push('/ventes-magasin')}
                className="text-gray-600 hover:text-gray-900 flex items-center space-x-2 mb-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Retour</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-800">
                Ventes de {staffUser?.fullName || 'Chargement...'}
              </h1>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-medium text-blue-800">Aujourd'hui</h3>
                <p className="text-2xl font-bold text-blue-900">
                  {formatPrice(Number(stats.today.amount))}
                </p>
                <p className="text-sm text-blue-700">{stats.today.count} ventes</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="text-sm font-medium text-green-800">Ce Mois</h3>
                <p className="text-2xl font-bold text-green-900">
                  {formatPrice(Number(stats.thisMonth.amount))}
                </p>
                <p className="text-sm text-green-700">{stats.thisMonth.count} ventes</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="text-sm font-medium text-purple-800">Total</h3>
                <p className="text-2xl font-bold text-purple-900">
                  {formatPrice(Number(stats.total.amount))}
                </p>
                <p className="text-sm text-purple-700">{stats.total.count} ventes</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Début
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Fin
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paiement
                </label>
                <select
                  value={filterPaymentMethod}
                  onChange={(e) => {
                    setFilterPaymentMethod(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                >
                  <option value="">Tous</option>
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte</option>
                  <option value="MIXED">Mixte</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Chargement...</div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Aucune vente trouvée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        N° Vente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Articles
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paiement
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {sale.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="max-w-xs">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.quantity}x {item.productName}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              sale.paymentMethod === 'CASH'
                                ? 'bg-green-100 text-green-800'
                                : sale.paymentMethod === 'CARD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {formatPrice(Number(sale.totalAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} sur {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
