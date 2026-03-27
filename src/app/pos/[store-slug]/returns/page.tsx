'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { useProductCache } from '@/hooks/useProductCache';

type StockItem = {
  id: string;
  productId: number;
  variationId: number | null;
  productName: string;
  shortCode: string;
  size: string | null;
  length: string | null;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
};

type SelectedProduct = {
  productId: number;
  variationId: number | null;
  productName: string;
  shortCode: string;
  size: string | null;
  length: string | null;
  price: number;
};

type Return = {
  id: string;
  returnNumber: string;
  productName: string;
  shortCode: string;
  reason: string;
  condition: string;
  createdAt: string;
};

type HistoryReturn = {
  id: string;
  returnNumber: string;
  reason: string;
  condition: string;
  notes: string | null;
  createdAt: string;
  product: { id: number; name: string; shortCode: string };
  productVariation: { id: number; shortCode: string; size: string; length: string | null } | null;
  createdBy: { id: string; fullName: string } | null;
  order: { id: string; orderNumber: string; customerName: string; customerPhone: string } | null;
};

type FilterType = 'today' | 'week' | 'month' | 'all';

const QUICK_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'today', label: "Auj" },
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'all', label: 'Tout' },
];

const RETURN_REASONS = [
  { value: 'ECHANGE', label: 'Echange', description: 'Mauvaise taille' },
  { value: 'REMBOURSEMENT', label: 'Remboursement', description: 'Client ne veut plus' },
  { value: 'RETOUR_CATHEDIS', label: 'Retour Cathedis', description: 'Colis retourné par livreur' },
];

const CONDITION_OPTIONS = [
  { value: 'RESTOCKABLE', label: 'Restockable', description: 'Peut etre revendu' },
  { value: 'DEFECTIVE', label: 'Defectueux', description: 'Ne peut pas etre revendu' },
];

const REASON_LABELS: Record<string, string> = {
  ECHANGE: 'Echange',
  REMBOURSEMENT: 'Remboursement',
  // Legacy reasons (for history display)
  DEFAUT_PRODUIT: 'Defaut produit',
  MAUVAISE_TAILLE: 'Mauvaise taille',
  CLIENT_CHANGE_AVIS: "Change d'avis",
  AUTRE: 'Autre',
};

