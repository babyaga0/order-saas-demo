'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type StockItem = {
  productId: number;
  productName: string;
  shortCode: string;
  imageUrl?: string;
  variations: {
    id: number;
    shortCode: string;
    size: string;
    length: string;
    stores: Record<string, number>;
  }[];
  storeStock?: Record<string, number>; // accessories only (no variations)
};

type Store = {
  slug: string;
  name: string;
  id: string;
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Shared cache keys with the Vente page (useProductCache) — same data, no duplicate API calls
const SHARED_CACHE_KEY_PREFIX = 'products_cache_';
const SHARED_CACHE_TS_PREFIX = 'products_cache_timestamp_';

// Images cached separately with 24h TTL (same keys as useProductCache)
const IMAGE_CACHE_KEY_PREFIX = 'products_images_';
const IMAGE_CACHE_TS_PREFIX = 'products_images_ts_';
const IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function readImageCache(storeId: string): Record<number, string> {
  try {
    const raw = localStorage.getItem(`${IMAGE_CACHE_KEY_PREFIX}${storeId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function mergeStockImages(items: StockItem[], imageMap: Record<number, string>): StockItem[] {
  if (Object.keys(imageMap).length === 0) return items;
  return items.map(item => ({ ...item, imageUrl: imageMap[item.productId] || item.imageUrl }));
}

/**
 * Derive the API-side store slug before any network call.
 * The Vente page stores `pos_store_name_${urlSlug}` = the store's real DB name
 * (e.g. "Ain Sbaa") every time it successfully resolves the store. We use that
 * to compute the same slug the backend generates, eliminating the URL-slug vs
 * API-slug mismatch that caused CE MAGASIN to show 0 stock.
 * Falls back to user.store.name, then to the raw URL slug.
 */
function getInitialApiSlug(urlSlug: string): string {
  try {
    const storedName = localStorage.getItem(`pos_store_name_${urlSlug}`);
    if (storedName) return storedName.toLowerCase().replace(/\s+/g, '-');

    const userData = localStorage.getItem('user');
    const userStore = userData ? JSON.parse(userData)?.store : null;
    if (userStore?.name) return userStore.name.toLowerCase().replace(/\s+/g, '-');
  } catch { /* ignore */ }
  return urlSlug;
}

export default function POSStockPage() {
  const params = useParams();
  const currentStoreSlug = params['store-slug'] as string;
  const { user } = useAuth();

  // Compute the correct API slug once, synchronously from localStorage.
  const initialApiSlug = useRef(getInitialApiSlug(currentStoreSlug)).current;

  const [searchQuery, setSearchQuery] = useState('');
  // CE MAGASIN starts with the correct API slug — no mismatch, no 0-stock flash
  const [selectedStore, setSelectedStore] = useState<string | 'ALL'>(initialApiSlug);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  // All-stores data is loaded lazily — only when user clicks TOUS
  const [hasAllStoresData, setHasAllStoresData] = useState(false);
  const [isLoadingAllStores, setIsLoadingAllStores] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string>(
    localStorage.getItem(`pos_store_name_${currentStoreSlug}`) || user?.store?.name || ''
  );
  const [storeSlugFromApi, setStoreSlugFromApi] = useState<string>(initialApiSlug);

  /**
   * Convert single-store API response (`/stock/store/:id/products`) to StockItem format.
   * The single-store endpoint returns { variationId, stock } per variation.
   * We convert to { id, stores: { [storeSlug]: qty } } so the existing UI works unchanged.
   */
  const convertSingleStore = useCallback((products: any[], storeSlug: string): StockItem[] => {
    return products.map(p => {
      if (p.variations.length === 0) {
        // Accessory — no size variations, stock on the product itself
        return {
          productId: p.productId,
          productName: p.productName,
          shortCode: p.shortCode,
          imageUrl: p.imageUrl || undefined,
          variations: [],
          storeStock: { [storeSlug]: p.totalStock },
        };
      }
      return {
        productId: p.productId,
        productName: p.productName,
        shortCode: p.shortCode,
        imageUrl: p.imageUrl || undefined,
        variations: p.variations.map((v: any) => ({
          id: v.variationId,
          shortCode: v.shortCode,
          size: v.size,
          length: v.length,
          stores: { [storeSlug]: v.stock },
        })),
      };
    });
  }, []);

  /**
   * Apply full multi-store data from `/stock/all-stores`.
   * Matches the current store using 3 fallbacks in order of reliability.
   */
  const applyAllStoresData = useCallback((data: any) => {
    setStockData(data?.stock || []);
    if (!data?.stores) return;

    setStores(data.stores);

    // 1) Exact URL slug match
    let currentStore: Store | undefined = data.stores.find(
      (s: Store) => s.slug === currentStoreSlug
    );
    // 2) Stored ID from a previous successful visit
    if (!currentStore) {
      const storedId = localStorage.getItem(`pos_store_${currentStoreSlug}`);
      if (storedId) currentStore = data.stores.find((s: Store) => s.id === storedId);
    }
    // 3) user.storeId from auth token — most reliable, handles any slug mismatch
    if (!currentStore) {
      try {
        const userData = localStorage.getItem('user');
        const userStoreId = userData ? JSON.parse(userData)?.storeId : null;
        if (userStoreId) currentStore = data.stores.find((s: Store) => s.id === userStoreId);
      } catch { /* ignore */ }
    }

    if (currentStore) {
      setCurrentStoreName(currentStore.name);
      setStoreSlugFromApi(currentStore.slug);
      localStorage.setItem(`pos_store_${currentStoreSlug}`, currentStore.id);
      localStorage.setItem(`pos_store_name_${currentStoreSlug}`, currentStore.name);
    }
  }, [currentStoreSlug]);

  /**
   * Fetch product images in the background and apply to stockData.
   * Skips the API call if the 24h image cache is still fresh.
   * Fire-and-forget — never blocks rendering.
   */
  const loadImages = useCallback(async (storeId: string) => {
    const imgTsKey = `${IMAGE_CACHE_TS_PREFIX}${storeId}`;
    const imgTs = parseInt(localStorage.getItem(imgTsKey) || '0');
    if (Date.now() - imgTs < IMAGE_CACHE_DURATION) return; // still fresh
    try {
      const imgRes = await api.get(`/stock/store/${storeId}/images`);
      if (imgRes.data.success) {
        const images = imgRes.data.data;
        try {
          localStorage.setItem(`${IMAGE_CACHE_KEY_PREFIX}${storeId}`, JSON.stringify(images));
          localStorage.setItem(imgTsKey, Date.now().toString());
        } catch { /* storage full */ }
        setStockData(prev => mergeStockImages(prev, images));
      }
    } catch { /* images optional — don't show error */ }
  }, []);

  /**
   * Load only THIS store's stock (fast path).
   * Reads from the SAME cache the Vente page fills (products_cache_${storeId}).
   * If the cashier opened the Vente tab first (which they always do), this shows INSTANTLY
   * with zero API call — the data is already in localStorage.
   */
  const loadStoreStock = useCallback(async (force = false) => {
    let storeId: string | null = null;
    try {
      const userData = localStorage.getItem('user');
      storeId = userData ? JSON.parse(userData)?.storeId : null;
    } catch { /* ignore */ }

    if (!storeId) {
      // No storeId — stop spinner so page doesn't hang forever
      setLoading(false);
      return;
    }

    // Use the same cache key as the Vente page (useProductCache hook)
    const cacheKey = `${SHARED_CACHE_KEY_PREFIX}${storeId}`;
    const cacheTsKey = `${SHARED_CACHE_TS_PREFIX}${storeId}`;
    const imageMap = readImageCache(storeId);

    const cached = localStorage.getItem(cacheKey);
    const cachedTs = parseInt(localStorage.getItem(cacheTsKey) || '0');
    const isCacheFresh = Date.now() - cachedTs < CACHE_TTL;

    if (cached) {
      // Show instantly from cache, merge images from image cache
      const items = convertSingleStore(JSON.parse(cached), initialApiSlug);
      setStockData(mergeStockImages(items, imageMap));
      setLoading(false);
      loadImages(storeId); // background — fetches images if cache is stale
      if (isCacheFresh && !force) return;
    }

    // Fetch fresh data
    try {
      const response = await api.get(`/stock/store/${storeId}/products`);
      if (response.data.success) {
        const raw = response.data.data;
        const items = convertSingleStore(raw, initialApiSlug);
        setStockData(mergeStockImages(items, imageMap));
        setLoading(false);
        loadImages(storeId); // background — fetches images if cache is stale
        try {
          localStorage.setItem(cacheKey, JSON.stringify(raw));
          localStorage.setItem(cacheTsKey, Date.now().toString());
        } catch { /* storage full */ }
      }
    } catch {
      setLoading(false);
    }
  }, [convertSingleStore, initialApiSlug, loadImages]);

  /**
   * Load all stores (heavy path — only called when user clicks TOUS tab).
   * On subsequent clicks (data already loaded), just switches the tab.
   */
  const loadAllStores = useCallback(async () => {
    if (hasAllStoresData) {
      setSelectedStore('ALL');
      return;
    }
    setIsLoadingAllStores(true);
    try {
      const response = await api.get('/stock/all-stores');
      if (response.data.success) {
        applyAllStoresData(response.data.data);
        setHasAllStoresData(true);
        setSelectedStore('ALL');
        // Apply/refresh images for all-stores view using current store's image cache
        try {
          const userData = localStorage.getItem('user');
          const storeId = userData ? JSON.parse(userData)?.storeId : null;
          if (storeId) {
            const imageMap = readImageCache(storeId);
            if (Object.keys(imageMap).length > 0) {
              setStockData(prev => mergeStockImages(prev, imageMap));
            }
            loadImages(storeId); // background refresh if stale
          }
        } catch { /* ignore */ }
      }
    } catch {
      // Failed — stay on current view
    } finally {
      setIsLoadingAllStores(false);
    }
  }, [hasAllStoresData, applyAllStoresData, loadImages]);

  // Initial load on mount — single store only (fast)
  useEffect(() => {
    loadStoreStock();
  }, [loadStoreStock]);

  // Auto-refresh single store every 5 minutes in the background
  useEffect(() => {
    const interval = setInterval(() => loadStoreStock(true), CACHE_TTL);
    return () => clearInterval(interval);
  }, [loadStoreStock]);

  // Filter products by search
  const filteredStock = stockData.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.shortCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by fit/product type (first word(s) of name)
  const getFitType = (name: string): string => {
    const words = name.trim().toUpperCase().split(/\s+/);
    if (words.length >= 2 && words[1] === 'FIT') return `${words[0]} FIT`;
    return words[0];
  };

  const groupedStock = Object.entries(
    filteredStock.reduce((groups, item) => {
      const fit = getFitType(item.productName);
      if (!groups[fit]) groups[fit] = [];
      groups[fit].push(item);
      return groups;
    }, {} as Record<string, StockItem[]>)
  ).sort(([a], [b]) => a.localeCompare(b));

  // Total stock for a product under the current filter
  const getTotalStock = (product: StockItem, storeFilter: string | 'ALL') => {
    if (product.variations.length === 0 && product.storeStock) {
      if (storeFilter === 'ALL') return Object.values(product.storeStock).reduce((a, b) => a + b, 0);
      return product.storeStock[storeFilter] || 0;
    }
    return product.variations.reduce((total, v) => {
      if (storeFilter === 'ALL') return total + Object.values(v.stores).reduce((a, b) => a + b, 0);
      return total + (v.stores[storeFilter] || 0);
    }, 0);
  };

  const getStockBadgeClass = (qty: number) => {
    if (qty === 0) return 'bg-red-100 text-red-700';
    if (qty <= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">
            Stock{' '}
            {currentStoreName ||
              currentStoreSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h1>
          {/* Refresh button — refreshes single store data */}
          <button
            onClick={() => loadStoreStock(true)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Actualiser"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par nom ou code..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
        />
      </div>

      {/* Store Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {/* CE MAGASIN — always available immediately */}
        <button
          onClick={() => setSelectedStore(storeSlugFromApi)}
          className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all ${
            selectedStore === storeSlugFromApi
              ? 'bg-orange-500 text-white shadow'
              : 'bg-orange-100 text-orange-800 border-2 border-orange-300'
          }`}
        >
          CE MAGASIN
        </button>

        {/* TOUS — triggers all-stores fetch on first click */}
        <button
          onClick={loadAllStores}
          disabled={isLoadingAllStores}
          className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-1.5 ${
            selectedStore === 'ALL'
              ? 'bg-orange-500 text-white shadow'
              : isLoadingAllStores
              ? 'bg-gray-100 text-gray-400 border cursor-default'
              : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        >
          {isLoadingAllStores && (
            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          )}
          TOUS
        </button>

        {/* Other stores (only visible after all-stores data loads) */}
        {stores
          .filter(s => s.slug !== storeSlugFromApi)
          .map(store => (
            <button
              key={store.slug}
              onClick={() => setSelectedStore(store.slug)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all ${
                selectedStore === store.slug
                  ? 'bg-orange-500 text-white shadow'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {store.name}
            </button>
          ))}
      </div>

      {/* Stock Cards */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin h-10 w-10 border-4 border-orange-400 border-t-transparent rounded-full mx-auto" />
          <p className="mt-3 text-gray-500">Chargement du stock...</p>
        </div>
      ) : filteredStock.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-gray-500 text-lg">Aucun produit trouve</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedStock.map(([fitType, groupProducts]) => (
            <div key={fitType}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold uppercase tracking-widest text-orange-500">{fitType}</span>
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400">{groupProducts.length} produit{groupProducts.length > 1 ? 's' : ''}</span>
              </div>
              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupProducts.map(product => {
            const totalStock = getTotalStock(product, selectedStore);
            const isExpanded = expandedProduct === product.productId;

            return (
              <div key={product.productId} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Product Header — clickable to expand */}
                <button
                  onClick={() => setExpandedProduct(isExpanded ? null : product.productId)}
                  className="w-full text-left"
                >
                  <div className="flex gap-3 p-3">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.productName}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{product.productName}</h3>
                      <p className="text-sm text-gray-500 font-mono">{product.shortCode}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 rounded-full text-sm font-bold ${getStockBadgeClass(totalStock)}`}>
                          {totalStock} en stock
                        </span>
                        <span className="text-sm text-gray-400">
                          {product.variations.length === 0
                            ? 'Accessoire'
                            : `${product.variations.length} taille${product.variations.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className="flex items-center">
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded Variations */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-3">
                    {/* Column headers for TOUS mode */}
                    {selectedStore === 'ALL' && stores.length > 0 && (
                      <div className="flex gap-2 mb-2 pb-2 border-b">
                        <div className="flex-1 text-xs font-medium text-gray-500">TAILLE</div>
                        {stores.map(store => (
                          <div
                            key={store.slug}
                            className={`w-16 text-center text-xs font-medium ${
                              store.slug === storeSlugFromApi ? 'text-orange-600' : 'text-gray-500'
                            }`}
                          >
                            {store.name.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rows */}
                    <div className="space-y-2">
                      {product.variations.length === 0 && product.storeStock ? (
                        // Accessory
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="font-medium text-gray-600">Accessoire</span>
                          </div>
                          {selectedStore === 'ALL' ? (
                            stores.map(store => {
                              const qty = product.storeStock![store.slug] || 0;
                              return (
                                <div key={store.slug} className={`w-16 text-center py-1 rounded ${getStockBadgeClass(qty)}`}>
                                  <span className="font-bold">{qty}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className={`w-20 text-center py-1 rounded ${getStockBadgeClass(product.storeStock[selectedStore] || 0)}`}>
                              <span className="font-bold">{product.storeStock[selectedStore] || 0}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        product.variations.map(variation => (
                          <div key={variation.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <span className="font-medium">T{variation.size}</span>
                              {variation.length && <span className="text-gray-400 text-sm">/L{variation.length}</span>}
                            </div>
                            {selectedStore === 'ALL' ? (
                              stores.map(store => {
                                const qty = variation.stores[store.slug] || 0;
                                return (
                                  <div key={store.slug} className={`w-16 text-center py-1 rounded ${getStockBadgeClass(qty)}`}>
                                    <span className="font-bold">{qty}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className={`w-20 text-center py-1 rounded ${getStockBadgeClass(variation.stores[selectedStore] || 0)}`}>
                                <span className="font-bold">{variation.stores[selectedStore] || 0}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Total row */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                      <div className="flex-1 font-bold text-gray-600">TOTAL</div>
                      {selectedStore === 'ALL' ? (
                        stores.map(store => {
                          const storeTotal =
                            product.variations.length === 0 && product.storeStock
                              ? product.storeStock[store.slug] || 0
                              : product.variations.reduce((sum, v) => sum + (v.stores[store.slug] || 0), 0);
                          return (
                            <div key={store.slug} className={`w-16 text-center py-1 rounded font-bold ${getStockBadgeClass(storeTotal)}`}>
                              {storeTotal}
                            </div>
                          );
                        })
                      ) : (
                        <div className={`w-20 text-center py-1 rounded font-bold ${getStockBadgeClass(totalStock)}`}>
                          {totalStock}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
