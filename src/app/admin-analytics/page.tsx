'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { Toaster, toast } from 'react-hot-toast';
import DateRangePicker from '@/components/DateRangePicker';

interface StaffPerformance {
  id: string;
  name: string;
  email: string;
  role: string;
  totalOrders: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  returned: number;
  cathedisReturned: number;
  totalProductsSold: number;
  confirmationRate: number;
  successRate: number;
  deliverySuccessRate: number;
  orderRevenue: number;
  totalRevenue: number;
  commission: number;
  commissionRate: number;
}

interface StorePerformance {
  id: string;
  name: string;
  type: string;
  inStoreSales: number;
  inStoreRevenue: number;
  totalRevenue: number;
}

interface DeliveryStat {
  status: string;
  count: number;
}

interface DailyRevenue {
  date: string;
  orderRevenue: number;
  inStoreRevenue: number;
  totalRevenue: number;
}

interface AdminAnalyticsData {
  overview: {
    totalOrders: number;
    delivered: number;
    pending: number;
    confirmed: number;
    sentToDelivery: number;
    cancelled: number;
    returned: number;
    orderRevenue: number;
    deliveredPaidRevenue: number;
    deliveredUnpaidRevenue: number;
    potentialRevenue: number;
    totalProductsSold: number;
    totalDeliveryFees: number;
    netRevenue: number;
    successRate: number;
    confirmationRate: number;
    deliverySuccessRate: number;
    totalInStoreSales: number;
    inStoreRevenue: number;
    totalRevenue: number;
    totalTransactions: number;
  };
  monthlyData: Array<{
    month: string;
    year: number;
    orders: number;
    delivered: number;
    orderRevenue: number;
    inStoreSales: number;
    inStoreRevenue: number;
    totalRevenue: number;
  }>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
  staffPerformance: StaffPerformance[];
  storePerformance: StorePerformance[];
  deliveryStats: DeliveryStat[];
  dailyRevenue: DailyRevenue[];
  paymentBreakdown: {
    deliveredPaid: number;
    deliveredUnpaid: number;
    returned: number;
    cancelled: number;
  };
}

