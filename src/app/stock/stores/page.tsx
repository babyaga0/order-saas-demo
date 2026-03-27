'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '@/lib/api';
import { generateStoreStockPDF } from '@/utils/storeStockPDF';

interface Store {
  id: string;
  name: string;
  slug: string;
}

interface Variation {
  id: number;
  shortCode: string;
  size: string;
  length: string | null;
  stores: Record<string, number>;
}

interface StockProduct {
  productId: number;
  productName: string;
  shortCode: string;
  categories: string | null;
  variations: Variation[];
  storeStock?: Record<string, number>;
}

interface AllStoresData {
  stores: Store[];
  stock: StockProduct[];
}

const CATEGORIES = [
  { value: 'jeans',       label: 'Jeans',       dot: 'bg-blue-500',   active: 'border-blue-500 text-blue-600',   accent: 'bg-blue-500'   },
  { value: 'vestes',      label: 'Vestes',      dot: 'bg-purple-500', active: 'border-purple-500 text-purple-600', accent: 'bg-purple-500' },
  { value: 'ensembles',   label: 'Ensembles',   dot: 'bg-teal-500',   active: 'border-teal-500 text-teal-600',   accent: 'bg-teal-500'   },
  { value: 'accessoires', label: 'Accessoires', dot: 'bg-amber-500',  active: 'border-amber-500 text-amber-600', accent: 'bg-amber-500'  },
];

const CACHE_KEY = 'stock_all_stores_v2';
const CACHE_TTL = 5 * 60 * 1000;

const stockBadge = (qty: number) => {
  if (qty === 0)   return { dot: 'bg-red-400',   pill: 'bg-red-50 text-red-700 border border-red-200'   };
  if (qty <= 10)   return { dot: 'bg-amber-400',  pill: 'bg-amber-50 text-amber-700 border border-amber-200' };
  return           { dot: 'bg-green-400', pill: 'bg-green-50 text-green-700 border border-green-200' };
};

