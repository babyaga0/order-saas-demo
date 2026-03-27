import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export type CachedProduct = {
  productId: number;
  productName: string;
  shortCode: string;
  imageUrl: string | null;
  basePrice: number;
  totalStock: number;
  variations: {
    variationId: number;
    shortCode: string;
    size: string;
    length: string;
    price: number;
    stock: number;
    imageUrl?: string;
  }[];
};

const CACHE_KEY_PREFIX = 'products_cache_';
const CACHE_TIMESTAMP_KEY = 'products_cache_timestamp_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Images cached separately — 24h TTL (images almost never change)
const IMAGE_CACHE_KEY_PREFIX = 'products_images_';
const IMAGE_CACHE_TS_PREFIX = 'products_images_ts_';
const IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function readImageCache(storeId: string): Record<number, string> {
  try {
    const raw = localStorage.getItem(`${IMAGE_CACHE_KEY_PREFIX}${storeId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function mergeImages(products: any[], imageMap: Record<number, string>): any[] {
  if (Object.keys(imageMap).length === 0) return products;
  return products.map(p => ({ ...p, imageUrl: imageMap[p.productId] || null }));
}

export function useProductCache(storeId: string | null) {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const loadProductsRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  const cacheKey = storeId ? `${CACHE_KEY_PREFIX}${storeId}` : null;
  const timestampKey = storeId ? `${CACHE_TIMESTAMP_KEY}${storeId}` : null;

  // Load from cache, Electron DB, or API
  const loadProducts = useCallback(async (force = false) => {
    if (!storeId) return;

    setIsLoading(true);
    try {
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

      if (isElectron) {
        // In Electron: Use local SQLite database (instant, no API calls)
        console.log('[CACHE] Using Electron local database');
        const electronProducts = await (window as any).electronAPI.getAllProducts();

        if (electronProducts && electronProducts.length > 0) {
          // Convert Electron products to grouped format
          const groupedMap = new Map<number, CachedProduct>();

          for (const item of electronProducts) {
            if (!groupedMap.has(item.productId)) {
              groupedMap.set(item.productId, {
                productId: item.productId,
                productName: item.productName,
                shortCode: item.shortCode,
                imageUrl: item.imageUrl || null,
                basePrice: item.price,
                totalStock: 0,
                variations: [],
              });
            }

            const product = groupedMap.get(item.productId)!;
            product.totalStock += item.stockQuantity || 0;
            product.variations.push({
              variationId: item.variationId,
              shortCode: item.shortCode,
              size: item.size || '',
              length: item.length || '',
              price: item.price,
              stock: item.stockQuantity || 0,
              imageUrl: item.imageUrl,
            });
          }

          const groupedProducts = Array.from(groupedMap.values());
          setProducts(groupedProducts);
          setLastSync(new Date());
          console.log('[CACHE] ✓ Loaded', groupedProducts.length, 'products from Electron DB (instant)');
          setIsLoading(false);
          return;
        } else {
          console.warn('[CACHE] Electron DB is empty, falling back to API');
        }
      }

      // Browser mode: stale-while-revalidate strategy
      if (cacheKey) {
        const cached = localStorage.getItem(cacheKey);
        const timestamp = timestampKey ? localStorage.getItem(timestampKey) : null;

        if (cached) {
          const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
          const imageMap = readImageCache(storeId);

          if (!force && age < CACHE_DURATION) {
            // Cache is fresh — use it and stop
            console.log('[CACHE] Using cached products, age:', Math.round(age / 1000), 's');
            setProducts(mergeImages(JSON.parse(cached), imageMap));
            setLastSync(new Date(parseInt(timestamp!)));
            setIsLoading(false);
            return;
          }

          // Cache is stale (or forced) — show immediately while refreshing in background
          console.log('[CACHE] Loading stale cache immediately, refreshing in background');
          setProducts(mergeImages(JSON.parse(cached), imageMap));
          setIsLoading(false);
        }
      }

      // Load from API (browser or Electron fallback)
      console.log('[CACHE] Fetching fresh products from API');
      const response = await api.get(`/stock/store/${storeId}/products`);

      if (response.data.success) {
        const freshProducts = response.data.data || [];

        // Merge images from local cache immediately (no extra API call needed if fresh)
        const imageMap = readImageCache(storeId);
        setProducts(mergeImages(freshProducts, imageMap));
        setLastSync(new Date());

        // Load/refresh images in background (24h TTL)
        const imgTsKey = `${IMAGE_CACHE_TS_PREFIX}${storeId}`;
        const imgTs = parseInt(localStorage.getItem(imgTsKey) || '0');
        const imgAge = Date.now() - imgTs;
        if (imgAge > IMAGE_CACHE_DURATION) {
          api.get(`/stock/store/${storeId}/images`).then(imgRes => {
            if (imgRes.data.success) {
              const images = imgRes.data.data;
              try {
                localStorage.setItem(`${IMAGE_CACHE_KEY_PREFIX}${storeId}`, JSON.stringify(images));
                localStorage.setItem(imgTsKey, Date.now().toString());
              } catch { /* storage full */ }
              setProducts(prev => mergeImages(prev.map(p => ({ ...p, imageUrl: null })), images));
            }
          }).catch(() => {});
        }

        // Save product list to cache (without images — keeps cache small)
        if (!isElectron && cacheKey && timestampKey) {
          const serialized = JSON.stringify(freshProducts);
          try {
            localStorage.setItem(cacheKey, serialized);
            localStorage.setItem(timestampKey, Date.now().toString());
            console.log('[CACHE] ✓ Cached', freshProducts.length, 'products (no images)');
          } catch {
            try {
              localStorage.removeItem(cacheKey);
              localStorage.removeItem('pos_stock_all_stores');
              localStorage.removeItem('pos_stock_all_stores_ts');
              localStorage.setItem(cacheKey, serialized);
              localStorage.setItem(timestampKey, Date.now().toString());
              console.log('[CACHE] ✓ Cached after clearing storage');
            } catch { /* still full */ }
          }
        }
      }
    } catch (error) {
      console.error('[CACHE] Error loading products:', error);
      // Stale cache was already loaded above (if it existed) — nothing more to do
    } finally {
      setIsLoading(false);
    }
  }, [storeId, cacheKey, timestampKey]);

  // Keep ref updated
  useEffect(() => {
    loadProductsRef.current = loadProducts;
  }, [loadProducts]);

  // Auto-load on mount and when storeId changes
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-refresh every 5 minutes (only refresh if storeId is set)
  useEffect(() => {
    if (!storeId) return;

    const interval = setInterval(() => {
      console.log('[CACHE] Auto-refresh triggered');
      if (loadProductsRef.current) {
        loadProductsRef.current(true);
      }
    }, CACHE_DURATION);

    return () => {
      console.log('[CACHE] Clearing auto-refresh interval');
      clearInterval(interval);
    };
  }, [storeId]); // Only depend on storeId, not loadProducts

  // Search products by code - returns the specific variation or product base
  const findProductByCode = useCallback((code: string): any => {
    for (const product of products) {
      // Check if code matches a variation
      const variation = product.variations.find(
        v => v.shortCode.toLowerCase() === code.toLowerCase()
      );

      if (variation) {
        // Return variation data in the format expected by the cart
        return {
          id: `${product.productId}-${variation.variationId}`,
          productId: product.productId,
          variationId: variation.variationId,
          productName: product.productName,
          shortCode: variation.shortCode,
          size: variation.size,
          length: variation.length,
          price: variation.price,
          stockQuantity: variation.stock,
          imageUrl: product.imageUrl,
        };
      }

      // Check if code matches product base code
      if (product.shortCode.toLowerCase() === code.toLowerCase()) {
        if (product.variations.length === 0) {
          // Accessory: no variation — return product directly
          return {
            id: `${product.productId}-acc`,
            productId: product.productId,
            variationId: null,
            productName: product.productName,
            shortCode: product.shortCode,
            size: null,
            length: null,
            price: product.basePrice,
            stockQuantity: product.totalStock,
            imageUrl: product.imageUrl,
          };
        }
        // Return first available variation
        const firstVariation = product.variations[0];
        return {
          id: `${product.productId}-${firstVariation.variationId}`,
          productId: product.productId,
          variationId: firstVariation.variationId,
          productName: product.productName,
          shortCode: firstVariation.shortCode,
          size: firstVariation.size,
          length: firstVariation.length,
          price: firstVariation.price,
          stockQuantity: firstVariation.stock,
          imageUrl: product.imageUrl,
        };
      }
    }

    return null;
  }, [products]);

  return {
    products,
    isLoading,
    lastSync,
    refresh: () => loadProducts(true),
    findProductByCode,
  };
}
