'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import api from '@/lib/api';

interface OrderStats {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    returned: number;
  };
  revenue: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  productId: number;
  productVariationId: number | null;
  storeId: string;
  quantity: number;
  product: {
    id: number;
    name: string;
    shortCode: string;
  };
  productVariation: {
    id: number;
    size: string;
    length: string;
  } | null;
  store: {
    id: string;
    name: string;
  };
}

const DASH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const DASH_STATS_KEY = 'dashboard_stats';
const DASH_STATS_TS_KEY = 'dashboard_stats_ts';
const DASH_ORDERS_KEY = 'dashboard_orders';
const DASH_ORDERS_TS_KEY = 'dashboard_orders_ts';
const DASH_ALERTS_KEY = 'dashboard_alerts';
const DASH_ALERTS_TS_KEY = 'dashboard_alerts_ts';

export default function DashboardPage() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();

  // Auth check + data load in a single effect — eliminates the sequential render delay
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    const userData = localStorage.getItem('user');
    if (!userData) return;

    const user = JSON.parse(userData);
    setUserName(user.fullName || user.email);

    if (user.role === 'STAFF') { router.push('/orders'); return; }
    if (user.role === 'FACTORY_MANAGER') { router.push('/stock'); return; }
    if (user.role === 'STORE_CASHIER') {
      const storeSlug = user.store?.name
        ? user.store.name.toLowerCase().replace(/\s+/g, '-')
        : 'casablanca-centre';
      router.push(`/pos/${storeSlug}`);
      return;
    }

    setUserRole(user.role);
    // Start loading data immediately — no need to wait for a second render cycle
    loadDashboardData(user.role);
  }, [router]);

  const loadDashboardData = async (role?: string) => {
    const effectiveRole = role || userRole;
    const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'FACTORY_MANAGER'].includes(effectiveRole);

    // Show from localStorage cache instantly
    try {
      const cachedStats = localStorage.getItem(DASH_STATS_KEY);
      const cachedOrders = localStorage.getItem(DASH_ORDERS_KEY);
      const cachedAlerts = localStorage.getItem(DASH_ALERTS_KEY);
      const statsTs = parseInt(localStorage.getItem(DASH_STATS_TS_KEY) || '0');
      const ordersTs = parseInt(localStorage.getItem(DASH_ORDERS_TS_KEY) || '0');
      const alertsTs = parseInt(localStorage.getItem(DASH_ALERTS_TS_KEY) || '0');
      const now = Date.now();

      const statsOk = cachedStats && now - statsTs < DASH_CACHE_TTL;
      const ordersOk = cachedOrders && now - ordersTs < DASH_CACHE_TTL;
      const alertsOk = !isAdminRole || (cachedAlerts && now - alertsTs < DASH_CACHE_TTL);

      if (cachedStats) setStats(JSON.parse(cachedStats));
      if (cachedOrders) setRecentOrders(JSON.parse(cachedOrders));
      if (cachedAlerts && isAdminRole) setLowStockItems(JSON.parse(cachedAlerts));

      if (statsOk && ordersOk && alertsOk) {
        setLoading(false);
        return; // all caches fresh — skip API
      }

      if (cachedStats || cachedOrders) setLoading(false); // show skeleton-free instantly
    } catch { /* ignore cache errors */ }

    // Fetch from API (first load or stale)
    try {
      const promises: Promise<any>[] = [
        api.get('/orders/stats'),
        api.get('/orders?limit=5&sortBy=createdAt&sortOrder=desc'),
      ];

      if (isAdminRole) {
        promises.push(api.get('/stock/alerts?threshold=5'));
      }

      const [statsResponse, ordersResponse, stockResponse] = await Promise.all(promises);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
        try {
          localStorage.setItem(DASH_STATS_KEY, JSON.stringify(statsResponse.data.data));
          localStorage.setItem(DASH_STATS_TS_KEY, Date.now().toString());
        } catch { /* storage full */ }
      }

      if (ordersResponse.data.success) {
        const ordersData = ordersResponse.data.data;
        const orders = Array.isArray(ordersData.orders || ordersData)
          ? (ordersData.orders || ordersData).slice(0, 5)
          : [];
        setRecentOrders(orders);
        try {
          localStorage.setItem(DASH_ORDERS_KEY, JSON.stringify(orders));
          localStorage.setItem(DASH_ORDERS_TS_KEY, Date.now().toString());
        } catch { /* storage full */ }
      }

      if (stockResponse?.data.success) {
        setLowStockItems(stockResponse.data.data || []);
        try {
          localStorage.setItem(DASH_ALERTS_KEY, JSON.stringify(stockResponse.data.data || []));
          localStorage.setItem(DASH_ALERTS_TS_KEY, Date.now().toString());
        } catch { /* storage full */ }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' DH';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      SENT_TO_DELIVERY: 'bg-indigo-100 text-indigo-800',
      SHIPPED: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      RETURNED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En Attente',
      CONFIRMED: 'Confirmée',
      SENT_TO_DELIVERY: 'Envoyée',
      SHIPPED: 'Expédiée',
      DELIVERED: 'Livrée',
      CANCELLED: 'Annulée',
      RETURNED: 'Retournée',
    };
    return labels[status] || status;
  };

  const statCards = [
    {
      title: 'Total Commandes',
      value: stats?.total || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
      gradient: 'from-orange-400 to-orange-600',
      link: '/orders/all',
    },
    {
      title: 'Chiffre d\'Affaires',
      value: formatCurrency(stats?.revenue || 0),
      isRevenue: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-400 to-green-600',
      link: null,
    },
    {
      title: 'En Attente',
      value: stats?.byStatus?.pending || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-yellow-400 to-yellow-600',
      link: '/orders?status=PENDING',
    },
    {
      title: 'Confirmées',
      value: stats?.byStatus?.confirmed || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-blue-400 to-blue-600',
      link: '/orders/validated',
    },
    {
      title: 'Livrées',
      value: stats?.byStatus?.delivered || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      gradient: 'from-emerald-400 to-emerald-600',
      link: '/orders/sent?status=DELIVERED',
    },
    {
      title: 'Retournées',
      value: stats?.byStatus?.returned || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      gradient: 'from-red-400 to-red-600',
      link: '/orders/sent?status=RETURNED',
    },
  ];

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Don't render until role is verified
  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Tableau de Bord
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-2">
              Bienvenue, <span className="font-semibold text-orange-600">{userName}</span>
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                {statCards.map((card, index) => (
                  <div
                    key={index}
                    onClick={() => card.link && router.push(card.link)}
                    className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 ${
                      card.link ? 'cursor-pointer transform hover:-translate-y-1' : ''
                    }`}
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wide">
                            {card.title}
                          </p>
                          <p className={`${card.isRevenue ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'} font-bold text-gray-900 mt-2`}>
                            {card.value}
                          </p>
                        </div>
                        <div className={`bg-gradient-to-br ${card.gradient} w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0 ml-4 shadow-lg`}>
                          {card.icon}
                        </div>
                      </div>
                    </div>
                    {card.link && (
                      <div className={`h-1 bg-gradient-to-r ${card.gradient}`}></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Status Breakdown */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    Répartition des Statuts
                  </h2>
                  <div className="space-y-4">
                    {[
                      { label: 'En Attente', value: stats?.byStatus?.pending || 0, color: 'bg-yellow-500' },
                      { label: 'Confirmées', value: stats?.byStatus?.confirmed || 0, color: 'bg-blue-500' },
                      { label: 'Expédiées', value: stats?.byStatus?.shipped || 0, color: 'bg-purple-500' },
                      { label: 'Livrées', value: stats?.byStatus?.delivered || 0, color: 'bg-green-500' },
                      { label: 'Annulées', value: stats?.byStatus?.cancelled || 0, color: 'bg-red-500' },
                      { label: 'Retournées', value: stats?.byStatus?.returned || 0, color: 'bg-gray-500' },
                    ].map((item, index) => (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-semibold">
                            {item.value} ({calculatePercentage(item.value, stats?.total || 0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                            style={{ width: `${calculatePercentage(item.value, stats?.total || 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                      Commandes Récentes
                    </h2>
                    <button
                      onClick={() => router.push('/orders')}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Voir tout →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {recentOrders.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Aucune commande</p>
                    ) : (
                      recentOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => router.push(`/orders/${order.id}`)}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {order.orderNumber}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {order.customerName}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-medium text-gray-900">
                              {formatCurrency(order.totalAmount)}
                            </p>
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Low Stock Alerts - Only for ADMIN, SUPER_ADMIN, FACTORY_MANAGER */}
              {['ADMIN', 'SUPER_ADMIN', 'FACTORY_MANAGER'].includes(userRole) && (
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-6 h-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <h2 className="text-lg font-bold text-gray-900">
                        Alertes de Stock Faible
                      </h2>
                      {lowStockItems.length > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          {lowStockItems.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => router.push('/stock')}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Voir stock →
                    </button>
                  </div>

                  {lowStockItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        className="mx-auto h-12 w-12 text-green-400 mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm">Aucune alerte de stock faible</p>
                      <p className="text-xs text-gray-400 mt-1">Tous les produits ont un stock suffisant</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">
                                {item.product.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {item.productVariation
                                  ? `${item.productVariation.size}/${item.productVariation.length}`
                                  : item.product.shortCode}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.store.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 ml-4">
                            <div className="text-right">
                              <span className="text-2xl font-bold text-red-600">
                                {item.quantity}
                              </span>
                              <p className="text-xs text-gray-500">unités</p>
                            </div>
                            <button
                              onClick={() => router.push('/production-requests/new')}
                              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                            >
                              Créer demande
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Actions Rapides</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => router.push('/orders/new')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Nouvelle Commande</span>
                  </button>
                  <button
                    onClick={() => router.push('/orders')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg font-semibold hover:from-gray-600 hover:to-gray-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Voir Commandes</span>
                  </button>
                  <button
                    onClick={() => router.push('/orders/validated')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Commandes Validées</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
