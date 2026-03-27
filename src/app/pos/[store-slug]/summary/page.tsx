'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { printDayReport, ReportData } from '@/utils/dayReportGenerator';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { ReceiptData } from '@/utils/receiptGenerator';

type SaleItem = {
  id: string;
  saleNumber: string;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MIXED';
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
};

type SummaryData = {
  date: string;
  sales: {
    count: number;
    totalAmount: number;
  };
  returns: {
    count: number;
    refundTotal?: number;
    byCondition: Array<{ condition: string; count: number }>;
  };
  byPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  recentSales: SaleItem[];
};

export default function POSSummaryPage() {
  const params = useParams();
  const storeSlug = params['store-slug'] as string;
  const { user } = useAuth();
  const printer = useThermalPrinter();

  const [storeId, setStoreId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>(storeSlug);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Get store ID - optimized with caching
  useEffect(() => {
    const getStoreId = async () => {
      // 1. Try localStorage cache first (fastest)
      const cachedStoreId = localStorage.getItem(`pos_store_${storeSlug}`);
      const cachedStoreName = localStorage.getItem(`pos_store_name_${storeSlug}`);
      if (cachedStoreId) {
        setStoreId(cachedStoreId);
        setStoreName(cachedStoreName || user?.store?.name || storeSlug);
        return;
      }

      // 2. Try user's storeId if available
      if (user?.storeId) {
        setStoreId(user.storeId);
        setStoreName(user.store?.name || storeSlug);
        localStorage.setItem(`pos_store_${storeSlug}`, user.storeId);
        if (user.store?.name) localStorage.setItem(`pos_store_name_${storeSlug}`, user.store.name);
        return;
      }

      // 3. Fallback: fetch from API (slowest)
      try {
        const response = await api.get('/stock/all-stores');
        if (response.data.success) {
          const stores = response.data.data?.stores || [];
          const store = stores.find((s: any) => s.slug === storeSlug);
          if (store) {
            setStoreId(store.id);
            setStoreName(store.name);
            localStorage.setItem(`pos_store_${storeSlug}`, store.id);
            localStorage.setItem(`pos_store_name_${storeSlug}`, store.name);
          } else {
            console.error('Store not found for slug:', storeSlug);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
        setLoading(false);
      }
    };

    if (user) {
      getStoreId();
    }
  }, [user, storeSlug]);

  // Load summary when storeId is available
  useEffect(() => {
    if (storeId) {
      loadSummary();
    }
  }, [storeId, selectedDate]);

  const loadSummary = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

      // Fetch synced sales from API
      const response = await api.get(`/in-store-sales/summary/${storeId}?date=${selectedDate}`);

      if (response.data.success) {
        let summaryData = response.data.data;

        // CRITICAL: Ensure all numbers from API are parsed as numbers (not strings)
        summaryData.sales.totalAmount = Number(summaryData.sales.totalAmount) || 0;
        summaryData.sales.count = Number(summaryData.sales.count) || 0;

        // Parse returns refundTotal
        if (summaryData.returns) {
          summaryData.returns.refundTotal = Number(summaryData.returns.refundTotal) || 0;
        }

        // Parse payment method amounts
        if (summaryData.byPaymentMethod) {
          summaryData.byPaymentMethod = summaryData.byPaymentMethod.map((p: any) => ({
            method: p.method,
            count: Number(p.count) || 0,
            amount: Number(p.amount) || 0,
          }));
        }

        // If in Electron, also get pending local sales that haven't synced yet
        if (isElectron) {
          try {
            const pendingSales = await (window as any).electronAPI?.getPendingSales();
            console.log('[SUMMARY] Pending local sales:', pendingSales);

            if (pendingSales && pendingSales.length > 0) {
              // Filter pending sales for selected date
              const todaysPendingSales = pendingSales.filter((sale: any) => {
                const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
                return saleDate === selectedDate;
              });

              console.log(`[SUMMARY] Found ${todaysPendingSales.length} pending sales for ${selectedDate}`);

              // Convert pending sales to the same format as API sales
              const pendingSaleItems = todaysPendingSales.map((sale: any) => {
                const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
                const totalAmount = Number(sale.total_amount) || 0;

                // Generate a shorter, more readable sale number
                const timestamp = new Date(sale.created_at).getTime();
                const shortId = timestamp.toString().slice(-6); // Last 6 digits

                return {
                  id: sale.local_id || 'unknown',
                  saleNumber: `OFF-${shortId}`, // Shorter offline sale number
                  totalAmount: totalAmount,
                  paymentMethod: sale.payment_method || 'CASH',
                  itemCount: items?.length || 0,
                  createdAt: sale.created_at || new Date().toISOString(),
                  createdBy: '🔄 Sync en cours...', // Mark as pending
                  isPending: true, // Mark as pending for UI
                };
              });

              // Merge pending sales with synced sales, then sort by time (most recent first)
              if (summaryData.recentSales) {
                summaryData.recentSales = [...pendingSaleItems, ...summaryData.recentSales];
              } else {
                summaryData.recentSales = pendingSaleItems;
              }

              // Sort all sales by time (most recent first)
              summaryData.recentSales.sort((a: any, b: any) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                return timeB - timeA; // Descending order (newest first)
              });

              // Update totals to include pending sales
              const pendingTotal = todaysPendingSales.reduce((sum: number, sale: any) => {
                const amount = parseFloat(sale.total_amount) || 0;
                return sum + amount;
              }, 0);

              summaryData.sales.count = Number(summaryData.sales.count) + todaysPendingSales.length;
              summaryData.sales.totalAmount = Number(summaryData.sales.totalAmount) + Number(pendingTotal);

              // Update payment method breakdown
              todaysPendingSales.forEach((sale: any) => {
                const amount = Number(sale.total_amount) || 0;
                const method = sale.payment_method || 'CASH';

                const existingMethod = summaryData.byPaymentMethod.find(
                  (p: any) => p.method === method
                );
                if (existingMethod) {
                  existingMethod.count = Number(existingMethod.count) + 1;
                  existingMethod.amount = Number(existingMethod.amount) + amount;
                } else {
                  summaryData.byPaymentMethod.push({
                    method: method,
                    count: 1,
                    amount: amount,
                  });
                }
              });
            }
          } catch (error) {
            console.error('[SUMMARY] Failed to get pending sales:', error);
          }
        }

        setSummary(summaryData);
        // Cache for offline use (only cache today's summary)
        if (selectedDate === new Date().toISOString().split('T')[0]) {
          localStorage.setItem(`pos_summary_${storeId}_${selectedDate}`, JSON.stringify(summaryData));
        }
      } else {
        console.error('Summary API error:', response.data.message);
      }
    } catch (error: any) {
      console.error('[SUMMARY] API failed, loading from cache:', error?.message);
      // Offline fallback — load cached summary for this date
      const cached = localStorage.getItem(`pos_summary_${storeId}_${selectedDate}`);
      if (cached) {
        setSummary(JSON.parse(cached));
        console.log('[SUMMARY] Loaded from cache (offline mode)');
      }
    } finally {
      setLoading(false);
    }
  };

  const storeInfo = { id: storeId, name: storeName };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentAmount = (method: string): number => {
    return summary?.byPaymentMethod.find(p => p.method === method)?.amount || 0;
  };

  const getPaymentCount = (method: string): number => {
    return summary?.byPaymentMethod.find(p => p.method === method)?.count || 0;
  };

  const handlePrintReceipt = async (sale: SaleItem) => {
    try {
      // Check if this is an offline/pending sale
      if ((sale as any).isPending) {
        // For pending sales, don't fetch from API - they're not synced yet
        alert('Cette vente est en cours de synchronisation. Veuillez réessayer dans quelques instants.');
        return;
      }

      // Fetch full sale data for synced sales
      const response = await api.get(`/in-store-sales/${sale.id}`);
      if (response.data.success) {
        const saleData = response.data.data;
        const receiptData: ReceiptData = {
          storeName: storeInfo.name,
          saleNumber: saleData.saleNumber,
          cashierName: saleData.createdBy?.fullName || 'Vendeur',
          items: saleData.items.map((item: any) => ({
            productName: item.productName,
            shortCode: item.productName.substring(0, 20),
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            totalPrice: parseFloat(item.totalPrice),
          })),
          subtotal: parseFloat(saleData.totalAmount),
          total: parseFloat(saleData.totalAmount),
          paymentMethod: saleData.paymentMethod,
          customerPhone: saleData.customerPhone || undefined,
        };

        await printer.printReceipt(receiptData);
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      alert('Erreur lors de l\'impression');
    }
  };

  const handleExportReport = () => {
    if (!summary) return;

    const reportData: ReportData = {
      storeName: storeInfo.name,
      date: selectedDate,
      cashierName: user?.fullName,
      sales: summary.sales,
      returns: summary.returns,
      byPaymentMethod: summary.byPaymentMethod,
      recentSales: summary.recentSales,
    };

    printDayReport(reportData);
  };

  const handleCloseRegister = () => {
    if (confirm('Etes-vous sur de vouloir cloturer la caisse?\n\nCela va generer un rapport de fin de journee.')) {
      // Generate and print report
      handleExportReport();
      alert('Rapport de cloture genere. Vous pouvez l\'imprimer ou le sauvegarder en PDF.');
    }
  };

  // Show loading while getting storeId or loading data
  if (!storeId || loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Date Header */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          Resume - {new Date(selectedDate).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">VENTES TOTAL</p>
          <p className="text-2xl font-bold text-green-600">
            {(Number(summary?.sales.totalAmount || 0) - Number(summary?.returns.refundTotal || 0)).toFixed(2)} DH
          </p>
          <p className="text-sm text-gray-500">{summary?.sales.count || 0} transaction(s)</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">ESPECES</p>
          <p className="text-2xl font-bold">{(Number(getPaymentAmount('CASH')) - Number(summary?.returns.refundTotal || 0)).toFixed(2)} DH</p>
          <p className="text-sm text-gray-500">{getPaymentCount('CASH')} transaction(s)</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">CARTE</p>
          <p className="text-2xl font-bold">{Number(getPaymentAmount('CARD')).toFixed(2)} DH</p>
          <p className="text-sm text-gray-500">{getPaymentCount('CARD')} transaction(s)</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">RETOURS</p>
          <p className="text-2xl font-bold text-orange-600">{summary?.returns.count || 0}</p>
          <p className="text-sm text-gray-500">
            {(summary?.returns.refundTotal ?? 0) > 0
              ? `${Number(summary?.returns.refundTotal || 0).toFixed(2)} DH remboursé`
              : `${summary?.returns.byCondition.find(r => r.condition === 'RESTOCKABLE')?.count || 0} restockable(s)`}
          </p>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-bold">Ventes du jour</h2>
          <button
            onClick={loadSummary}
            className="text-sm text-orange-600 hover:text-orange-800"
          >
            Actualiser
          </button>
        </div>

        {!summary?.recentSales?.length ? (
          <div className="p-8 text-center text-gray-500">
            Aucune vente pour cette date
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heure</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Articles</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paiement</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.recentSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className={`${
                      (sale as any).isPending
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">{formatTime(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {sale.saleNumber}
                      {(sale as any).isPending && (
                        <span className="ml-2 text-xs text-yellow-700">⏳</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{sale.itemCount}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        sale.paymentMethod === 'CASH'
                          ? 'bg-green-100 text-green-800'
                          : sale.paymentMethod === 'CARD'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-purple-100 text-purple-800'
                      }`}>
                        {sale.paymentMethod === 'CASH' ? 'Especes' : sale.paymentMethod === 'CARD' ? 'Carte' : 'Mixte'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {Number(sale.totalAmount).toFixed(2)} DH
                    </td>
                    <td className="px-4 py-3 text-sm">{sale.createdBy}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handlePrintReceipt(sale)}
                        className="text-orange-600 hover:text-orange-800 text-sm"
                      >
                        Imprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL</td>
                  <td className="px-4 py-3 text-sm text-right font-bold">
                    {(Number(summary?.sales.totalAmount || 0) - Number(summary?.returns.refundTotal || 0)).toFixed(2)} DH
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleExportReport}
          disabled={!summary?.recentSales?.length}
          className="flex-1 py-3 bg-orange-400 text-white rounded-lg font-medium hover:bg-orange-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Exporter Rapport PDF
        </button>
        <button
          onClick={handleCloseRegister}
          className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
        >
          Cloture Caisse
        </button>
      </div>
    </div>
  );
}
