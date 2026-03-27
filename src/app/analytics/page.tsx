'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { Toaster, toast } from 'react-hot-toast';
import DateRangePicker from '@/components/DateRangePicker';
import api from '@/lib/api';

interface AnalyticsData {
  overview: {
    totalOrders: number;
    delivered: number;
    pending: number;
    confirmed: number;
    sentToDelivery: number;
    cancelled: number;
    returned: number;
    cathedisReturned: number;
    orderRevenue: number;
    potentialRevenue: number;
    totalProductsSold: number;
    successRate: number;
    confirmationRate: number;
    deliverySuccessRate: number;
    cathedisDeliveryRate: number;
    totalRevenue: number;
    totalTransactions: number;
    commission: number;
    commissionRate: number;
  };
  monthlyData: Array<{
    month: string;
    year: number;
    orders: number;
    delivered: number;
    orderRevenue: number;
    totalRevenue: number;
  }>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
}

type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function AnalyticsPage() {
  const { isSidebarCollapsed } = useLayout();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [userName, setUserName] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setUserName(userData.fullName);
      setUserRole(userData.role);
      // Redirect admin to admin-analytics
      if (userData.role === 'ADMIN' || userData.role === 'SUPER_ADMIN') {
        router.push('/admin-analytics');
        return;
      }
    }
  }, [router]);

  useEffect(() => {
    if (userRole) {
      // Don't load if custom period without dates
      if (period === 'custom' && (!customStartDate || !customEndDate)) {
        return;
      }
      loadAnalytics();
    }
  }, [period, userRole, customStartDate, customEndDate]);

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        router.push('/login');
        return;
      }

      let params = `period=${period}`;
      if (period === 'custom' && customStartDate && customEndDate) {
        params += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
      }

      const response = await api.get(`/orders/analytics?${params}`);
      setAnalytics(response.data.data);
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

  const getPeriodLabel = (p: Period) => {
    const labels: Record<Period, string> = {
      today: "Aujourd'hui",
      week: '7 jours',
      month: 'Ce mois',
      all: 'Tout',
      custom: 'Personnalisé',
    };
    return labels[p];
  };

  // Calculate max value for chart scaling
  const maxChartValue = analytics?.monthlyData
    ? Math.max(...analytics.monthlyData.map((m) => m.totalRevenue), 1)
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
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Mes Performances</h1>
              <p className="text-gray-500 text-sm">{userName}</p>
            </div>

            {/* Period Filter - Compact */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      period === p
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {getPeriodLabel(p)}
                  </button>
                ))}
              </div>
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              </div>
            ) : analytics ? (
              <>
                {/* Main Stats - Big Numbers */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* Total Revenue */}
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white col-span-2">
                    <p className="text-orange-100 text-sm font-medium">Revenu Total</p>
                    <p className="text-3xl font-bold mt-1">
                      {formatCurrency(analytics.overview.orderRevenue)}
                    </p>
                    <p className="text-orange-100 text-xs mt-2">Revenu des commandes</p>
                  </div>

                  {/* Total Transactions */}
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Commandes</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {analytics.overview.totalOrders}
                    </p>
                  </div>

                  {/* Confirmation Rate */}
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Taux Confirmation</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {analytics.overview.confirmationRate}%
                    </p>
                  </div>

                  {/* Delivery Success Rate */}
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Taux Livraison</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {analytics.overview.cathedisDeliveryRate || analytics.overview.deliverySuccessRate}%
                    </p>
                  </div>

                  {/* Success Rate (Overall) */}
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Taux Succès Global</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                      {analytics.overview.successRate}%
                    </p>
                  </div>
                </div>

                {/* Commission Section */}
                <div className="mb-6">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">💰</span>
                      <h3 className="font-semibold text-gray-900">Commission</h3>
                    </div>
                    <div className="flex items-baseline gap-3 mb-2">
                      <p className="text-3xl font-bold text-orange-600">
                        {analytics.overview.commission.toLocaleString('fr-MA')} DH
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        {analytics.overview.delivered} livrées × {analytics.overview.commissionRate} DH/commande
                      </p>
                      <p className="text-sm text-gray-600">
                        Basée sur taux livraison: {analytics.overview.cathedisDeliveryRate || analytics.overview.deliverySuccessRate}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Commandes Details */}
                <div className="grid grid-cols-1 gap-4 mb-6">
                  {/* Commandes */}
                  <div className="bg-white rounded-xl p-5 border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-lg">📦</span> Détails des Commandes
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Total</p>
                        <p className="font-bold text-lg text-gray-900">{analytics.overview.totalOrders}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Livrées</p>
                        <p className="font-bold text-lg text-emerald-600">{analytics.overview.delivered}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">En cours</p>
                        <p className="font-bold text-lg text-blue-600">{analytics.overview.sentToDelivery}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">En attente</p>
                        <p className="font-bold text-lg text-yellow-600">{analytics.overview.pending + analytics.overview.confirmed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Annulées</p>
                        <p className="font-bold text-lg text-red-600">{analytics.overview.cancelled}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-sm">Retournées</p>
                        <p className="font-bold text-lg text-orange-600">{analytics.overview.returned}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Revenu des Commandes</span>
                        <span className="font-bold text-xl text-orange-600">{formatCurrency(analytics.overview.orderRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Produits Vendus</span>
                        <span className="font-bold text-xl text-purple-600">{analytics.overview.totalProductsSold}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Revenue Chart - Simple */}
                <div className="bg-white rounded-xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">Revenu Mensuel</h3>
                  <div className="h-48">
                    {analytics.monthlyData.length > 0 ? (
                      <div className="flex items-end justify-between h-full gap-2">
                        {analytics.monthlyData.map((month, index) => (
                          <div key={index} className="flex-1 flex flex-col items-center h-full">
                            <div className="flex-1 w-full flex flex-col justify-end">
                              <div
                                className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg transition-all hover:from-orange-600 hover:to-orange-500"
                                style={{
                                  height: `${(month.totalRevenue / maxChartValue) * 100}%`,
                                  minHeight: month.totalRevenue > 0 ? '8px' : '0',
                                }}
                                title={`${formatCurrency(month.totalRevenue)}`}
                              />
                            </div>
                            <div className="mt-2 text-center">
                              <p className="text-xs font-medium text-gray-600 capitalize">
                                {month.month}
                              </p>
                              <p className="text-xs text-gray-400">
                                {month.totalRevenue > 0 ? formatCurrency(month.totalRevenue) : '-'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Aucune donnée
                      </div>
                    )}
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
