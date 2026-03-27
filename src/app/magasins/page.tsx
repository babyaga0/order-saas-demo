'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import api from '@/lib/api';

const ALLOWED_ROLES = ['ADMIN'];

type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  sales: {
    count: number;
    totalAmount: number;
    avgBasket: number;
  };
  returns: {
    count: number;
  };
};

type AllStoresSummary = {
  period: {
    startDate: string;
    endDate: string;
  };
  stores: StoreSummary[];
  totals: {
    salesCount: number;
    salesAmount: number;
    returnsCount: number;
    avgBasket: number;
  };
};

export default function MagasinsPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [data, setData] = useState<AllStoresSummary | null>(null);

  // Date range state - default to current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

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

  // Load data when userRole is set
  useEffect(() => {
    if (userRole) {
      loadData();
    }
  }, [userRole, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/in-store-sales/stores-summary?startDate=${startDate}&endDate=${endDate}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading stores summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' DH';
  };

  const handleStoreClick = (slug: string) => {
    router.push(`/magasins/${slug}?startDate=${startDate}&endDate=${endDate}`);
  };

  // Don't render until role is verified
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (loading && !data) {
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Magasins</h1>
              <p className="text-gray-500">Performance de vos magasins</p>
            </div>

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
          </div>

          {/* Store Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.stores.map((store) => (
              <div
                key={store.id}
                onClick={() => handleStoreClick(store.slug)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-orange-200 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{store.name}</h3>
                    <p className="text-sm text-gray-500">{store.sales.count} ventes</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Chiffre d'affaires</span>
                    <span className="font-semibold text-green-600">{formatCurrency(store.sales.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Panier moyen</span>
                    <span className="font-medium text-gray-900">{formatCurrency(store.sales.avgBasket)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Retours</span>
                    <span className={`font-medium ${store.returns.count > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {store.returns.count}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button className="w-full text-center text-sm text-orange-600 hover:text-orange-700 font-medium">
                    Voir Performance →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Card */}
          {data && (
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Total - Tous les Magasins</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-orange-100 text-sm">Ventes</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.totals.salesAmount)}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Transactions</p>
                  <p className="text-2xl font-bold">{data.totals.salesCount}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Panier Moyen</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.totals.avgBasket)}</p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm">Retours</p>
                  <p className="text-2xl font-bold">{data.totals.returnsCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {loading && data && (
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