// Group returns that were created together (within 10 seconds, same reason/condition)
function groupReturns(returns: HistoryReturn[]): HistoryReturn[][] {
  if (returns.length === 0) return [];

  const groups: HistoryReturn[][] = [];
  let currentGroup: HistoryReturn[] = [returns[0]];

  for (let i = 1; i < returns.length; i++) {
    const current = returns[i];
    const previous = returns[i - 1];

    const timeDiff = Math.abs(new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime());
    const sameReason = current.reason === previous.reason;
    const sameCondition = current.condition === previous.condition;
    const sameCreator = current.createdBy?.id === previous.createdBy?.id;

    if (timeDiff <= 10000 && sameReason && sameCondition && sameCreator) {
      currentGroup.push(current);
    } else {
      groups.push(currentGroup);
      currentGroup = [current];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export default function POSReturnsPage() {
  const params = useParams();
  const storeSlug = params['store-slug'] as string;
  const scanInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { state: printerState, connectPrinter, openDrawer } = useThermalPrinter();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [storeId, setStoreId] = useState<string>('');
  const { findProductByCode } = useProductCache(storeId || null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);

  // New return form
  const [scanCode, setScanCode] = useState('');
  const [foundProducts, setFoundProducts] = useState<SelectedProduct[]>([]);
  const [refundAmounts, setRefundAmounts] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayReturns, setTodayReturns] = useState<Return[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Cathedis return state
  const [cathedisRef, setCathedisRef] = useState('');
  const [cathedisOrders, setCathedisOrders] = useState<any[]>([]);
  const [cathedisOrder, setCathedisOrder] = useState<any>(null);
  const [cathedisSearching, setCathedisSearching] = useState(false);

  // History state
  const [historyReturns, setHistoryReturns] = useState<HistoryReturn[]>([]);
  const [historyFilter, setHistoryFilter] = useState<FilterType | null>('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyType, setHistoryType] = useState<'all' | 'magasin' | 'cathedis'>('all');


  // Get storeId on mount
  useEffect(() => {
    const loadStore = async () => {
      const cachedStoreId = localStorage.getItem(`pos_store_${storeSlug}`);
      if (cachedStoreId) {
        setStoreId(cachedStoreId);
        setIsLoadingStore(false);
        return;
      }

      if (user?.storeId) {
        setStoreId(user.storeId);
        localStorage.setItem(`pos_store_${storeSlug}`, user.storeId);
        setIsLoadingStore(false);
        return;
      }

      setIsLoadingStore(true);
      try {
        const response = await api.get('/stock/all-stores');
        if (response.data.success) {
          const stores = response.data.data?.stores || [];
          const store = stores.find((s: any) => s.slug === storeSlug);
          if (store) {
            setStoreId(store.id);
            localStorage.setItem(`pos_store_${storeSlug}`, store.id);
          }
        }
      } catch (error) {
        console.error('Error loading store:', error);
      } finally {
        setIsLoadingStore(false);
      }
    };
    loadStore();
  }, [storeSlug, user]);

  // Load today's returns from API on mount
  useEffect(() => {
    if (!storeId) return;
    const loadTodayReturns = async () => {
      try {
        const response = await api.get('/returns/today');
        if (response.data.success) {
          setTodayReturns(
            response.data.data.map((r: any) => ({
              id: r.id,
              returnNumber: r.returnNumber,
              productName: r.product?.name || '',
              shortCode: r.productVariation?.shortCode || r.product?.shortCode || '',
              reason: r.reason,
              condition: r.condition,
              createdAt: r.createdAt,
            }))
          );
        }
      } catch (error) {
        console.error('Error loading today returns:', error);
      }
    };
    loadTodayReturns();
  }, [storeId]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!storeId) return;
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams({ page: String(historyPage), limit: '20' });
      if (historyFilter) {
        params.set('filter', historyFilter);
      } else if (selectedDate) {
        params.set('date', selectedDate);
      }
      if (historyType !== 'all') params.set('type', historyType);
      const response = await api.get(`/returns/history?${params.toString()}`);
      if (response.data.success) {
        setHistoryReturns(response.data.data);
        setHistoryPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [storeId, historyFilter, selectedDate, historyPage, historyType]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter, selectedDate, historyType]);

  // Debounced name search
  useEffect(() => {
    if (!scanCode || scanCode.length < 2 || !storeId) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Skip debounced search if input looks like a barcode/shortCode (contains dash)
    // Name search still works for all-caps names like "SLIM FIT"
    if (scanCode.includes('-')) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await api.get(`/stock/store/${storeId}/search?q=${encodeURIComponent(scanCode)}&limit=10&forReturn=true`);
        if (response.data.success && response.data.data) {
          setSearchResults(response.data.data);
          setShowResults(response.data.data.length > 0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [scanCode, storeId]);

  const handleCathedisSearch = async () => {
    if (!cathedisRef.trim()) return;
    setCathedisSearching(true);
    setCathedisOrders([]);
    setCathedisOrder(null);
    try {
      const response = await api.get(`/orders/search-by-order-ref?ref=${encodeURIComponent(cathedisRef.trim())}`);
      if (response.data.success) {
        const orders = response.data.data;
        if (orders.length === 1) {
          setCathedisOrder(orders[0]);
        } else if (orders.length > 1) {
          setCathedisOrders(orders);
        }
      }
    } catch (error) {
      console.error('Cathedis search error:', error);
      alert('Erreur lors de la recherche');
    } finally {
      setCathedisSearching(false);
    }
  };

  const addProduct = (product: SelectedProduct) => {
    setFoundProducts(prev => [...prev, product]);
    setRefundAmounts(prev => [...prev, Number(product.price)]);
  };

  const selectFromStock = (stockItem: StockItem) => {
    addProduct({
      productId: stockItem.productId,
      variationId: stockItem.variationId,
      productName: stockItem.productName,
      shortCode: stockItem.shortCode,
      size: stockItem.size,
      length: stockItem.length,
      price: Number(stockItem.price),
    });
    setSearchResults([]);
    setShowResults(false);
    setScanCode('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleSearch = async () => {
    if (!scanCode || !storeId) return;

    setIsSearching(true);
    setShowResults(false);
    try {
      const response = await api.get(`/stock/store/${storeId}/by-code/${encodeURIComponent(scanCode)}?forReturn=true`);
      if (response.data.success && response.data.data) {
        const stockItem = response.data.data;
        addProduct({
          productId: stockItem.productId,
          variationId: stockItem.variationId,
          productName: stockItem.productName,
          shortCode: stockItem.shortCode,
          size: stockItem.size,
          length: stockItem.length,
          price: Number(stockItem.price),
        });
        setScanCode('');
        setTimeout(() => scanInputRef.current?.focus(), 100);
      } else {
        const searchResponse = await api.get(`/stock/store/${storeId}/search?q=${encodeURIComponent(scanCode)}&limit=10&forReturn=true`);
        if (searchResponse.data.success && searchResponse.data.data?.length > 0) {
          setSearchResults(searchResponse.data.data);
          setShowResults(true);
        } else {
          alert(`Produit non trouve: ${scanCode}`);
        }
      }
    } catch (error: any) {
      // Offline fallback
      console.warn('[RETURNS] API offline, falling back to product cache');
      let found = findProductByCode(scanCode);

      if (!found) {
        try {
          const stockRaw = localStorage.getItem('pos_stock_all_stores');
          if (stockRaw) {
            const stockData = JSON.parse(stockRaw);
            const stockList = stockData?.stock || stockData || [];
            for (const product of stockList) {
              const variation = product.variations?.find(
                (v: any) => v.shortCode?.toLowerCase() === scanCode.toLowerCase()
              );
              if (variation) {
                found = {
                  productId: product.productId,
                  variationId: variation.id,
                  productName: product.productName,
                  shortCode: variation.shortCode,
                  size: variation.size || '',
                  length: variation.length || '',
                  price: 0,
                };
                break;
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      if (found) {
        addProduct({
          productId: found.productId,
          variationId: found.variationId,
          productName: found.productName,
          shortCode: found.shortCode,
          size: found.size,
          length: found.length,
          price: Number(found.price),
        });
        setScanCode('');
        setTimeout(() => scanInputRef.current?.focus(), 100);
      } else {
        alert(`Produit non trouve: ${scanCode}\n(Mode hors-ligne - verifiez le code)`);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (foundProducts.length === 0 || !reason || !condition) return;

    setIsSubmitting(true);
    try {
      const responses = [];
      for (let i = 0; i < foundProducts.length; i++) {
        const product = foundProducts[i];
        const response = await api.post('/returns', {
          productId: product.productId,
          productVariationId: product.variationId,
          reason,
          condition,
          notes: notes || null,
          refundAmount: reason === 'REMBOURSEMENT' ? (refundAmounts[i] || 0) : 0,
          orderId: reason === 'RETOUR_CATHEDIS' ? (cathedisOrder?.id || null) : null,
        });
        responses.push(response);
      }

      const allSuccess = responses.every(r => r.data.success);

      if (allSuccess) {
        // Clear product stock cache so stock page reflects the return immediately
        if (storeId) {
          localStorage.removeItem(`products_cache_${storeId}`);
          localStorage.removeItem(`products_cache_timestamp_${storeId}`);
        }

        setShowSuccess(true);

        setTimeout(() => {
          setShowSuccess(false);
          if (scanInputRef.current) {
            scanInputRef.current.focus();
          }
        }, 3000);

        const newReturns = responses.map((response, index) => ({
          id: response.data.data.id,
          returnNumber: response.data.data.returnNumber,
          productName: foundProducts[index].productName,
          shortCode: foundProducts[index].shortCode,
          reason,
          condition,
          createdAt: new Date().toISOString(),
        }));

        setTodayReturns(prev => [...newReturns, ...prev]);

        openDrawer().then(success => {
          if (success) {
            console.log('[DRAWER] ✓ Cash drawer opened for return');
          }
        }).catch(err => {
          console.error('[DRAWER] Error opening drawer:', err);
        });

        if (activeTab === 'history') {
          loadHistory();
        }

        setFoundProducts([]);
        setRefundAmounts([]);
        setScanCode('');
        setReason('');
        setCondition('');
        setNotes('');
        setCathedisRef('');
        setCathedisOrders([]);
        setCathedisOrder(null);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scanInputRef.current) {
              scanInputRef.current.focus();
            }
          });
        });
      } else {
        alert('Certains retours ont echoue');
      }
    } catch (error: any) {
      console.error('Error creating return:', error);
      alert(error.response?.data?.message || 'Erreur lors du retour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFoundProducts([]);
    setRefundAmounts([]);
    setScanCode('');
    setReason('');
    setCondition('');
    setNotes('');
    setCathedisRef('');
    setCathedisOrders([]);
    setCathedisOrder(null);
    scanInputRef.current?.focus();
  };

  const removeProduct = (index: number) => {
    setFoundProducts(prev => prev.filter((_, i) => i !== index));
    setRefundAmounts(prev => prev.filter((_, i) => i !== index));
    scanInputRef.current?.focus();
  };

  const totalRefund = refundAmounts.reduce((sum, a) => sum + a, 0);

  if (isLoadingStore) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleOpenDrawer = async () => {
    if (!printerState.isConnected) {
      const connected = await connectPrinter();
      if (!connected) {
        alert('Impossible de connecter l\'imprimante. Verifiez la connexion USB.');
        return;
      }
    }
    const success = await openDrawer();
    if (!success) {
      alert('Erreur lors de l\'ouverture du tiroir-caisse');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-bold text-lg">Retours</h2>
        <p className="text-sm text-gray-500">Scanner l'article a retourner</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${
              activeTab === 'new'
                ? 'text-orange-600 border-b-2 border-orange-400 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Nouveau Retour
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'text-orange-600 border-b-2 border-orange-400 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Historique
          </button>
        </div>
      </div>

      {/* ===== NEW RETURN TAB ===== */}
      {activeTab === 'new' && (
        <>
          {/* Scan Input */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scanner ou rechercher l'article:
            </label>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="Code-barre, code produit ou nom..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                  autoFocus
                  disabled={!storeId}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !storeId}
                  className="px-6 py-3 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:bg-gray-300"
                >
                  {isSearching ? '...' : 'OK'}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectFromStock(item)}
                      className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-500">
                          {item.shortCode}
                          {item.size && ` - T${item.size}/L${item.length}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${item.stockQuantity > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        Stock: {item.stockQuantity}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isSearching && <p className="text-sm text-gray-500 mt-2">Recherche...</p>}
          </div>

          {/* Found Products List */}
          {foundProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Articles scannes ({foundProducts.length}):</p>
                {foundProducts.map((product, index) => (
                  <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{product.productName}</p>
                      <p className="text-xs text-gray-600">Code: {product.shortCode}</p>
                      {product.size && (
                        <p className="text-xs text-gray-500">
                          Taille: {product.size} / Longueur: {product.length}
                        </p>
                      )}
                      <p className="text-sm font-medium mt-1">{Number(product.price).toFixed(2)} DH</p>
                      {reason === 'REMBOURSEMENT' && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-600">Remboursement:</span>
                          <input
                            type="number"
                            value={refundAmounts[index] ?? product.price}
                            onChange={(e) => {
                              const newAmounts = [...refundAmounts];
                              newAmounts[index] = Number(e.target.value);
                              setRefundAmounts(newAmounts);
                            }}
                            className="w-24 px-2 py-1 text-sm border border-orange-300 rounded bg-white"
                            min="0"
                            step="1"
                          />
                          <span className="text-xs text-gray-600">DH</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeProduct(index)}
                      className="ml-2 p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Retirer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Total refund (only for REMBOURSEMENT) */}
              {reason === 'REMBOURSEMENT' && (
                <div className="flex justify-end">
                  <p className="text-sm font-bold text-orange-600">
                    Total a rembourser: {totalRefund.toFixed(2)} DH
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de retour:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RETURN_REASONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setReason(r.value); setCathedisRef(''); setCathedisOrders([]); setCathedisOrder(null); }}
                      className={`py-3 px-4 rounded-lg border text-left ${
                        reason === r.value
                          ? 'bg-orange-400 text-white border-orange-400'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium text-sm">{r.label}</p>
                      <p className={`text-xs ${reason === r.value ? 'text-white/80' : 'text-gray-500'}`}>
                        {r.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cathedis phone search — shown only for RETOUR_CATHEDIS */}
              {reason === 'RETOUR_CATHEDIS' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    N° de commande:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cathedisRef}
                      onChange={e => setCathedisRef(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCathedisSearch()}
                      placeholder="202603115937 ou 5937"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={handleCathedisSearch}
                      disabled={cathedisSearching || !cathedisRef.trim()}
                      className="px-4 py-3 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:bg-gray-300"
                    >
                      {cathedisSearching ? '...' : 'Chercher'}
                    </button>
                  </div>

                  {/* Multiple results */}
                  {cathedisOrders.length > 1 && !cathedisOrder && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {cathedisOrders.map(o => (
                        <button
                          key={o.id}
                          onClick={() => { setCathedisOrder(o); setCathedisOrders([]); }}
                          className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b last:border-0"
                        >
                          <p className="font-medium text-sm">{o.orderNumber}</p>
                          <p className="text-xs text-gray-500">{o.products?.slice(0, 60)}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected order */}
                  {cathedisOrder && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm text-green-900">{cathedisOrder.orderNumber} ✓</p>
                          <p className="text-xs text-green-700">{cathedisOrder.customerName}</p>
                          <div className="mt-1 space-y-0.5">
                            {cathedisOrder.products?.split(', ').map((p: string, i: number) => (
                              <p key={i} className="text-xs text-gray-600">• {p}</p>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => setCathedisOrder(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                      </div>
                    </div>
                  )}

                  {cathedisOrders.length === 0 && !cathedisOrder && cathedisRef && !cathedisSearching && (
                    <p className="text-sm text-gray-400 italic">Aucune commande trouvée</p>
                  )}
                </div>
              )}

              {/* Condition — always shown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etat de l'article:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITION_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setCondition(c.value)}
                      className={`py-3 px-4 rounded-lg border text-left ${
                        condition === c.value
                          ? c.value === 'RESTOCKABLE'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium">{c.label}</p>
                      <p className={`text-xs ${condition === c.value ? 'text-white/80' : 'text-gray-500'}`}>
                        {c.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details supplementaires..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={!reason || !condition || isSubmitting || foundProducts.length === 0}
                  className="flex-1 py-3 bg-orange-400 text-white rounded-lg font-medium hover:bg-orange-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Traitement...' : `Traiter ${foundProducts.length > 1 ? `les ${foundProducts.length} retours` : 'le retour'}`}
                </button>
              </div>
            </div>
          )}

          {/* Today's Returns */}
          {todayReturns.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-3">Retours du jour ({todayReturns.length})</h3>
              <div className="space-y-2">
                {todayReturns.map(ret => (
                  <div key={ret.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-mono text-sm">{ret.shortCode}</p>
                      <p className="text-xs text-gray-500">{ret.productName}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ret.reason === 'ECHANGE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {REASON_LABELS[ret.reason] || ret.reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeTab === 'history' && (
        <>
          {/* Type filter */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="flex gap-2">
              {([['all', 'Tous'], ['magasin', 'Magasin'], ['cathedis', 'Cathedis']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setHistoryType(val)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    historyType === val ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {QUICK_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setHistoryFilter(f.value);
                      if (f.value === 'today') {
                        setSelectedDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      historyFilter === f.value
                        ? 'bg-orange-400 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={historyFilter ? '' : selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setHistoryFilter(null);
                }}
                className="px-3 py-1.5 border rounded-lg text-sm"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {!isLoadingHistory && (
              <p className="text-xs text-gray-500 mt-2">
                {historyPagination.total} retour{historyPagination.total !== 1 ? 's' : ''} trouve{historyPagination.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* History List */}
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full"></div>
            </div>
          ) : historyReturns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Aucun retour pour cette periode
            </div>
          ) : (
            <div className="space-y-3">
              {groupReturns(historyReturns).map((group, groupIndex) => (
                <div key={`group-${groupIndex}`} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-sm text-orange-600 font-medium">
                          {group.length > 1 ? `${group[0].returnNumber.split('-')[0]}-XXX` : group[0].returnNumber}
                        </p>
                        {group.length > 1 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            {group.length} articles
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Type: {REASON_LABELS[group[0].reason] || group[0].reason}
                      </p>
                      {group[0].createdBy && (
                        <p className="text-xs text-gray-500">Par: {group[0].createdBy.fullName}</p>
                      )}
                      {group[0].order && (
                        <p className="text-xs text-orange-600 font-medium">Commande: {group[0].order.orderNumber}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        group[0].reason === 'ECHANGE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {REASON_LABELS[group[0].reason] || group[0].reason}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        group[0].condition === 'RESTOCKABLE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {group[0].condition === 'RESTOCKABLE' ? 'Restocke' : 'Defectueux'}
                      </span>
                      <p className="text-xs text-gray-500">{formatDate(group[0].createdAt)}</p>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="space-y-1.5 border-t pt-2">
                    {group.map((ret, index) => (
                      <div key={ret.id} className="flex items-center gap-2 py-1.5">
                        <span className="text-xs text-gray-400 font-mono w-4">{index + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{ret.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {ret.productVariation?.shortCode || ret.product.shortCode}
                            {ret.productVariation?.size && ` - T${ret.productVariation.size}`}
                            {ret.productVariation?.length && `/L${ret.productVariation.length}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {group[0].notes && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Notes:</span> {group[0].notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {historyPagination.totalPages > 1 && (
            <div className="flex justify-between items-center bg-white rounded-lg shadow p-3">
              <button
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Precedent
              </button>
              <span className="text-sm text-gray-600">
                {historyPage} / {historyPagination.totalPages}
              </span>
              <button
                onClick={() => setHistoryPage(p => Math.min(historyPagination.totalPages, p + 1))}
                disabled={historyPage >= historyPagination.totalPages}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg z-50">
          <p className="font-bold">Retour traite!</p>
          <p className="text-sm">
            {reason === 'REMBOURSEMENT'
              ? `Remboursement: ${totalRefund.toFixed(2)} DH`
              : reason === 'RETOUR_CATHEDIS'
              ? 'Retour Cathedis - Stock mis a jour'
              : 'Echange - Article restocke automatiquement'}
          </p>
        </div>
      )}
    </div>
  );
}