export default function MultiStoreStockPage() {
  const router = useRouter();
  const { isSidebarCollapsed } = useLayout();
  const [data, setData] = useState<AllStoresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('jeans');
  const [selectedStoreSlug, setSelectedStoreSlug] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingStore, setDownloadingStore] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (!['ADMIN', 'SUPER_ADMIN', 'PRODUCTION', 'FACTORY_MANAGER'].includes(user.role)) {
        router.push('/dashboard'); return;
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data: d, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setData(d);
          setLoading(false);
        }
      }
      const response = await api.get('/stock/all-stores');
      if (response.data.success) {
        setData(response.data.data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: response.data.data, ts: Date.now() })); } catch {}
      }
    } catch {
      toast.error('Erreur lors du chargement du stock');
    } finally {
      setLoading(false);
    }
  };

  const getQty = (stores: Record<string, number>, slug: string | null) => {
    if (!stores) return 0;
    if (slug) return stores[slug] || 0;
    return Object.values(stores).reduce((s, q) => s + q, 0);
  };

  // Total stock per store (for summary cards)
  const storeTotals = useMemo((): Record<string, number> => {
    if (!data) return {};
    const totals: Record<string, number> = {};
    data.stores.forEach(s => { totals[s.slug] = 0; });
    data.stock.forEach(p => {
      if (p.variations?.length > 0) {
        p.variations.forEach(v => {
          Object.entries(v.stores).forEach(([slug, qty]) => { totals[slug] = (totals[slug] || 0) + qty; });
        });
      } else if (p.storeStock) {
        Object.entries(p.storeStock).forEach(([slug, qty]) => { totals[slug] = (totals[slug] || 0) + qty; });
      }
    });
    return totals;
  }, [data]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.stock || []).forEach(p => {
      const cat = p.categories || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [data]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return (data?.stock || []).filter(p => {
      const catMatch = p.categories === activeCategory;
      const searchMatch = !searchTerm ||
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.shortCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      return catMatch && searchMatch;
    });
  }, [data, activeCategory, searchTerm]);

  const stores = data?.stores || [];
  const displayStores = selectedStoreSlug ? stores.filter(s => s.slug === selectedStoreSlug) : stores;

  // Build flat row list for the table
  const tableRows = useMemo(() => {
    return filteredProducts.flatMap((product, pIdx) => {
      if (!product.variations || product.variations.length === 0) {
        return [{ key: `acc-${product.productId}`, pIdx, product, variation: null as Variation | null, isFirst: true }];
      }
      return product.variations.map((variation, vIdx) => ({
        key: `${product.productId}-${variation.id}`,
        pIdx,
        product,
        variation,
        isFirst: vIdx === 0,
      }));
    });
  }, [filteredProducts]);

  const handleDownloadPDF = (e: React.MouseEvent, store: Store) => {
    e.stopPropagation(); // don't trigger store filter click
    if (!data || downloadingStore) return;
    setDownloadingStore(store.slug);
    try {
      generateStoreStockPDF(store, data.stock);
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setDownloadingStore(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-h-screen bg-gray-50 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-500">Chargement du stock...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="mb-6">
              <button
                onClick={() => router.push('/stock')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour au stock
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Vue Multi-Magasins</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Stock en temps réel par magasin</p>
                </div>
                {selectedStoreSlug && (
                  <button
                    onClick={() => setSelectedStoreSlug(null)}
                    className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    Voir tous les magasins
                  </button>
                )}
              </div>
            </div>

            {/* Store Summary Cards */}
            <div className={`grid gap-4 mb-6 ${stores.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
              {stores.map(store => {
                const isSelected = selectedStoreSlug === store.slug;
                const total = storeTotals[store.slug] || 0;
                return (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStoreSlug(isSelected ? null : store.slug)}
                    className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md select-none ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-blue-100'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏪</span>
                        <span className={`font-semibold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                          {store.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Actif</span>
                        )}
                        <button
                          onClick={(e) => handleDownloadPDF(e, store)}
                          disabled={!!downloadingStore}
                          title={`Télécharger PDF — ${store.name}`}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            downloadingStore === store.slug
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-300 shadow-sm'
                          }`}
                        >
                          {downloadingStore === store.slug ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
                            </svg>
                          )}
                          PDF
                        </button>
                      </div>
                    </div>
                    <p className={`text-3xl font-bold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                      {total.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">unités en stock</p>
                    <p className={`text-xs mt-2 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                      {isSelected ? 'Cliquer pour désélectionner' : 'Cliquer pour filtrer'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Category Tabs + Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => { setActiveCategory(cat.value); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                      activeCategory === cat.value
                        ? `${cat.active} border-current bg-gray-50`
                        : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cat.dot}`}></span>
                    {cat.label}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      activeCategory === cat.value ? 'bg-white shadow-sm text-gray-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {categoryCounts[cat.value] || 0}
                    </span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            {tableRows.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-gray-500 font-medium">Aucun produit trouvé</p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchTerm ? 'Essayez un autre terme de recherche' : 'Aucun stock enregistré dans cette catégorie'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{filteredProducts.length}</span> produit{filteredProducts.length > 1 ? 's' : ''}
                    {selectedStoreSlug && (
                      <span className="ml-2 text-blue-600 font-medium">
                        · {stores.find(s => s.slug === selectedStoreSlug)?.name}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> &gt;10</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> 1–10</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> 0</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Produit / Variation
                        </th>
                        {!selectedStoreSlug && (
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Total
                          </th>
                        )}
                        {displayStores.map(store => (
                          <th key={store.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {store.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map(({ key, pIdx, product, variation, isFirst }) => {
                        const isEven = pIdx % 2 === 0;
                        const rowBg = isEven ? 'bg-white' : 'bg-gray-50/40';

                        // Accessory row (no variation)
                        if (!variation) {
                          const storeStock = product.storeStock || {};
                          const total = getQty(storeStock, null);
                          const s = stockBadge(total);
                          return (
                            <tr key={key} className={`${rowBg} hover:bg-blue-50/30 transition-colors border-b border-gray-50`}>
                              <td className="px-5 py-3">
                                <div className="font-semibold text-gray-900 text-sm">{product.productName}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">{product.shortCode}</div>
                              </td>
                              {!selectedStoreSlug && (
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${s.pill}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                                    {total}
                                  </span>
                                </td>
                              )}
                              {displayStores.map(store => {
                                const qty = storeStock[store.slug] || 0;
                                const bs = stockBadge(qty);
                                return (
                                  <td key={store.id} className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${bs.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${bs.dot}`}></span>
                                      {qty}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }

                        // Variation row
                        const total = getQty(variation.stores, null);
                        const s = stockBadge(total);
                        return (
                          <tr key={key} className={`${rowBg} hover:bg-blue-50/30 transition-colors border-b border-gray-50`}>
                            <td className="px-5 py-2.5">
                              {isFirst && (
                                <div className="font-semibold text-gray-900 text-sm mb-1">{product.productName}</div>
                              )}
                              <div className="flex items-center gap-2 pl-3 border-l-2 border-gray-200">
                                <span className="text-sm text-gray-700 font-medium">
                                  {variation.length
                                    ? `T${variation.size} / L${variation.length}`
                                    : `Taille ${variation.size}`}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">{variation.shortCode}</span>
                              </div>
                            </td>
                            {!selectedStoreSlug && (
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${s.pill}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                                  {total}
                                </span>
                              </td>
                            )}
                            {displayStores.map(store => {
                              const qty = variation.stores[store.slug] || 0;
                              const bs = stockBadge(qty);
                              return (
                                <td key={store.id} className="px-4 py-2.5 text-center">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${bs.pill}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${bs.dot}`}></span>
                                    {qty}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}
