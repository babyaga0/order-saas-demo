'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import api from '@/lib/api';
import { printStoreReport, StoreReportData } from '@/utils/storeReportGenerator';

const ALLOWED_ROLES = ['ADMIN'];

type StoreAnalytics = {
  period: {
    startDate: string;
    endDate: string;
  };
  sales: {
    count: number;
    totalAmount: number;
    totalDiscount: number;
    avgBasket: number;
  };
  returns: {
    count: number;
    byCondition: Array<{ condition: string; count: number }>;
  };
  byPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  dailySales: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    totalAmount: number;
    paymentMethod: string;
    itemCount: number;
    createdAt: string;
    createdBy: string;
    items?: Array<{
      productName: string;
      shortCode: string;
      size: string | null;
      length: string | null;
      quantity: number;
    }>;
  }>;
};

type StockAlert = {
  productId: string;
  productName: string;
  variationId: string | null;
  variationName: string | null;
  shortCode: string;
  quantity: number;
  storeName: string;
};

type Store = {
  id: string;
  name: string;
  slug: string;
};

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSidebarCollapsed } = useLayout();
  const storeSlug = params['store-slug'] as string;

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [store, setStore] = useState<Store | null>(null);
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);

  // Date range from URL or default to current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(
    searchParams.get('startDate') || firstDayOfMonth.toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') || today.toISOString().split('T')[0]
  );

  // Check authentication and set user role
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (!ALLOWED_ROLES.includes(user.role)) {
        router.push('/dashboard');
        return;
      }
      setUserRole(user.role);
    }
  }, [router]);

  // Load store info when userRole is set
  useEffect(() => {
    if (userRole) {
      loadStoreInfo();
    }
  }, [userRole, storeSlug]);

  // Load analytics when store is loaded
  useEffect(() => {
    if (store) {
      loadAnalytics();
      loadStockAlerts();
    }
  }, [store, startDate, endDate]);

  const loadStoreInfo = async () => {
    // 1. Try localStorage cache first (fastest)
    const cachedStoreId = localStorage.getItem(`pos_store_${storeSlug}`);
    const cachedStoreName = localStorage.getItem(`pos_store_name_${storeSlug}`);
    if (cachedStoreId && cachedStoreName) {
      setStore({ id: cachedStoreId, name: cachedStoreName, slug: storeSlug });
      return;
    }

    // 2. Fallback: fetch from API (slowest)
    try {
      const response = await api.get('/stock/all-stores');
      if (response.data.success) {
        const stores = response.data.data?.stores || [];
        const foundStore = stores.find((s: Store) => s.slug === storeSlug);
        if (foundStore) {
          setStore(foundStore);
          // Cache for future use
          localStorage.setItem(`pos_store_${storeSlug}`, foundStore.id);
          localStorage.setItem(`pos_store_name_${storeSlug}`, foundStore.name);
        } else {
          console.error('Store not found:', storeSlug);
          setLoading(false);
        }
      } else {
        console.error('API returned success: false');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading store info:', error);
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!store) return;
    setLoading(true);
    try {
      const response = await api.get(
        `/in-store-sales/analytics/${store.id}?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockAlerts = async () => {
    if (!store) return;
    try {
      const response = await api.get(`/stock/alerts?storeId=${store.id}&threshold=5`);
      if (response.data.success) {
        setStockAlerts(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading stock alerts:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' DH';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: 'Especes',
      CARD: 'Carte',
      MIXED: 'Mixte',
    };
    return labels[method] || method;
  };

  const getPaymentAmount = (method: string) => {
    return analytics?.byPaymentMethod.find((p) => p.method === method)?.amount || 0;
  };

  const getPaymentCount = (method: string) => {
    return analytics?.byPaymentMethod.find((p) => p.method === method)?.count || 0;
  };

  const handleExportPDF = () => {
    if (!analytics || !store) return;

    const reportData: StoreReportData = {
      storeName: store.name,
      period: {
        startDate,
        endDate,
      },
      sales: analytics.sales,
      returns: analytics.returns,
      byPaymentMethod: analytics.byPaymentMethod,
      topProducts: analytics.topProducts,
      recentSales: analytics.recentSales,
      stockAlerts: stockAlerts.slice(0, 10),
    };

    printStoreReport(reportData);
  };

  // Calculate chart max value for scaling
  const maxDailyAmount = analytics?.dailySales
    ? Math.max(...analytics.dailySales.map((d) => d.amount), 1)
    : 1;

  // Don't render until role is verified
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Wait for store to be loaded
  if (!store) {
    return (
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
          <div className="p-6 flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
          <div className="p-6 flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/magasins')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
                <p className="text-gray-500">Performance du magasin</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Picker */}
              <div className="flex items-center gap-3 bg-white rounded-lg shadow px-4 py-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-0 focus:ring-0 text-sm"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={today.toISOString().split('T')[0]}
                  className="border-0 focus:ring-0 text-sm"
                />
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportPDF}
                disabled={!analytics}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exporter PDF
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Ventes</p>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(analytics?.sales.totalAmount || 0)}
              </p>
              <p className="text-sm text-gray-500">{analytics?.sales.count || 0} transactions</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Panier Moyen</p>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(analytics?.sales.avgBasket || 0)}
              </p>
              <p className="text-sm text-gray-500">par transaction</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Retours</p>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-600 mt-2">{analytics?.returns.count || 0}</p>
              <p className="text-sm text-gray-500">
                {analytics?.returns.byCondition.find((r) => r.condition === 'RESTOCKABLE')?.count || 0} restockable
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Remises</p>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {formatCurrency(analytics?.sales.totalDiscount || 0)}
              </p>
              <p className="text-sm text-gray-500">total remises</p>
            </div>
          </div>

          {/* Chart and Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Ventes par Jour</h3>
              {analytics?.dailySales && analytics.dailySales.length > 0 ? (
                <div className="h-48">
                  <div className="flex items-end justify-between h-40 gap-1">
                    {analytics.dailySales.map((day, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-orange-400 rounded-t hover:bg-orange-500 transition-colors"
                          style={{
                            height: `${(day.amount / maxDailyAmount) * 100}%`,
                            minHeight: day.amount > 0 ? '4px' : '0',
                          }}
                          title={`${formatDate(day.date)}: ${formatCurrency(day.amount)}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    {analytics.dailySales.length > 0 && (
                      <>
                        <span>{formatDate(analytics.dailySales[0].date)}</span>
                        <span>{formatDate(analytics.dailySales[analytics.dailySales.length - 1].date)}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  Aucune donnee pour cette periode
                </div>
              )}
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Modes de Paiement</h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-medium">Especes</span>
                    <span className="text-green-700 font-bold">{formatCurrency(getPaymentAmount('CASH'))}</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">{getPaymentCount('CASH')} transaction(s)</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">Carte</span>
                    <span className="text-blue-700 font-bold">{formatCurrency(getPaymentAmount('CARD'))}</span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">{getPaymentCount('CARD')} transaction(s)</p>
                </div>
                {getPaymentCount('MIXED') > 0 && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700 font-medium">Mixte</span>
                      <span className="text-purple-700 font-bold">{formatCurrency(getPaymentAmount('MIXED'))}</span>
                    </div>
                    <p className="text-sm text-purple-600 mt-1">{getPaymentCount('MIXED')} transaction(s)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Products and Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Top Produits</h3>
              {analytics?.topProducts && analytics.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topProducts.slice(0, 5).map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-sm font-medium text-orange-600">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">{product.productName}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{product.quantity} vendus</p>
                        <p className="text-sm text-gray-500">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Aucun produit vendu</div>
              )}
            </div>

            {/* Stock Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Alertes Stock</h3>
                {stockAlerts.length > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                    {stockAlerts.length} alerte(s)
                  </span>
                )}
              </div>
              {stockAlerts.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {stockAlerts.slice(0, 10).map((alert, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        alert.quantity === 0 ? 'bg-red-50' : 'bg-yellow-50'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{alert.productName}</p>
                        {alert.variationName && (
                          <p className="text-sm text-gray-500">{alert.variationName}</p>
                        )}
                      </div>
                      <span
                        className={`font-bold ${
                          alert.quantity === 0 ? 'text-red-600' : 'text-yellow-600'
                        }`}
                      >
                        {alert.quantity === 0 ? 'Rupture' : `${alert.quantity} pcs`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Stock OK - Pas d'alertes
                </div>
              )}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Ventes Recentes</h3>
            </div>
            {analytics?.recentSales && analytics.recentSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                      <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Articles</th>
                      <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paiement</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm text-gray-900">{formatDateTime(sale.createdAt)}</td>
                        <td className="px-5 py-3 text-sm font-mono text-gray-600">{sale.saleNumber}</td>
                        <td className="px-5 py-3 text-sm text-center text-gray-600">{sale.itemCount}</td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sale.paymentMethod === 'CASH'
                                ? 'bg-green-100 text-green-700'
                                : sale.paymentMethod === 'CARD'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">{sale.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">Aucune vente pour cette periode</div>
            )}
          </div>

          {/* Loading Overlay */}
          {loading && analytics && (
            <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <div className="animate-spin h-6 w-6 border-4 border-orange-400 border-t-transparent rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
