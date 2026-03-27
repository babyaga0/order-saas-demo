'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useProductCache, CachedProduct } from '@/hooks/useProductCache';

type POSContextType = {
  // Product cache
  products: CachedProduct[];
  isLoadingProducts: boolean;
  refreshProducts: () => void;
  findProductByCode: (code: string) => any;
  lastSync: Date | null;

  // Scanner
  enableScanner: (handler: (code: string) => void) => void;
  disableScanner: () => void;
  isScannerEnabled: boolean;

  // Store info
  storeId: string | null;
  setStoreId: (id: string) => void;
};

const POSContext = createContext<POSContextType | undefined>(undefined);

export function POSProvider({ children }: { children: React.ReactNode }) {
  // Read storeId synchronously on first render so useProductCache starts loading immediately
  const [storeId, setStoreId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.storeId || null;
      }
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    // Clear old pos_stock_all_stores — no longer used, was filling all 5MB of localStorage
    localStorage.removeItem('pos_stock_all_stores');
    localStorage.removeItem('pos_stock_all_stores_ts');
  }, []);

  // Product cache
  const {
    products,
    isLoading: isLoadingProducts,
    refresh: refreshProducts,
    findProductByCode,
    lastSync,
  } = useProductCache(storeId);

  // Scanner functions (kept for compatibility but not used - pages use input fields)
  const enableScanner = useCallback((handler: (code: string) => void) => {
    // Not used - pages use input field scanning instead
    console.log('[POS] Scanner enable requested (using input fields instead)');
  }, []);

  const disableScanner = useCallback(() => {
    // Not used - pages use input field scanning instead
  }, []);

  return (
    <POSContext.Provider
      value={{
        products,
        isLoadingProducts,
        refreshProducts,
        findProductByCode,
        lastSync,
        enableScanner,
        disableScanner,
        isScannerEnabled: false, // Not used - pages use input fields
        storeId,
        setStoreId,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within POSProvider');
  }
  return context;
}
