'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { ReceiptData } from '@/utils/receiptGenerator';
import ProductGrid from '@/components/pos/ProductGrid';
import { usePOS } from '@/contexts/POSContext';
import { saveOfflineSale, syncPendingSales, getPendingSaleCount } from '@/lib/offlineStore';

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

type GroupedProduct = {
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

type CartItem = {
  id: string;
  productId: number;
  variationId?: number;
  productName: string;
  shortCode: string;
  size?: string;
  length?: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  imageUrl?: string;
};

export default function POSSalesPage() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params['store-slug'] as string;
  const { user } = useAuth();
  const { products, isLoadingProducts, refreshProducts, findProductByCode, enableScanner, disableScanner, setStoreId: setContextStoreId } = usePOS();

  // Store info state
  const [storeId, setStoreId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>(storeSlug);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Mode state
  const [mode, setMode] = useState<'SCAN' | 'MANUEL'>('SCAN');

  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanCode, setScanCode] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastTouchRef = useRef<number>(0);

  // Get store ID on mount - optimized with caching
  useEffect(() => {
    const loadStore = async () => {
      if (!user) {
        setIsLoadingStore(false);
        return;
      }

      setIsLoadingStore(true);

      // STORE_CASHIER can only access their own store
      if (user.role === 'STORE_CASHIER' && user.store?.name) {
        const userStoreSlug = user.store.name.toLowerCase().replace(/\s+/g, '-');
        if (userStoreSlug !== storeSlug) {
          console.warn(`[STORE] Access denied: cashier ${user.store.name} trying to access ${storeSlug}`);
          setAccessDenied(true);
          setIsLoadingStore(false);
          // Redirect to their own store
          router.replace(`/pos/${userStoreSlug}`);
          return;
        }
      }

      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;
      let loadedStoreId = '';
      let loadedStoreName = '';

      // 1. Try localStorage cache first (fastest)
      const cachedStoreId = localStorage.getItem(`pos_store_${storeSlug}`);
      const cachedStoreName = localStorage.getItem(`pos_store_name_${storeSlug}`);
      if (cachedStoreId) {
        loadedStoreId = cachedStoreId;
        loadedStoreName = cachedStoreName || user.store?.name || storeSlug;
        setStoreId(loadedStoreId);
        setStoreName(loadedStoreName);
        console.log('[STORE] Loaded from cache:', loadedStoreId);
      }
      // 2. Try user's storeId only if user's store name matches the URL slug
      else if (user?.storeId && (user.role === 'STORE_CASHIER' || (user.store?.name && user.store.name.toLowerCase().replace(/\s+/g, '-') === storeSlug))) {
        loadedStoreId = user.storeId;
        loadedStoreName = user.store?.name || storeSlug;
        setStoreId(loadedStoreId);
        setStoreName(loadedStoreName);
        localStorage.setItem(`pos_store_${storeSlug}`, loadedStoreId);
        if (user.store?.name) localStorage.setItem(`pos_store_name_${storeSlug}`, user.store.name);
        console.log('[STORE] Loaded from user:', loadedStoreId);
      }
      // 3. Fallback: fetch from API
      else {
        try {
          const stockResponse = await api.get('/stock/all-stores');
          if (stockResponse.data.success) {
            const stores = stockResponse.data.data?.stores || [];
            const store = stores.find((s: any) => s.slug === storeSlug);
            if (store) {
              loadedStoreId = store.id;
              loadedStoreName = store.name;
              setStoreId(loadedStoreId);
              setStoreName(loadedStoreName);
              localStorage.setItem(`pos_store_${storeSlug}`, store.id);
              localStorage.setItem(`pos_store_name_${storeSlug}`, store.name);
              console.log('[STORE] Loaded from API:', loadedStoreId);
            }
          }
        } catch (error) {
          console.error('Error loading store:', error);
        }
      }

      // If running in Electron, configure the sync service with this storeId
      if (isElectron && loadedStoreId) {
        try {
          console.log('[ELECTRON] Setting storeId in sync service:', loadedStoreId);
          await (window as any).electronAPI.setConfig('storeId', loadedStoreId);
          await (window as any).electronAPI.setConfig('storeName', loadedStoreName);
          const result = await (window as any).electronAPI.setStoreId(loadedStoreId);
          if (result.success) {
            console.log('[ELECTRON] ✓ Store ID configured, sync service will use:', result.storeId);
          }
        } catch (error) {
          console.error('[ELECTRON] Error configuring storeId:', error);
        }
      }

      // Set storeId in POSContext for product caching and global scanner
      if (loadedStoreId) {
        setContextStoreId(loadedStoreId);
        console.log('[POS CONTEXT] Store ID set:', loadedStoreId);
      }

      setIsLoadingStore(false);
      console.log('[STORE] ✓ Store loading complete, ready for scanning');
    };

    loadStore();
  }, [user, storeSlug, setContextStoreId]);


  // Track last touch time — used to avoid stealing focus during active interaction
  useEffect(() => {
    const handleTouch = () => { lastTouchRef.current = Date.now(); };
    document.addEventListener('touchstart', handleTouch);
    document.addEventListener('mousedown', handleTouch);
    return () => {
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('mousedown', handleTouch);
    };
  }, []);

  const focusScanInput = () => {
    const recentTouch = Date.now() - lastTouchRef.current < 2000;
    if (!recentTouch) {
      scanInputRef.current?.focus();
    }
  };

  // Auto-focus scan input when in SCAN mode
  useEffect(() => {
    if (mode === 'SCAN' && !isLoadingStore && !isLoadingProducts) {
      // Focus the scan input after a brief delay to ensure DOM is ready
      const timer = setTimeout(() => {
        focusScanInput();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Blur the input when switching away from SCAN mode
      scanInputRef.current?.blur();
    }
  }, [mode, isLoadingStore, isLoadingProducts]);

  // Products now come from POSContext - no need for local loading


  // Payment state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    discountAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState('');

  // Price editing state
  const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  // Printer
  const printer = useThermalPrinter();

  // Offline state
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track online/offline status and auto-sync
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = async () => {
      setIsOnline(true);
      console.log('[OFFLINE] Back online - starting sync...');
      // Auto-sync pending sales
      setIsSyncing(true);
      try {
        const result = await syncPendingSales((url, data) => api.post(url, data));
        if (result.synced > 0) {
          console.log(`[OFFLINE] ✓ Synced ${result.synced} sales`);
          refreshProducts(); // Refresh stock after sync
        }
        if (result.failed > 0) {
          console.warn(`[OFFLINE] ✗ ${result.failed} sales failed to sync`);
        }
      } catch (err) {
        console.error('[OFFLINE] Sync error:', err);
      }
      setIsSyncing(false);
      // Update pending count
      getPendingSaleCount().then(setPendingCount).catch(() => {});
    };

    const goOffline = () => {
      setIsOnline(false);
      console.log('[OFFLINE] Gone offline');
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Check pending count on mount
    getPendingSaleCount().then(setPendingCount).catch(() => {});

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshProducts]);

  // Calculate totals
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const cartTotal = cartSubtotal - discountAmount;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Validate coupon
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;

    // Check if cart has items
    if (cart.length === 0 || cartSubtotal === 0) {
      setCouponError('Ajoutez des articles au panier d\'abord');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError('');

    try {
      const response = await api.post('/coupons/validate', {
        code: couponCode.trim(),
        cartTotal: cartSubtotal,
      });

      if (response.data.success && response.data.valid) {
        setAppliedCoupon({
          id: response.data.coupon.id,
          code: response.data.coupon.code,
          discountType: response.data.coupon.discountType,
          discountValue: response.data.coupon.discountValue,
          discountAmount: response.data.discountAmount,
        });
        setCouponCode('');
      } else {
        setCouponError(response.data.message || 'Code promo invalide');
      }
    } catch (error: any) {
      console.error('Coupon validation error:', error);
      setCouponError(error.response?.data?.message || 'Erreur de validation');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Remove coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // Recalculate coupon discount when cart changes
  useEffect(() => {
    if (appliedCoupon && cartSubtotal > 0) {
      let newDiscount = 0;
      if (appliedCoupon.discountType === 'PERCENTAGE') {
        newDiscount = cartSubtotal * (appliedCoupon.discountValue / 100);
      } else {
        newDiscount = appliedCoupon.discountValue;
      }
      if (newDiscount > cartSubtotal) {
        newDiscount = cartSubtotal;
      }
      setAppliedCoupon(prev => prev ? { ...prev, discountAmount: Math.round(newDiscount * 100) / 100 } : null);
    } else if (appliedCoupon && cartSubtotal === 0) {
      setAppliedCoupon(null);
    }
  }, [cartSubtotal]);

  // Scanner is now handled by POSContext - we just need to enable/disable it

  // Add item to cart from cached product - Memoized to prevent re-creation
  const addToCartFromProduct = useCallback((product: any) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.shortCode === product.shortCode);

      // Ensure price is a number
      const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;

      const newItem: CartItem = {
        id: `${product.productId}-${product.variationId || 0}-${Date.now()}`,
        productId: product.productId,
        variationId: product.variationId || undefined,
        productName: product.productName,
        shortCode: product.shortCode,
        size: product.size || undefined,
        length: product.length || undefined,
        quantity: 1,
        unitPrice: price,
        originalPrice: price,
        imageUrl: product.imageUrl,
      };

      if (existingIndex >= 0) {
        const updatedCart = [...prevCart];
        updatedCart[existingIndex].quantity += 1;
        return updatedCart;
      } else {
        return [...prevCart, newItem];
      }
    });
  }, []); // No dependencies - uses functional setState

  // Handle scanned barcode from input field - Uses cached products from POSContext
  const handleScannerInput = useCallback(() => {
    if (!scanCode || !scanCode.trim()) return;

    const code = scanCode.trim();
    console.log('[SCANNER] Looking up product with code:', code);
    console.log('[SCANNER] Products in cache:', products.length);

    // Check if store is still loading
    if (isLoadingStore) {
      console.warn('[SCANNER] Store still loading, please wait...');
      alert('Chargement en cours, veuillez patienter...');
      return;
    }

    // Check if products are loaded
    if (isLoadingProducts) {
      console.warn('[SCANNER] Products still loading...');
      alert('Chargement des produits, veuillez patienter...');
      return;
    }

    // Check if products cache is empty
    if (products.length === 0) {
      console.error('[SCANNER] No products in cache!');
      alert('Aucun produit en cache. Veuillez actualiser la page.');
      return;
    }

    // Use findProductByCode from POSContext (cached products)
    const product = findProductByCode(code);

    if (product) {
      if (product.stockQuantity === 0) {
        console.warn('[SCANNER] Product is out of stock:', product.shortCode);
        alert(`Rupture de stock: ${product.shortCode}`);
        setScanCode('');
        scanInputRef.current?.focus();
        return;
      }
      console.log('[SCANNER] Product found in cache:', product.productName, product.shortCode);
      addToCartFromProduct(product);
      console.log('[SCANNER] ✓ Product added to cart');
      setScanCode(''); // Clear input after successful scan
      scanInputRef.current?.focus(); // Keep focus on scanner input
    } else {
      console.warn('[SCANNER] Product not found in cache for code:', code);
      alert(`Produit non trouve: ${code}`);
      setScanCode(''); // Clear input even on error
      scanInputRef.current?.focus();
    }
  }, [scanCode, isLoadingStore, isLoadingProducts, products, findProductByCode, addToCartFromProduct]);

  // Focus scanner input when store and products are ready (covers initial load + returning from other tabs)
  useEffect(() => {
    if (!isLoadingStore && !isLoadingProducts && mode === 'SCAN') {
      const timer = setTimeout(() => {
        focusScanInput();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoadingStore, isLoadingProducts, mode]);

  // Re-focus scan input when page wakes from sleep / screen lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && mode === 'SCAN') {
        focusScanInput();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [mode]);

  // No longer using global scanner - input field captures scanner output instead
  // This is disabled to match Retours page architecture

  // Add item from product grid selection
  const handleProductGridSelect = (product: GroupedProduct, variation: GroupedProduct['variations'][0]) => {
    const existingIndex = cart.findIndex(item => item.shortCode === variation.shortCode);

    const newItem: CartItem = {
      id: `${product.productId}-${variation.variationId}-${Date.now()}`,
      productId: product.productId,
      variationId: variation.variationId || undefined, // 0 = accessory (no variation)
      productName: product.productName,
      shortCode: variation.shortCode,
      size: variation.size || undefined,
      length: variation.length || undefined,
      quantity: 1,
      unitPrice: variation.price,
      originalPrice: variation.price,
      imageUrl: product.imageUrl || undefined,
    };

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, newItem]);
    }
  };

  // Update cart item
  const updateCartItem = (index: number, updates: Partial<CartItem>) => {
    const updatedCart = [...cart];
    updatedCart[index] = { ...updatedCart[index], ...updates };
    setCart(updatedCart);
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    // Restore focus to the hidden scan input so the next scan works immediately
    if (mode === 'SCAN') {
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  // Start editing price
  const startEditingPrice = (index: number) => {
    setEditingPriceIndex(index);
    setEditingPriceValue(cart[index].unitPrice.toString());
  };

  // Save edited price
  const saveEditedPrice = (index: number) => {
    const newPrice = parseFloat(editingPriceValue);
    if (!isNaN(newPrice) && newPrice >= 0) {
      updateCartItem(index, { unitPrice: newPrice });
    }
    setEditingPriceIndex(null);
    setEditingPriceValue('');
    if (mode === 'SCAN') setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Cancel price editing
  const cancelEditingPrice = () => {
    setEditingPriceIndex(null);
    setEditingPriceValue('');
  };

  // Submit sale
  const handleSubmitSale = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      // Check if running in Electron app
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

      const saleData = {
        storeId: storeId || user?.storeId || '',
        customerName: customerPhone ? (customerName || `Client ${storeName}`) : null,
        customerPhone: customerPhone || null,
        customerCity: 'Casablanca', // Always set to Casablanca for offline orders
        paymentMethod,
        items: cart.map(item => ({
          productName: item.productName,
          productId: item.productId,
          productVariationId: item.variationId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: null,
        couponId: appliedCoupon?.id || null,
        discountAmount: appliedCoupon?.discountAmount || 0,
        totalAmount: cartTotal,
      };

      console.log('[SALE] Sending sale data:', JSON.stringify(saleData, null, 2));

      let saleNumber = '';

      if (isElectron) {
        // Use offline sale creation in Electron
        console.log('[SALE] Creating offline sale in Electron');
        const result = await (window as any).electronAPI.createOfflineSale(saleData);

        if (result.success) {
          saleNumber = result.localId;
          console.log('[SALE] Offline sale created:', saleNumber);
        } else {
          throw new Error(result.error || 'Failed to create offline sale');
        }
      } else if (navigator.onLine) {
        // Online: Use API directly
        console.log('[SALE] Creating online sale via API');
        const response = await api.post('/in-store-sales', saleData);

        if (response.data.success) {
          saleNumber = response.data.data.saleNumber;
          console.log('[SALE] Online sale created:', saleNumber);
        } else {
          throw new Error('Failed to create online sale');
        }
      } else {
        // Offline: Save to IndexedDB queue
        console.log('[SALE] OFFLINE - Saving sale to local queue');
        saleNumber = await saveOfflineSale(saleData);
        const count = await getPendingSaleCount();
        setPendingCount(count);
        console.log('[SALE] Offline sale queued:', saleNumber, `(${count} pending)`);
      }

      // Clear product stock cache so stock page reflects the sale immediately
      if (storeId) {
        localStorage.removeItem(`products_cache_${storeId}`);
        localStorage.removeItem(`products_cache_timestamp_${storeId}`);
      }

      // Common success handling for both online and offline sales
      setLastSaleNumber(saleNumber);
      setShowSuccess(true);

      // Auto-hide success popup after 3 seconds and refocus scanner
      setTimeout(() => {
        setShowSuccess(false);
        // Refocus scanner input in Electron after popup disappears
        if (mode === 'SCAN' && scanInputRef.current) {
          scanInputRef.current.focus();
        }
      }, 3000);

      // Print receipt
      const receiptData: ReceiptData = {
        storeName: storeName,
        saleNumber: saleNumber,
        cashierName: user?.fullName || 'Vendeur',
        items: cart.map(item => ({
          productName: item.productName,
          shortCode: item.shortCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })),
        subtotal: cartSubtotal,
        discount: appliedCoupon ? {
          code: appliedCoupon.code,
          amount: appliedCoupon.discountAmount,
        } : undefined,
        total: cartTotal,
        paymentMethod: paymentMethod,
        customerPhone: customerPhone || undefined,
      };

      // Always attempt to print silently (don't block on errors)
      // Note: Receipt printing automatically opens cash drawer via ESC/POS command
      printer.printReceipt(receiptData).then(success => {
        if (success) {
          console.log('[PRINTER] ✓ Receipt printed successfully (drawer opened automatically)');
        } else {
          console.warn('[PRINTER] Print failed, but sale was recorded');
        }
      }).catch(err => {
        console.error('[PRINTER] Print error:', err);
        // Don't show alert - sale was successful regardless of print status
      });

      // Reset cart
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('CASH');
      setAppliedCoupon(null);
      setCouponCode('');
      setCouponError('');

      // Refresh products cache in background (handled by POSContext)
      refreshProducts();
    } catch (error: any) {
      console.error('[SALE] Error creating sale:', error);
      console.error('[SALE] Error response:', error.response?.data);
      console.error('[SALE] Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Erreur lors de la creation de la vente';

      alert(`Erreur: ${errorMessage}\n\nVerifiez la console pour plus de details.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl font-bold text-red-600">Acces non autorise</p>
          <p className="text-gray-500 mt-2">Redirection vers votre magasin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden bg-gray-100" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      {/* Top Bar */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">{storeName}</h1>

          {/* Product Cache Status */}
          {isLoadingProducts && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Chargement...
            </div>
          )}
          {!isLoadingProducts && products.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <span>✓</span>
              <span>{products.length} produits</span>
            </div>
          )}

          {/* Offline / Sync Status */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              HORS LIGNE
            </div>
          )}
          {isSyncing && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Sync...
            </div>
          )}
          {pendingCount > 0 && !isSyncing && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              <span>{pendingCount} en attente</span>
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => { setMode('SCAN'); setTimeout(() => scanInputRef.current?.focus(), 50); }}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
              mode === 'SCAN'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            SCAN
          </button>
          <button
            onClick={() => setMode('MANUEL')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
              mode === 'MANUEL'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            MANUEL
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'SCAN' ? (
            /* SCAN Mode - Scanner input + scanned items list */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Hidden Scanner Input - Captures barcode scanner data invisibly */}
              <input
                ref={scanInputRef}
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScannerInput()}
                className="absolute opacity-0 pointer-events-none"
                disabled={isLoadingStore || isLoadingProducts}
                tabIndex={-1}
              />

              {/* Scanned Items List */}
              <div className="flex-1 p-4 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <p className="text-lg">Pret a scanner</p>
                    <p className="text-sm mt-1">Les articles apparaitront ici</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {cart.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4"
                    >
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{item.shortCode}</p>
                        <p className="text-sm text-gray-500 truncate">{item.productName}</p>
                        {/* Price - read only, edit via Panier */}
                        <p className="text-orange-600 font-bold mt-1">{item.unitPrice.toFixed(2)} DH</p>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateCartItem(index, { quantity: item.quantity - 1 });
                            } else {
                              removeFromCart(index);
                            }
                          }}
                          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => updateCartItem(index, { quantity: item.quantity + 1 })}
                          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => removeFromCart(index)}
                        className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          ) : (
            /* MANUEL Mode - Product Grid */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar for Manual Mode */}
              <div className="p-4 bg-white shadow-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <ProductGrid
                products={products}
                searchQuery={searchQuery}
                onSelectVariation={handleProductGridSelect}
                isLoading={isLoadingProducts}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Cart Summary */}
        <div className="w-80 lg:w-96 flex flex-col bg-white shadow-lg">
          {/* Cart Header */}
          <div className="px-4 py-4">
            <h2 className="text-xl font-bold text-gray-800">
              Panier
              {cartItemCount > 0 && (
                <span className="ml-2 px-2.5 py-1 bg-orange-100 text-orange-600 text-sm rounded-full font-bold">
                  {cartItemCount}
                </span>
              )}
            </h2>
          </div>

          {/* Cart Items (compact view in both SCAN and MANUEL mode) */}
          {cart.length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 space-y-2">
              {cart.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{item.shortCode}</p>
                    {/* Editable Price in MANUEL mode */}
                    {editingPriceIndex === index ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editingPriceValue}
                          onChange={(e) => setEditingPriceValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditedPrice(index);
                            if (e.key === 'Escape') cancelEditingPrice();
                          }}
                          onBlur={() => saveEditedPrice(index)}
                          autoFocus
                          className="w-16 px-1 py-0.5 text-xs border border-orange-400 rounded focus:outline-none"
                          step="0.01"
                          min="0"
                        />
                        <span className="text-xs text-gray-500">DH</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingPrice(index)}
                        className="text-left group"
                        title="Cliquer pour modifier le prix"
                      >
                        <span className="text-xs text-gray-500 group-hover:text-orange-500">
                          {item.quantity} x {item.unitPrice.toFixed(2)} DH
                          <svg className="w-2.5 h-2.5 inline-block ml-0.5 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </span>
                        {item.unitPrice !== item.originalPrice && (
                          <span className="ml-1 text-xs text-gray-400 line-through">
                            {item.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{(item.unitPrice * item.quantity).toFixed(2)} DH</span>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Spacer when cart is empty */}
          {cart.length === 0 && <div className="flex-1" />}

          {/* Cart Footer */}
          <div className="p-4 space-y-3">
            {/* Coupon Input */}
            {!appliedCoupon ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError('');
                    }}
                    placeholder="Code promo"
                    className={`coupon-input flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                      couponError ? 'ring-2 ring-red-400 bg-red-50' : ''
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                  />
                  <button
                    onClick={handleValidateCoupon}
                    disabled={!couponCode.trim() || isValidatingCoupon}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[60px] flex items-center justify-center"
                  >
                    {isValidatingCoupon ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'OK'
                    )}
                  </button>
                </div>
                {couponError && (
                  <div className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium">
                    {couponError}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-green-100 px-3 py-2 rounded-lg border border-green-300">
                <div>
                  <p className="text-sm font-bold text-green-700">{appliedCoupon.code}</p>
                  <p className="text-xs text-green-600">
                    {appliedCoupon.discountType === 'PERCENTAGE'
                      ? `-${appliedCoupon.discountValue}%`
                      : `-${appliedCoupon.discountValue.toFixed(2)} DH`}
                  </p>
                </div>
                <button onClick={handleRemoveCoupon} className="text-red-500 hover:text-red-700 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Totals */}
            {appliedCoupon && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total</span>
                  <span>{cartSubtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Reduction</span>
                  <span>-{appliedCoupon.discountAmount.toFixed(2)} DH</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-xl font-bold pt-2">
              <span>Total</span>
              <span className="text-orange-600">{cartTotal.toFixed(2)} DH</span>
            </div>

            {/* Customer Name */}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nom du client (optionnel)"
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            {/* Customer Phone */}
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Tel client (optionnel)"
              className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            {/* Payment Method */}
            <div className="flex gap-2">
              {(['CASH', 'CARD'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    paymentMethod === method
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {method === 'CASH' ? 'ESPECES' : 'CARTE'}
                </button>
              ))}
            </div>

            {/* Submit Button - Direct submission */}
            <button
              onClick={handleSubmitSale}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
                cart.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30'
              }`}
            >
              {isSubmitting ? 'Traitement...' : `VALIDER - ${cartTotal.toFixed(2)} DH`}
            </button>
          </div>
        </div>
      </div>


      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg z-50">
          <p className="font-bold">Vente enregistree!</p>
          <p className="text-sm opacity-90">Ticket: {lastSaleNumber}</p>
        </div>
      )}
    </div>
  );
}