type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function AdminAnalyticsPage() {
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    // Check if user is admin or has canSeeAllOrders permission
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Allow ADMIN, SUPER_ADMIN, and STAFF with canSeeAllOrders
      if (userData.role === 'STAFF' && !userData.canSeeAllOrders) {
        router.push('/analytics');
        return;
      }
    }
    // Don't load if custom period without dates
    if (period === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    loadAnalytics();
  }, [period, customStartDate, customEndDate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        router.push('/login');
        return;
      }

      let url = `${process.env.NEXT_PUBLIC_API_URL}/orders/admin-analytics?period=${period}`;

      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast.error('Session expirée. Veuillez vous reconnecter.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }
        throw new Error(data.message || 'Failed to fetch analytics');
      }

      // Ensure all arrays have default values
      const analyticsData = data.data;
      setAnalytics({
        ...analyticsData,
        monthlyData: Array.isArray(analyticsData.monthlyData) ? analyticsData.monthlyData : [],
        sourceBreakdown: Array.isArray(analyticsData.sourceBreakdown) ? analyticsData.sourceBreakdown : [],
        staffPerformance: Array.isArray(analyticsData.staffPerformance) ? analyticsData.staffPerformance : [],
        storePerformance: Array.isArray(analyticsData.storePerformance) ? analyticsData.storePerformance : [],
        deliveryStats: Array.isArray(analyticsData.deliveryStats) ? analyticsData.deliveryStats : [],
        dailyRevenue: Array.isArray(analyticsData.dailyRevenue) ? analyticsData.dailyRevenue : [],
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      MANUAL: 'Manuel',
      WOOCOMMERCE: 'WooCommerce',
      WHATSAPP: 'WhatsApp',
      IN_STORE: 'Magasin',
    };
    return labels[source] || source;
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      MANUAL: 'bg-blue-500',
      WOOCOMMERCE: 'bg-purple-500',
      WHATSAPP: 'bg-green-500',
      IN_STORE: 'bg-orange-500',
    };
    return colors[source] || 'bg-gray-500';
  };

  const getDeliveryStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'En Attente Ramassage': 'En Attente',
      'Collecté': 'Collecté',
      'Hub CATHEDIS': 'Hub Cathedis',
      'Livré': 'Livré',
      'Client Injoignable': 'Injoignable',
      'CRC': 'CRC',
      'Annulé': 'Annulé',
      'Au Téléphone': 'Au Téléphone',
      'UNKNOWN': 'Non défini',
    };
    return labels[status] || status;
  };

  const getDeliveryStatusColor = (status: string) => {
    if (status === 'Livré') return 'bg-emerald-500';
    if (status === 'Annulé') return 'bg-red-500';
    if (status === 'En Attente Ramassage') return 'bg-yellow-500';
    if (status === 'Collecté' || status === 'Hub CATHEDIS') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getPeriodLabel = (p: Period) => {
    const labels: Record<Period, string> = {
      today: "Aujourd'hui",
      week: '7 derniers jours',
      month: 'Ce mois',
      all: 'Tout',
      custom: 'Personnalisé',
    };
    return labels[p];
  };

  // Calculate max value for chart scaling
  const maxChartValue = analytics?.monthlyData && Array.isArray(analytics.monthlyData) && analytics.monthlyData.length > 0
    ? Math.max(...analytics.monthlyData.map((m) => m.orders + m.inStoreSales), 1)
    : 1;

  // Calculate max revenue for daily chart
  const maxDailyRevenue = analytics?.dailyRevenue && Array.isArray(analytics.dailyRevenue) && analytics.dailyRevenue.length > 0
    ? Math.max(...analytics.dailyRevenue.map((d) => d.totalRevenue), 1)
    : 1;

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
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Admin</h1>
              <p className="text-gray-600 mt-1">
                Vue d'ensemble complète des performances de l'entreprise
              </p>
            </div>

            {/* Period Filter */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    if (p !== 'custom') {
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    period === p
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {getPeriodLabel(p)}
                </button>
              ))}
              <DateRangePicker
                startDate={customStartDate}
                endDate={customEndDate}
                onDateChange={(start, end) => {
                  setCustomStartDate(start);
                  setCustomEndDate(end);
                }}
                onApply={() => {
                  setPeriod('custom');
                }}
                onClear={() => {
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                  setPeriod('month');
                }}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : analytics ? (
              <>
                {/* Main Stats - Total Revenue and Transactions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {/* Total Revenue */}
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-100">Revenu Total</p>
                        <p className="text-3xl font-bold mt-2">
                          {formatCurrency(analytics.overview.totalRevenue)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Total Transactions */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-100">Transactions</p>
                        <p className="text-3xl font-bold mt-2">
                          {analytics.overview.totalTransactions}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Delivered Orders */}
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-100">Livrées</p>
                        <p className="text-3xl font-bold mt-2">
                          {analytics.overview.delivered}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Rate */}
                  <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-cyan-100">Taux Confirmation</p>
                        <p className="text-3xl font-bold mt-2">
                          {analytics.overview.confirmationRate}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Success Rate */}
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-100">Taux Livraison</p>
                        <p className="text-3xl font-bold mt-2">
                          {analytics.overview.deliverySuccessRate}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Success Rate (Overall) */}
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-100">Taux Succès Global</p>
                        <p className="text-3xl font-bold mt-2">
                          {analytics.overview.successRate}%
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Staff Performance - Card Grid Design */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance du Personnel
                  </h3>

                  {analytics.staffPerformance.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                      Aucune donnée disponible
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {analytics.staffPerformance.map((staff) => {
                        const maxRevenue = Math.max(...analytics.staffPerformance.map(s => s.totalRevenue || 0), 1);
                        const revenuePercentage = (staff.totalRevenue / maxRevenue) * 100;

                        return (
                          <div key={staff.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            {/* Staff Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{staff.name}</p>
                                  <p className="text-xs text-gray-500">{staff.email}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{formatCurrency(staff.totalRevenue)}</p>
                                <p className="text-xs text-gray-500">Total</p>
                              </div>
                            </div>

                            {/* Revenue Progress Bar */}
                            <div className="mb-4">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                                  style={{ width: `${revenuePercentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Performance Metrics - Three Key Rates */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 border border-cyan-200">
                                <p className="text-xs text-cyan-700 font-medium mb-1">Taux Confirmation</p>
                                <p className={`text-2xl font-bold ${
                                  staff.confirmationRate >= 80 ? 'text-cyan-600' :
                                  staff.confirmationRate >= 50 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>{staff.confirmationRate}%</p>
                              </div>
                              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                                <p className="text-xs text-emerald-700 font-medium mb-1">Taux Livraison</p>
                                <p className={`text-2xl font-bold ${
                                  staff.deliverySuccessRate >= 80 ? 'text-emerald-600' :
                                  staff.deliverySuccessRate >= 50 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>{staff.deliverySuccessRate}%</p>
                              </div>
                              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
                                <p className="text-xs text-indigo-700 font-medium mb-1">Taux Succès</p>
                                <p className={`text-2xl font-bold ${
                                  staff.successRate >= 80 ? 'text-indigo-600' :
                                  staff.successRate >= 50 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>{staff.successRate}%</p>
                              </div>
                            </div>

                            {/* Commission Section */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-orange-200">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">💰</span>
                                <span className="text-sm font-semibold text-orange-700">Commission</span>
                              </div>
                              <div className="flex items-baseline gap-2 mb-1">
                                <p className="text-2xl font-bold text-orange-600">{staff.commission.toLocaleString('fr-MA')} DH</p>
                              </div>
                              <p className="text-xs text-gray-600">
                                {staff.delivered} livrées × {staff.commissionRate} DH (Taux: {staff.deliverySuccessRate}%)
                              </p>
                            </div>

                            {/* Order Performance */}
                            <div className="bg-blue-50 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                                <span className="text-sm font-semibold text-blue-700">Performance Commandes</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Commandes</p>
                                  <p className="text-lg font-bold text-gray-900">{staff.totalOrders}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Confirmées</p>
                                  <p className="text-lg font-bold text-cyan-600">{staff.confirmed}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Livrées</p>
                                  <p className="text-lg font-bold text-emerald-600">{staff.delivered}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Revenu</p>
                                  <p className="text-lg font-bold text-blue-600">{formatCurrency(staff.orderRevenue)}</p>
                                </div>
                              </div>

                              {/* Products Sold */}
                              <div className="mt-3 pt-3 border-t border-blue-100">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-600">Produits Vendus</p>
                                  <p className="text-lg font-bold text-purple-600">{staff.totalProductsSold}</p>
                                </div>
                              </div>
                            </div>

                            {/* Quick Stats Footer */}
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Annulées:</span>
                                <span className="font-medium text-red-600">{staff.cancelled}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Retournées:</span>
                                <span className="font-medium text-orange-600">{staff.returned}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Store Performance Cards */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance des Magasins
                  </h3>

                  {analytics.storePerformance && analytics.storePerformance.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {analytics.storePerformance.map((store) => {
                        const maxRevenue = Math.max(...analytics.storePerformance.map(s => s.totalRevenue || 0), 1);
                        const revenuePercentage = ((store.totalRevenue || 0) / maxRevenue) * 100;

                        return (
                          <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            {/* Store Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                  🏪
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{store.name}</p>
                                  <p className="text-xs text-gray-500">Magasin</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{formatCurrency(store.totalRevenue)}</p>
                                <p className="text-xs text-gray-500">Total</p>
                              </div>
                            </div>

                            {/* Revenue Progress Bar */}
                            <div className="mb-4">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all"
                                  style={{ width: `${revenuePercentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Store Performance */}
                            <div className="bg-indigo-50 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-sm font-semibold text-indigo-700">Ventes en Magasin</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Ventes</p>
                                  <p className="text-lg font-bold text-gray-900">{store.inStoreSales}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Revenu</p>
                                  <p className="text-lg font-bold text-indigo-600">{formatCurrency(store.inStoreRevenue)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                      Aucune donnée de magasin disponible
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Monthly Performance Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Performance Mensuelle
                    </h3>
                    <div className="h-64">
                      {analytics.monthlyData.length > 0 ? (
                        <div className="flex items-end justify-between h-full gap-2">
                          {analytics.monthlyData.map((month, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center h-full">
                              <div className="flex-1 w-full flex flex-col justify-end gap-1">
                                <div
                                  className="w-full bg-indigo-400 rounded-t transition-all hover:bg-indigo-500"
                                  style={{
                                    height: `${(month.inStoreSales / maxChartValue) * 100}%`,
                                    minHeight: month.inStoreSales > 0 ? '4px' : '0',
                                  }}
                                  title={`${month.inStoreSales} ventes magasin`}
                                />
                                <div
                                  className="w-full bg-blue-200 rounded-t transition-all hover:bg-blue-300"
                                  style={{
                                    height: `${(month.orders / maxChartValue) * 100}%`,
                                    minHeight: month.orders > 0 ? '4px' : '0',
                                  }}
                                  title={`${month.orders} commandes`}
                                />
                                <div
                                  className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                                  style={{
                                    height: `${(month.delivered / maxChartValue) * 100}%`,
                                    minHeight: month.delivered > 0 ? '4px' : '0',
                                  }}
                                  title={`${month.delivered} livrées`}
                                />
                              </div>
                              <div className="mt-2 text-center">
                                <p className="text-xs font-medium text-gray-600 capitalize">
                                  {month.month}
                                </p>
                                <p className="text-xs text-gray-400">{formatCurrency(month.totalRevenue)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          Aucune donnée disponible
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-indigo-400 rounded"></div>
                        <span className="text-gray-600">Magasin</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-200 rounded"></div>
                        <span className="text-gray-600">Commandes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                        <span className="text-gray-600">Livrées</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Sources */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Sources des Commandes
                    </h3>
                    {analytics.sourceBreakdown.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.sourceBreakdown.map((source, index) => {
                          const percentage = analytics.overview.totalOrders > 0
                            ? ((source.count / analytics.overview.totalOrders) * 100).toFixed(1)
                            : 0;
                          return (
                            <div key={index}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {getSourceLabel(source.source)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {source.count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className={`${getSourceColor(source.source)} h-2 rounded-full transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        Aucune donnée disponible
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Status & Order Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Delivery Status from Cathedis */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Statuts Cathedis
                    </h3>
                    {analytics.deliveryStats.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.deliveryStats.map((stat, index) => {
                          const totalDelivery = analytics.deliveryStats.reduce((sum, s) => sum + s.count, 0);
                          const percentage = totalDelivery > 0
                            ? ((stat.count / totalDelivery) * 100).toFixed(1)
                            : 0;
                          return (
                            <div key={index}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {getDeliveryStatusLabel(stat.status)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {stat.count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className={`${getDeliveryStatusColor(stat.status)} h-2 rounded-full transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        Aucune commande envoyée à Cathedis
                      </div>
                    )}
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Répartition par Statut
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <p className="text-xl font-bold text-yellow-600">
                          {analytics.overview.pending}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">En attente</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xl font-bold text-blue-600">
                          {analytics.overview.confirmed}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Confirmées</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-xl font-bold text-purple-600">
                          {analytics.overview.sentToDelivery}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">En livraison</p>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <p className="text-xl font-bold text-emerald-600">
                          {analytics.overview.delivered}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Livrées</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-xl font-bold text-red-600">
                          {analytics.overview.cancelled}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Annulées</p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <p className="text-xl font-bold text-orange-600">
                          {analytics.overview.returned}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Retournées</p>
                      </div>
                      <div className="text-center p-3 bg-indigo-50 rounded-lg border-2 border-indigo-300">
                        <p className="text-xl font-bold text-indigo-600">
                          {analytics.overview.totalProductsSold}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Produits Vendus</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Overview Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Vue d'Ensemble des Commandes
                  </h3>
                  {analytics.paymentBreakdown ? (
                    <div className="space-y-3">
                      {(() => {
                        const { deliveredPaid, deliveredUnpaid, returned, cancelled } = analytics.paymentBreakdown;
                        const total = deliveredPaid + deliveredUnpaid + returned + cancelled;

                        if (total === 0) {
                          return (
                            <div className="flex items-center justify-center h-32 text-gray-500">
                              Aucune donnée disponible
                            </div>
                          );
                        }

                        const items = [
                          {
                            label: 'Livrées & Payées',
                            count: deliveredPaid,
                            percentage: ((deliveredPaid / total) * 100).toFixed(1),
                            color: 'bg-emerald-500',
                          },
                          {
                            label: 'Livrées Non Payées',
                            count: deliveredUnpaid,
                            percentage: ((deliveredUnpaid / total) * 100).toFixed(1),
                            color: 'bg-orange-500',
                          },
                          {
                            label: 'Retournées',
                            count: returned,
                            percentage: ((returned / total) * 100).toFixed(1),
                            color: 'bg-gray-400',
                          },
                          {
                            label: 'Annulées',
                            count: cancelled,
                            percentage: ((cancelled / total) * 100).toFixed(1),
                            color: 'bg-red-500',
                          },
                        ];

                        return (
                          <>
                            {items.map((item, index) => (
                              <div key={index}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-700">
                                    {item.label}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {item.count} ({item.percentage}%)
                                  </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                  <div
                                    className={`${item.color} h-3 rounded-full transition-all`}
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-900">Total</span>
                                <span className="text-sm font-semibold text-gray-900">{total} commandes</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      Aucune donnée disponible
                    </div>
                  )}
                </div>

                {/* Revenue Breakdown - 7 boxes in 2 rows */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Détail des Revenus
                  </h3>
                  {/* First row: 4 boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                      <p className="text-sm text-gray-600 mb-1">Revenus Encaissés</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(analytics.overview.deliveredPaidRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Livrées & Payées</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                      <p className="text-sm text-gray-600 mb-1">Non Encaissés</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(analytics.overview.deliveredUnpaidRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Livrées Non Payées</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Revenus Magasin</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {formatCurrency(analytics.overview.inStoreRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Ventes physiques</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Potentiel</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(analytics.overview.potentialRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">En cours de livraison</p>
                    </div>
                  </div>
                  {/* Second row: 3 boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* NEW: Delivery Fees Box */}
                    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <p className="text-sm text-gray-600 mb-1">Frais de Livraison</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(analytics.overview.totalDeliveryFees)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Payés à Cathedis</p>
                    </div>
                    {/* NEW: Net Revenue Box */}
                    <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
                      <p className="text-sm text-gray-600 mb-1">Revenu Net</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(analytics.overview.netRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Après frais</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
                      <p className="text-sm text-gray-600 mb-1">Revenu Total Réel</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {formatCurrency(analytics.overview.totalRevenue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Argent reçu</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
